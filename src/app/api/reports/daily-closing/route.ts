import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withDbRetry } from "@/lib/dbRetry";
import { getWIBDayRange, getWIBDateString } from "@/lib/wibTime";
import { classifySaleItem } from "@/lib/itemClassification";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    let dateParam = searchParams.get("date");
    if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      dateParam = getWIBDateString();
    }
    const { startOfDay, endOfDay } = getWIBDayRange(dateParam);

    const reportData = await withDbRetry(async () => {
      // 0. Fetch All Active Technicians from Master Data
      const allActiveTechs = await (prisma as any).technician.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
      });

      // 1. Fetch Sales (POS Retail & Vouchers)
      const sales = await prisma.sale.findMany({
        where: {
          OR: [
            { createdAt: { gte: startOfDay, lte: endOfDay } },
            {
              paymentMethod: "CREDIT",
              paymentStatus: "PAID",
              paidAt: { gte: startOfDay, lte: endOfDay },
            },
          ],
        },
        include: {
          items: {
            include: {
              product: {
                include: { category: true },
              },
              voucher: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      });

      let voucherAquaTisuRevenue = 0;
      let aksesorisRevenue = 0;
      let cashSales = 0;
      let nonCashSales = 0;

      for (const sale of sales) {
        const isCreatedToday = sale.createdAt >= startOfDay && sale.createdAt <= endOfDay;
        const isSettledToday = sale.paidAt && sale.paidAt >= startOfDay && sale.paidAt <= endOfDay;

        if (isCreatedToday) {
          for (const item of sale.items) {
            const group = classifySaleItem({
              itemType: item.itemType,
              itemName: item.itemName,
              productType: item.product?.type,
              categoryName: item.product?.category?.name,
            });

            if (group === "VOUCHER_AQUA_TISU") {
              voucherAquaTisuRevenue += item.subtotal;
            } else {
              // AKSESORIS (termasuk Temp, HP, Batt, Charger, Case, dll.)
              aksesorisRevenue += item.subtotal;
            }
          }

          if (sale.paymentMethod === "CASH") {
            cashSales += sale.finalAmount;
          } else if (sale.paymentMethod === "QRIS" || sale.paymentMethod === "TRANSFER") {
            nonCashSales += sale.finalAmount;
          } else if (sale.paymentMethod === "CREDIT" && isSettledToday) {
            // Nota kredit dibuat hari ini dan dilunasi hari ini juga
            const method = (sale.paidMethod || "CASH").toUpperCase();
            const amountPaid =
              sale.paymentStatus === "PAID"
                ? sale.finalAmount
                : Math.min(sale.cashGiven || 0, sale.finalAmount);
            if (method === "CASH") {
              cashSales += amountPaid;
            } else {
              nonCashSales += amountPaid;
            }
          }
        } else if (isSettledToday && sale.paymentMethod === "CREDIT") {
          // Pelunasan bon masa lalu dihitung pada hari dilunasi
          const method = (sale.paidMethod || "CASH").toUpperCase();
          const amountPaid =
            sale.paymentStatus === "PAID"
              ? sale.finalAmount
              : Math.min(sale.cashGiven || 0, sale.finalAmount);

          if (method === "CASH") {
            cashSales += amountPaid;
          } else {
            nonCashSales += amountPaid;
          }
        }
      }

      // 2. Fetch Digital Transactions (PPOB / Pulsa)
      const digitalTransactions = await prisma.digitalTransaction.findMany({
        where: {
          status: "SUCCESS",
          createdAt: { gte: startOfDay, lte: endOfDay },
        },
        include: {
          digitalProduct: true,
        },
        orderBy: { createdAt: "asc" },
      });

      let pulsaRevenue = 0;
      let cashPulsa = 0;
      let nonCashPulsa = 0;

      for (const dt of digitalTransactions) {
        pulsaRevenue += dt.sellingPrice;
        const pMethod = ((dt as any).paymentMethod || "CASH").toUpperCase();
        if (pMethod === "QRIS" || pMethod === "TRANSFER") {
          nonCashPulsa += dt.sellingPrice;
        } else {
          cashPulsa += dt.sellingPrice;
        }
      }

      // 3. Fetch Service Records (Jasa Servis HP)
      const services = await (prisma as any).serviceRecord.findMany({
        where: {
          status: "COMPLETED",
          paymentStatus: "PAID",
          OR: [
            { completedAt: { gte: startOfDay, lte: endOfDay } },
            { completedAt: null, createdAt: { gte: startOfDay, lte: endOfDay } },
          ],
        },
        include: {
          technician: true,
        },
        orderBy: { completedAt: "asc" },
      });

      let serviceHpRevenue = 0;
      let cashService = 0;
      let nonCashService = 0;

      // Inisialisasi techMap dari master data teknisi aktif
      const techMap = new Map<
        string,
        {
          technicianId: string;
          technicianName: string;
          defaultPercentage: number;
          services: Array<{
            id: string;
            deviceAndIssue: string;
            serviceFee: number;
            notes: string;
          }>;
          totalServiceFee: number;
          totalTechnicianFee: number;
          totalStoreProfit: number;
        }
      >();

      for (const tech of allActiveTechs) {
        techMap.set(tech.id, {
          technicianId: tech.id,
          technicianName: tech.name,
          defaultPercentage: tech.defaultPercentage ?? 50,
          services: [],
          totalServiceFee: 0,
          totalTechnicianFee: 0,
          totalStoreProfit: 0,
        });
      }

      for (const s of services) {
        serviceHpRevenue += s.serviceFee || 0;
        const pMethod = (s.paymentMethod || "CASH").toUpperCase();
        if (pMethod === "QRIS" || pMethod === "TRANSFER") {
          nonCashService += s.serviceFee || 0;
        } else {
          cashService += s.serviceFee || 0;
        }

        const tId = s.technician?.id || "unknown";
        const tName = s.technician?.name || "Teknisi Umum";
        const tDefaultPercentage = s.technician?.defaultPercentage ?? 50;

        if (!techMap.has(tId)) {
          techMap.set(tId, {
            technicianId: tId,
            technicianName: tName,
            defaultPercentage: tDefaultPercentage,
            services: [],
            totalServiceFee: 0,
            totalTechnicianFee: 0,
            totalStoreProfit: 0,
          });
        }

        const tGroup = techMap.get(tId)!;
        tGroup.services.push({
          id: s.id,
          deviceAndIssue: `${s.deviceType || ""} - ${s.issue || ""}`.trim().replace(/^-|-$/, ""),
          serviceFee: s.serviceFee || 0,
          notes: s.notes || s.serviceNumber || "",
        });
        tGroup.totalServiceFee += s.serviceFee || 0;
        tGroup.totalTechnicianFee += s.technicianFee || 0;
        tGroup.totalStoreProfit += s.storeProfit || 0;
      }

      // Convert techMap to arrays
      const techList = Array.from(techMap.values());
      const totalHakKomisiTeknisi = techList.reduce((sum, t) => sum + t.totalTechnicianFee, 0);
      const totalBagianTokoServis = techList.reduce((sum, t) => sum + t.totalStoreProfit, 0);

      // Persentase komisi dan bagi hasil per teknisi (Bagian 2A & 2B)
      const bagian2A = techList.map((t, idx) => {
        const commPct = t.totalServiceFee > 0 ? (t.totalTechnicianFee / t.totalServiceFee) * 100 : t.defaultPercentage;
        const storePct = 100 - commPct;
        return {
          no: idx + 1,
          technicianId: t.technicianId,
          technicianName: t.technicianName,
          commissionPercentage: Math.round(commPct),
          storePercentage: Math.round(storePct),
        };
      });

      const avgCommissionPct =
        serviceHpRevenue > 0
          ? Math.round((totalHakKomisiTeknisi / serviceHpRevenue) * 100)
          : bagian2A.length > 0
          ? Math.round(bagian2A.reduce((sum, t) => sum + t.commissionPercentage, 0) / bagian2A.length)
          : 50;
      const avgStorePct = 100 - avgCommissionPct;

      const bagian2B = techList.map((t, idx) => ({
        no: idx + 1,
        technicianId: t.technicianId,
        technicianName: t.technicianName,
        commissionFee: t.totalTechnicianFee,
        storeProfit: t.totalStoreProfit,
      }));

      // Bagian 2C: Hanya tampilkan teknisi yang memiliki pengerjaan servis pada tanggal ini
      const bagian2C = techList
        .filter((t) => t.services.length > 0)
        .map((t, idx) => ({
          no: idx + 1,
          technicianId: t.technicianId,
          technicianName: t.technicianName,
          services: t.services.map((item, sIdx) => ({
            no: sIdx + 1,
            deviceAndIssue: item.deviceAndIssue || "Servis HP",
            serviceFee: item.serviceFee,
            notes: item.notes,
          })),
          total: t.totalServiceFee,
        }));

      // 4. Fetch Expenses (Beban Kasir Operasional Harian - Bagian 3)
      const expenses = await prisma.expense.findMany({
        where: {
          date: { gte: startOfDay, lte: endOfDay },
        },
        orderBy: { date: "asc" },
      });

      const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
      const bagian3 = {
        expenses: expenses.map((e, idx) => ({
          no: idx + 1,
          description: e.description,
          amount: e.amount,
          category: e.category,
        })),
        totalExpenses,
      };

      // 5. Calculate Subtotals & Grand Totals (Bagian 1 & Bagian 4)
      const subtotalPulsaVoucherAquaTisu = pulsaRevenue + voucherAquaTisuRevenue;
      const subtotalAksesoris = aksesorisRevenue;
      const subtotalServiceHp = serviceHpRevenue;
      const totalOmzetHarian = subtotalPulsaVoucherAquaTisu + subtotalAksesoris + subtotalServiceHp;

      // Bagian 4: Ringkasan Akhir Kas Harian (Setoran Hari Ini)
      const sisaUangBersihToko = totalOmzetHarian - totalHakKomisiTeknisi - totalExpenses;

      // Kas fisik murni di laci kasir (memperhitungkan tunai vs non-tunai bank/QRIS)
      const totalCashIn = cashSales + cashPulsa + cashService;
      const totalNonCash = nonCashSales + nonCashPulsa + nonCashService;
      const estimasiFisikTunaiLaci = Math.max(0, totalCashIn - totalHakKomisiTeknisi - totalExpenses);

      // Format display date in Indonesian (e.g. "Sabtu, 31 Oktober 2026")
      const displayFormatter = new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Jakarta",
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      const formattedDate = displayFormatter.format(startOfDay);

      return {
        date: dateParam,
        formattedDate,
        bagian1: {
          pulsaRevenue,
          voucherAquaTisuRevenue,
          subtotalPulsaVoucherAquaTisu,
          aksesorisRevenue,
          subtotalAksesoris,
          serviceHpRevenue,
          subtotalServiceHp,
          totalOmzetHarian,
        },
        bagian2A: {
          technicians: bagian2A,
          averageCommissionPercentage: avgCommissionPct,
          averageStorePercentage: avgStorePct,
        },
        bagian2B: {
          technicians: bagian2B,
          totalHakKomisiTeknisi,
          totalBagianToko: totalBagianTokoServis,
        },
        bagian2C,
        bagian3,
        bagian4: {
          totalOmzetHarian,
          totalHakKomisiTeknisi,
          totalExpenses,
          sisaUangBersihToko,
          // Estimasi fisik kas tunai di laci untuk setoran
          estimasiFisikKasLaci: sisaUangBersihToko, // Standard template omzet - komisi - pengeluaran
          cashDrawerReconciliation: {
            totalCashIn,
            totalNonCash,
            estimasiFisikTunaiLaci,
          },
        },
      };
    });

    return NextResponse.json({ success: true, data: reportData });
  } catch (error: any) {
    console.error("GET Daily Closing Error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal menyusun rekap harian kasir" },
      { status: 500 }
    );
  }
}


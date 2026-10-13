import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withDbRetry } from "@/lib/dbRetry";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isOwner = session.role === "OWNER";

  try {
    const { searchParams } = new URL(request.url);
    const range = (searchParams.get("range") || "DAILY").toUpperCase();
    const dateParam = searchParams.get("date");
    const monthParam = searchParams.get("month"); // e.g. "2026-10"

    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    if (range === "DAILY") {
      let year = now.getFullYear();
      let month = now.getMonth();
      let day = now.getDate();
      if (dateParam) {
        const parts = dateParam.split("-");
        if (parts.length === 3) {
          year = parseInt(parts[0], 10);
          month = parseInt(parts[1], 10) - 1;
          day = parseInt(parts[2], 10);
        }
      }
      startDate = new Date(year, month, day, 0, 0, 0, 0);
      endDate = new Date(year, month, day, 23, 59, 59, 999);
    } else if (range === "WEEKLY") {
      // Last 7 days
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
    } else if (range === "MONTHLY") {
      let year = now.getFullYear();
      let month = now.getMonth();
      if (monthParam) {
        const parts = monthParam.split("-");
        if (parts.length === 2) {
          year = parseInt(parts[0], 10);
          month = parseInt(parts[1], 10) - 1;
        }
      }
      startDate = new Date(year, month, 1, 0, 0, 0, 0);
      endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
    } else {
      // Fallback to today
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    }

    const recapData = await withDbRetry(async () => {
      const saleItems = await prisma.saleItem.findMany({
        where: {
          OR: [
            { itemType: "VOUCHER" },
            { voucherId: { not: null } },
          ],
          quantity: { gt: 0 }, // Hanya ambil kuantitas yang benar-benar terjual > 0
          sale: {
            OR: [
              // 1. Transaksi dibuat di rentang tanggal ini (baik Tunai, QRIS, Transfer, maupun Kredit)
              {
                createdAt: {
                  gte: startDate,
                  lte: endDate,
                },
              },
              // 2. Transaksi Kredit masa lalu yang dilunasi di rentang tanggal ini
              {
                paymentMethod: "CREDIT",
                paymentStatus: "PAID",
                paidAt: {
                  gte: startDate,
                  lte: endDate,
                },
              },
            ],
          },
        },
        include: {
          sale: {
            select: {
              id: true,
              invoiceNumber: true,
              createdAt: true,
              paymentMethod: true,
              paymentStatus: true,
              paidAt: true,
              customerName: true,
              notes: true,
              cashier: { select: { id: true, name: true } },
            },
          },
          voucher: {
            select: {
              id: true,
              operator: true,
              nominal: true,
            },
          },
        },
        orderBy: {
          sale: { createdAt: "desc" },
        },
      });

      // Aggregate totals
      let totalSold = 0;
      let totalRevenue = 0;
      let totalProfit = 0;
      let totalCost = 0;
      let unpaidRevenue = 0;

      // Grouping breakdown by date (YYYY-MM-DD)
      const dayMap = new Map<
        string,
        {
          dateStr: string;
          label: string;
          soldCount: number;
          revenue: number;
          profit: number;
          cost: number;
          operators: Record<string, number>;
        }
      >();

      // Also grouping by operator
      const operatorMap = new Map<
        string,
        {
          operator: string;
          soldCount: number;
          revenue: number;
          profit: number;
        }
      >();

      // Detailed sales list
      const salesList: any[] = [];

      for (const item of saleItems) {
        const qty = item.quantity;
        if (qty <= 0) continue; // Jangan proses item 0 pcs

        const rev = item.subtotal;
        const prof = item.profit;
        const cost = item.costPrice * qty;

        const saleRec = item.sale as any;
        const isCredit = saleRec?.paymentMethod === "CREDIT";
        const isPaid = saleRec?.paymentStatus === "PAID";
        const isPaidInPeriod =
          isCredit &&
          isPaid &&
          saleRec?.paidAt &&
          new Date(saleRec.paidAt) >= startDate &&
          new Date(saleRec.paidAt) <= endDate;
        const isCreatedInPeriod =
          new Date(saleRec.createdAt) >= startDate &&
          new Date(saleRec.createdAt) <= endDate;

        // Cash-basis recognition:
        // - Non-credit: Realized if created in period
        // - Credit: Realized if paid in period
        const isRealized = !isCredit ? isCreatedInPeriod : isPaidInPeriod;

        if (isRealized) {
          totalRevenue += rev;
          totalProfit += prof;
          totalCost += cost;
        } else if (isCredit && !isPaid) {
          unpaidRevenue += rev;
        }

        if (isCreatedInPeriod) {
          totalSold += qty;
        }

        const effectiveDate =
          isCredit && saleRec?.paidAt ? new Date(saleRec.paidAt) : new Date(saleRec.createdAt);
        const dateKey = effectiveDate.toISOString().slice(0, 10);

        if (!dayMap.has(dateKey)) {
          const dateLabel = effectiveDate.toLocaleDateString("id-ID", {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric",
          });
          dayMap.set(dateKey, {
            dateStr: dateKey,
            label: dateLabel,
            soldCount: 0,
            revenue: 0,
            profit: 0,
            cost: 0,
            operators: {},
          });
        }

        const dayEntry = dayMap.get(dateKey)!;
        if (isCreatedInPeriod) {
          dayEntry.soldCount += qty;
        }
        if (isRealized) {
          dayEntry.revenue += rev;
          dayEntry.profit += prof;
          dayEntry.cost += cost;
        }

        const opName = item.voucher?.operator || "Lainnya";
        dayEntry.operators[opName] = (dayEntry.operators[opName] || 0) + qty;

        // Group by operator
        if (!operatorMap.has(opName)) {
          operatorMap.set(opName, {
            operator: opName,
            soldCount: 0,
            revenue: 0,
            profit: 0,
          });
        }
        const opEntry = operatorMap.get(opName)!;
        if (isCreatedInPeriod) {
          opEntry.soldCount += qty;
        }
        if (isRealized) {
          opEntry.revenue += rev;
          opEntry.profit += prof;
        }

        // Add to detailed sales list
        const isPOS = !saleRec?.invoiceNumber?.startsWith("VCH-");
        salesList.push({
          id: item.id,
          saleId: saleRec?.id,
          invoiceNumber: saleRec?.invoiceNumber || "-",
          source: isPOS ? "POS" : "DAILY_RECORD",
          sourceLabel: isPOS ? "Kasir POS" : "Pencatatan Sisa Stok",
          createdAt: saleRec?.createdAt,
          paidAt: saleRec?.paidAt,
          effectiveDate: effectiveDate.toISOString(),
          itemName: item.itemName,
          operator: item.voucher?.operator || "Lainnya",
          nominal: item.voucher?.nominal || "",
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.subtotal,
          profit: isOwner ? (isRealized ? item.profit : 0) : 0,
          costPrice: isOwner ? item.costPrice : 0,
          paymentMethod: saleRec?.paymentMethod || "CASH",
          paymentStatus: saleRec?.paymentStatus || "PAID",
          customerName: saleRec?.customerName || null,
          cashierName: saleRec?.cashier?.name || "Kasir",
          notes: saleRec?.notes || null,
          isRealized,
        });
      }

      // Sort daily breakdown descending by date
      const dailyBreakdown = Array.from(dayMap.values())
        .filter((row) => row.soldCount > 0 || row.revenue > 0)
        .sort((a, b) => b.dateStr.localeCompare(a.dateStr))
        .map((row) => ({
          ...row,
          profit: isOwner ? row.profit : 0,
          cost: isOwner ? row.cost : 0,
        }));

      // Sort operator breakdown descending by quantity sold
      const operatorBreakdown = Array.from(operatorMap.values())
        .filter((row) => row.soldCount > 0 || row.revenue > 0)
        .sort((a, b) => b.soldCount - a.soldCount)
        .map((row) => ({
          ...row,
          profit: isOwner ? row.profit : 0,
        }));

      // Sort salesList descending by createdAt
      salesList.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      return {
        period: {
          range,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        summary: {
          totalSold,
          totalRevenue,
          totalProfit: isOwner ? totalProfit : 0,
          totalCost: isOwner ? totalCost : 0,
          unpaidRevenue,
          profitMarginPct:
            isOwner && totalRevenue > 0
              ? Math.round((totalProfit / totalRevenue) * 1000) / 10
              : 0,
          totalTransactions: salesList.length,
          posCount: salesList.filter((s) => s.source === "POS").length,
          posSold: salesList
            .filter((s) => s.source === "POS")
            .reduce((sum, s) => sum + s.quantity, 0),
          dailyRecordCount: salesList.filter((s) => s.source === "DAILY_RECORD").length,
          dailyRecordSold: salesList
            .filter((s) => s.source === "DAILY_RECORD")
            .reduce((sum, s) => sum + s.quantity, 0),
        },
        dailyBreakdown,
        operatorBreakdown,
        salesList,
        isOwner,
      };
    }, { operationName: "GET Voucher Recap" });

    return NextResponse.json(recapData);
  } catch (error: any) {
    console.error("GET Voucher Recap Error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal mengambil rekapan voucher" },
      { status: 500 }
    );
  }
}

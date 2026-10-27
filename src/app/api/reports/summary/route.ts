import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWIBPeriodRange } from "@/lib/wibTime";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "OWNER") {
    return NextResponse.json({ error: "Akses ditolak. Khusus Owner." }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const presetParam = searchParams.get("preset") as any;
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    let range;
    if (presetParam && ["TODAY", "7DAYS", "THIS_MONTH", "LAST_MONTH"].includes(presetParam)) {
      range = getWIBPeriodRange(presetParam);
    } else if (startDateParam && endDateParam) {
      range = getWIBPeriodRange("CUSTOM", startDateParam, endDateParam);
    } else {
      range = getWIBPeriodRange("THIS_MONTH");
    }

    const { startDate, endDate, periodLabel } = range;

    const dateFilter = {
      gte: startDate,
      lte: endDate,
    };

    // 1. Fetch Sales (POS Retail & Vouchers)
    // Non-kredit dihitung berdasarkan createdAt hari ini, Kredit yang lunas hari ini dihitung berdasarkan paidAt
    const sales = await (prisma.sale.findMany as any)({
      where: {
        OR: [
          { createdAt: dateFilter },
          {
            paymentMethod: "CREDIT",
            paymentStatus: "PAID",
            paidAt: dateFilter,
          },
        ],
      },
      include: {
        items: {
          include: {
            product: true,
            voucher: true,
          },
        },
        cashier: {
          select: { id: true, name: true },
        },
        customer: {
          select: { id: true, name: true, phone: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    let posRevenue = 0;
    let posCost = 0;
    let posProfit = 0;
    let posProductItemsCount = 0;

    let voucherRevenue = 0;
    let voucherCost = 0;
    let voucherProfit = 0;
    let voucherSoldPcs = 0;

    // Metrik Uang Kas Fisik di Laci Periode Ini (WIB)
    let cashPos = 0;
    let cashVoucher = 0;
    let cashSettledDebt = 0;
    let nonCashPos = 0;
    let nonCashVoucher = 0;
    let nonCashSettledDebt = 0;
    const settledDebtList: Array<{
      id: string;
      invoiceNumber: string;
      customerName: string;
      finalAmount: number;
      paidMethod: string;
      paidAt: string;
    }> = [];

    const operatorVoucherMap: Record<string, { operator: string; qty: number; revenue: number; profit: number }> = {};
    const topProductsMap: Record<string, { id: string; name: string; qty: number; revenue: number; profit: number }> = {};
    const topVouchersMap: Record<string, { id: string; name: string; qty: number; revenue: number; profit: number }> = {};

    for (const sale of sales) {
      const isCreatedInPeriod = sale.createdAt >= startDate && sale.createdAt <= endDate;
      const isSettledInPeriod = sale.paidAt && sale.paidAt >= startDate && sale.paidAt <= endDate;

      // Omzet & Profit dihitung saat transaksi dibuat
      if (isCreatedInPeriod) {
        for (const item of sale.items) {
          if (item.itemType === "PRODUCT") {
            posRevenue += item.subtotal;
            posCost += item.costPrice * item.quantity;
            posProfit += item.profit;
            posProductItemsCount += item.quantity;

            const pKey = item.productId || item.itemName;
            if (!topProductsMap[pKey]) {
              topProductsMap[pKey] = {
                id: pKey,
                name: item.itemName,
                qty: 0,
                revenue: 0,
                profit: 0,
              };
            }
            topProductsMap[pKey].qty += item.quantity;
            topProductsMap[pKey].revenue += item.subtotal;
            topProductsMap[pKey].profit += item.profit;
          } else if (item.itemType === "VOUCHER") {
            voucherRevenue += item.subtotal;
            voucherCost += item.costPrice * item.quantity;
            voucherProfit += item.profit;
            voucherSoldPcs += item.quantity;

            const op = item.voucher?.operator || "Lainnya";
            if (!operatorVoucherMap[op]) {
              operatorVoucherMap[op] = { operator: op, qty: 0, revenue: 0, profit: 0 };
            }
            operatorVoucherMap[op].qty += item.quantity;
            operatorVoucherMap[op].revenue += item.subtotal;
            operatorVoucherMap[op].profit += item.profit;

            const vKey = item.voucherId || item.itemName;
            if (!topVouchersMap[vKey]) {
              topVouchersMap[vKey] = {
                id: vKey,
                name: item.itemName,
                qty: 0,
                revenue: 0,
                profit: 0,
              };
            }
            topVouchersMap[vKey].qty += item.quantity;
            topVouchersMap[vKey].revenue += item.subtotal;
            topVouchersMap[vKey].profit += item.profit;
          }
        }
      }

      // Arus Kas Fisik & Non-Tunai
      if (sale.paymentMethod === "CASH" && isCreatedInPeriod) {
        for (const item of sale.items) {
          if (item.itemType === "PRODUCT") {
            cashPos += item.subtotal;
          } else if (item.itemType === "VOUCHER") {
            cashVoucher += item.subtotal;
          }
        }
      } else if (sale.paymentMethod === "CREDIT" && isSettledInPeriod) {
        // Pelunasan nota piutang dihitung pada hari nota dilunaskan (paidAt)
        const method = (sale.paidMethod || "CASH").toUpperCase();
        const amountPaid =
          sale.paymentStatus === "PAID"
            ? sale.finalAmount
            : Math.min(sale.cashGiven || 0, sale.finalAmount);

        if (method === "CASH") {
          cashSettledDebt += amountPaid;
        } else if (method === "QRIS" || method === "TRANSFER") {
          nonCashSettledDebt += amountPaid;
        }

        settledDebtList.push({
          id: sale.id,
          invoiceNumber: sale.invoiceNumber,
          customerName: sale.customer?.name || "Pelanggan Bon",
          finalAmount: amountPaid,
          paidMethod: method,
          paidAt: sale.paidAt ? sale.paidAt.toISOString() : "",
        });
      } else if (isCreatedInPeriod && (sale.paymentMethod === "QRIS" || sale.paymentMethod === "TRANSFER")) {
        for (const item of sale.items) {
          if (item.itemType === "PRODUCT") {
            nonCashPos += item.subtotal;
          } else if (item.itemType === "VOUCHER") {
            nonCashVoucher += item.subtotal;
          }
        }
      }
    }

    // 2. Fetch Digital Transactions (PPOB)
    const digitalTrx = await prisma.digitalTransaction.findMany({
      where: { createdAt: dateFilter },
      include: {
        digitalProduct: true,
        cashier: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const digitalSuccess = digitalTrx.filter((t) => t.status === "SUCCESS");
    const digitalRevenue = digitalSuccess.reduce((sum, t) => sum + t.sellingPrice, 0);
    const digitalCost = digitalSuccess.reduce((sum, t) => sum + t.costPrice, 0);
    const digitalProfit = digitalSuccess.reduce((sum, t) => sum + t.profit, 0);
    const digitalPendingCount = digitalTrx.filter((t) => t.status === "PENDING").length;
    const digitalFailedCount = digitalTrx.filter(
      (t) => t.status === "FAILED" || t.status === "REFUNDED"
    ).length;

    let cashDigital = 0;
    let nonCashDigital = 0;
    let cashDigitalCount = 0;
    let nonCashDigitalCount = 0;
    for (const trx of digitalSuccess) {
      if (((trx as any).paymentMethod || "CASH").toUpperCase() === "QRIS") {
        nonCashDigital += trx.sellingPrice;
        nonCashDigitalCount += 1;
      } else {
        cashDigital += trx.sellingPrice;
        cashDigitalCount += 1;
      }
    }

    const digitalCategoryMap: Record<string, { category: string; count: number; revenue: number; profit: number }> = {};
    for (const trx of digitalSuccess) {
      const cat = trx.digitalProduct?.category || "PULSA";
      if (!digitalCategoryMap[cat]) {
        digitalCategoryMap[cat] = { category: cat, count: 0, revenue: 0, profit: 0 };
      }
      digitalCategoryMap[cat].count += 1;
      digitalCategoryMap[cat].revenue += trx.sellingPrice;
      digitalCategoryMap[cat].profit += trx.profit;
    }

    // 3. Fetch Service Records (Jasa Servis & Teknisi HP)
    // Hanya servis yang SUDAH SELESAI / DIAMBIL (status: COMPLETED) dan LUNAS (paymentStatus: PAID)
    // Servis yang belum diambil (PENDING / IN_PROGRESS / UNPAID) belum masuk ke buku servis.
    const services = await (prisma as any).serviceRecord.findMany({
      where: {
        status: "COMPLETED",
        paymentStatus: "PAID",
        OR: [
          { completedAt: dateFilter },
          { completedAt: null, createdAt: dateFilter },
        ],
      },
      include: {
        technician: { select: { id: true, name: true } },
        cashier: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const serviceRevenue = services.reduce((sum: number, s: any) => sum + (s.serviceFee || 0), 0);
    const serviceSparepartCost = services.reduce((sum: number, s: any) => sum + (s.sparepartCost || 0), 0);
    const serviceTechnicianFee = services.reduce((sum: number, s: any) => sum + (s.technicianFee || 0), 0);
    const serviceStoreProfit = services.reduce((sum: number, s: any) => sum + (s.storeProfit || 0), 0);
    const serviceCost = serviceSparepartCost + serviceTechnicianFee;

    const technicianMap: Record<string, { id: string; name: string; count: number; revenue: number; commission: number; storeProfit: number }> = {};
    for (const s of services) {
      const techId = s.technician?.id || "unknown";
      const techName = s.technician?.name || "Teknisi";
      if (!technicianMap[techId]) {
        technicianMap[techId] = { id: techId, name: techName, count: 0, revenue: 0, commission: 0, storeProfit: 0 };
      }
      technicianMap[techId].count += 1;
      technicianMap[techId].revenue += s.serviceFee || 0;
      technicianMap[techId].commission += s.technicianFee || 0;
      technicianMap[techId].storeProfit += s.storeProfit || 0;
    }

    let cashService = 0;
    let nonCashService = 0;
    for (const s of services) {
      if (s.paymentMethod === "CASH") {
        cashService += s.serviceFee || 0;
      } else {
        nonCashService += s.serviceFee || 0;
      }
    }

    // 4. Fetch Expenses
    const expenses = await prisma.expense.findMany({
      where: { date: dateFilter },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { date: "desc" },
    });

    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const cashExpense = totalExpenses; // Pengeluaran kas operasional tunai

    const expenseCategoryMap: Record<string, number> = {
      ELECTRICITY: 0,
      INTERNET: 0,
      RENT: 0,
      OPERATIONAL: 0,
      TRANSPORT: 0,
      SALARY: 0,
      OTHER: 0,
    };
    for (const e of expenses) {
      expenseCategoryMap[e.category] = (expenseCategoryMap[e.category] || 0) + e.amount;
    }

    // 5. Total Rekonsiliasi Uang Kas Fisik di Laci (WIB)
    const totalCashIn = cashPos + cashVoucher + cashService + cashDigital + cashSettledDebt;
    const netDrawerCash = Math.max(0, totalCashIn - cashExpense);
    const totalNonCash = nonCashPos + nonCashVoucher + nonCashDigital + nonCashService + nonCashSettledDebt;

    // 6. Combined Financial Calculation (P&L) - Inclusive of Service Division
    const totalGrossRevenue = posRevenue + voucherRevenue + digitalRevenue + serviceRevenue;
    const totalCOGS = posCost + voucherCost + digitalCost + serviceCost;
    const totalGrossProfit = posProfit + voucherProfit + digitalProfit + serviceStoreProfit;
    const netProfit = totalGrossProfit - totalExpenses;

    const grossMarginPercent = totalGrossRevenue > 0 ? (totalGrossProfit / totalGrossRevenue) * 100 : 0;
    const netMarginPercent = totalGrossRevenue > 0 ? (netProfit / totalGrossRevenue) * 100 : 0;
    const opexRatioPercent = totalGrossProfit > 0 ? (totalExpenses / totalGrossProfit) * 100 : 0;

    return NextResponse.json({
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        periodLabel,
      },
      summary: {
        totalGrossRevenue,
        totalCOGS,
        totalGrossProfit,
        totalExpenses,
        netProfit,
        grossMarginPercent: Number(grossMarginPercent.toFixed(1)),
        netMarginPercent: Number(netMarginPercent.toFixed(1)),
        opexRatioPercent: Number(opexRatioPercent.toFixed(1)),
      },
      physicalCash: {
        posCash: cashPos,
        voucherCash: cashVoucher,
        serviceCash: cashService,
        digitalCash: cashDigital,
        settledDebtCash: cashSettledDebt,
        expenseCash: cashExpense,
        totalCashIn,
        netDrawerCash,
        nonCash: {
          pos: nonCashPos,
          voucher: nonCashVoucher,
          digital: nonCashDigital,
          service: nonCashService,
          settledDebt: nonCashSettledDebt,
          total: totalNonCash,
        },
        settledDebtList,
        timezone: "WIB (UTC+7)",
        periodLabel,
      },
      channels: {
        posRetail: {
          revenue: posRevenue,
          cost: posCost,
          profit: posProfit,
          marginPercent: posRevenue > 0 ? Number(((posProfit / posRevenue) * 100).toFixed(1)) : 0,
          itemsCount: posProductItemsCount,
          topProducts: Object.values(topProductsMap).sort((a, b) => b.qty - a.qty).slice(0, 10),
        },
        voucher: {
          revenue: voucherRevenue,
          cost: voucherCost,
          profit: voucherProfit,
          marginPercent: voucherRevenue > 0 ? Number(((voucherProfit / voucherRevenue) * 100).toFixed(1)) : 0,
          soldPcs: voucherSoldPcs,
          operatorBreakdown: Object.values(operatorVoucherMap).sort((a, b) => b.qty - a.qty),
          topVouchers: Object.values(topVouchersMap).sort((a, b) => b.qty - a.qty).slice(0, 10),
        },
        digital: {
          revenue: digitalRevenue,
          cost: digitalCost,
          profit: digitalProfit,
          cashRevenue: cashDigital,
          nonCashRevenue: nonCashDigital,
          cashCount: cashDigitalCount,
          nonCashCount: nonCashDigitalCount,
          marginPercent: digitalRevenue > 0 ? Number(((digitalProfit / digitalRevenue) * 100).toFixed(1)) : 0,
          totalCount: digitalTrx.length,
          successCount: digitalSuccess.length,
          pendingCount: digitalPendingCount,
          failedCount: digitalFailedCount,
          categoryBreakdown: Object.values(digitalCategoryMap).sort((a, b) => b.revenue - a.revenue),
        },
        service: {
          revenue: serviceRevenue,
          cost: serviceCost,
          sparepartCost: serviceSparepartCost,
          technicianFee: serviceTechnicianFee,
          profit: serviceStoreProfit,
          marginPercent: serviceRevenue > 0 ? Number(((serviceStoreProfit / serviceRevenue) * 100).toFixed(1)) : 0,
          totalCount: services.length,
          technicianBreakdown: Object.values(technicianMap).sort((a, b) => b.revenue - a.revenue),
          recentServices: services.slice(0, 30),
        },
      },
      expenses: {
        total: totalExpenses,
        categoryBreakdown: expenseCategoryMap,
        recentExpenses: expenses.slice(0, 30),
      },
      rawSalesList: sales.slice(0, 50),
    });
  } catch (error) {
    console.error("GET Reports Summary Error:", error);
    return NextResponse.json({ error: "Gagal menyusun laporan keuangan" }, { status: 500 });
  }
}

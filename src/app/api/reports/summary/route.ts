import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "OWNER") {
    return NextResponse.json({ error: "Akses ditolak. Khusus Owner." }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    // Default to current month if not specified
    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const startDate = startDateParam ? new Date(startDateParam) : defaultStart;
    const endDate = endDateParam ? new Date(endDateParam) : defaultEnd;

    const dateFilter = {
      gte: startDate,
      lte: endDate,
    };

    // 1. Fetch Sales (POS Retail & Vouchers)
    const sales = await prisma.sale.findMany({
      where: { createdAt: dateFilter },
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

    const operatorVoucherMap: Record<string, { operator: string; qty: number; revenue: number; profit: number }> = {};
    const topProductsMap: Record<string, { id: string; name: string; qty: number; revenue: number; profit: number }> = {};
    const topVouchersMap: Record<string, { id: string; name: string; qty: number; revenue: number; profit: number }> = {};

    for (const sale of sales) {
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

    // 3. Fetch Expenses
    const expenses = await prisma.expense.findMany({
      where: { date: dateFilter },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { date: "desc" },
    });

    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
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

    // 4. Combined Financial Calculation (P&L)
    const totalGrossRevenue = posRevenue + voucherRevenue + digitalRevenue;
    const totalCOGS = posCost + voucherCost + digitalCost;
    const totalGrossProfit = posProfit + voucherProfit + digitalProfit;
    const netProfit = totalGrossProfit - totalExpenses;

    const grossMarginPercent = totalGrossRevenue > 0 ? (totalGrossProfit / totalGrossRevenue) * 100 : 0;
    const netMarginPercent = totalGrossRevenue > 0 ? (netProfit / totalGrossRevenue) * 100 : 0;
    const opexRatioPercent = totalGrossProfit > 0 ? (totalExpenses / totalGrossProfit) * 100 : 0;

    return NextResponse.json({
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
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
          marginPercent: digitalRevenue > 0 ? Number(((digitalProfit / digitalRevenue) * 100).toFixed(1)) : 0,
          totalCount: digitalTrx.length,
          successCount: digitalSuccess.length,
          pendingCount: digitalPendingCount,
          failedCount: digitalFailedCount,
          categoryBreakdown: Object.values(digitalCategoryMap).sort((a, b) => b.revenue - a.revenue),
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

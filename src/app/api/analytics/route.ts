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
    const rangeDays = parseInt(searchParams.get("days") || "30", 10);

    const now = new Date();
    const startDate = new Date();
    startDate.setDate(now.getDate() - rangeDays);
    startDate.setHours(0, 0, 0, 0);

    const dateFilter = {
      gte: startDate,
      lte: now,
    };

    // 1. Fetch Sales in Date Range
    const sales = await prisma.sale.findMany({
      where: { createdAt: dateFilter },
      include: {
        items: {
          include: {
            product: true,
            voucher: true,
          },
        },
      },
    });

    let posRevenue = 0;
    let posCost = 0;
    let posProfit = 0;
    let posQty = 0;

    let voucherRevenue = 0;
    let voucherCost = 0;
    let voucherProfit = 0;
    let voucherQty = 0;

    const topProductMap: Record<string, { id: string; name: string; qty: number; revenue: number; profit: number }> = {};
    const topVoucherMap: Record<string, { id: string; name: string; operator: string; qty: number; revenue: number; profit: number }> = {};
    const operatorShareMap: Record<string, { operator: string; qty: number; revenue: number; profit: number }> = {};

    for (const s of sales) {
      for (const item of s.items) {
        if (item.itemType === "PRODUCT") {
          posRevenue += item.subtotal;
          posCost += item.costPrice * item.quantity;
          posProfit += item.profit;
          posQty += item.quantity;

          const pKey = item.productId || item.itemName;
          if (!topProductMap[pKey]) {
            topProductMap[pKey] = {
              id: pKey,
              name: item.itemName,
              qty: 0,
              revenue: 0,
              profit: 0,
            };
          }
          topProductMap[pKey].qty += item.quantity;
          topProductMap[pKey].revenue += item.subtotal;
          topProductMap[pKey].profit += item.profit;
        } else if (item.itemType === "VOUCHER") {
          voucherRevenue += item.subtotal;
          voucherCost += item.costPrice * item.quantity;
          voucherProfit += item.profit;
          voucherQty += item.quantity;

          const op = item.voucher?.operator || "Lainnya";
          if (!operatorShareMap[op]) {
            operatorShareMap[op] = { operator: op, qty: 0, revenue: 0, profit: 0 };
          }
          operatorShareMap[op].qty += item.quantity;
          operatorShareMap[op].revenue += item.subtotal;
          operatorShareMap[op].profit += item.profit;

          const vKey = item.voucherId || item.itemName;
          if (!topVoucherMap[vKey]) {
            topVoucherMap[vKey] = {
              id: vKey,
              name: item.itemName,
              operator: op,
              qty: 0,
              revenue: 0,
              profit: 0,
            };
          }
          topVoucherMap[vKey].qty += item.quantity;
          topVoucherMap[vKey].revenue += item.subtotal;
          topVoucherMap[vKey].profit += item.profit;
        }
      }
    }

    // 2. Fetch Digital Transactions in Date Range
    const digitalTrx = await prisma.digitalTransaction.findMany({
      where: { createdAt: dateFilter, status: "SUCCESS" },
      include: { digitalProduct: true },
    });

    const digitalRevenue = digitalTrx.reduce((sum, d) => sum + d.sellingPrice, 0);
    const digitalCost = digitalTrx.reduce((sum, d) => sum + d.costPrice, 0);
    const digitalProfit = digitalTrx.reduce((sum, d) => sum + d.profit, 0);

    const digitalCategoryShare: Record<string, { category: string; count: number; revenue: number; profit: number }> = {};
    for (const trx of digitalTrx) {
      const cat = trx.digitalProduct?.category || "PULSA";
      if (!digitalCategoryShare[cat]) {
        digitalCategoryShare[cat] = { category: cat, count: 0, revenue: 0, profit: 0 };
      }
      digitalCategoryShare[cat].count += 1;
      digitalCategoryShare[cat].revenue += trx.sellingPrice;
      digitalCategoryShare[cat].profit += trx.profit;
    }

    // 3. Fetch Expenses
    const expenses = await prisma.expense.findMany({
      where: { date: dateFilter },
    });
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    // 4. Combined Metrics
    const totalGrossRevenue = posRevenue + voucherRevenue + digitalRevenue;
    const totalGrossProfit = posProfit + voucherProfit + digitalProfit;
    const netProfit = totalGrossProfit - totalExpenses;

    const posMargin = posRevenue > 0 ? (posProfit / posRevenue) * 100 : 0;
    const voucherMargin = voucherRevenue > 0 ? (voucherProfit / voucherRevenue) * 100 : 0;
    const digitalMargin = digitalRevenue > 0 ? (digitalProfit / digitalRevenue) * 100 : 0;
    const overallGrossMargin = totalGrossRevenue > 0 ? (totalGrossProfit / totalGrossRevenue) * 100 : 0;
    const netMargin = totalGrossRevenue > 0 ? (netProfit / totalGrossRevenue) * 100 : 0;

    // Profit share breakdown
    const posProfitShare = totalGrossProfit > 0 ? (posProfit / totalGrossProfit) * 100 : 0;
    const voucherProfitShare = totalGrossProfit > 0 ? (voucherProfit / totalGrossProfit) * 100 : 0;
    const digitalProfitShare = totalGrossProfit > 0 ? (digitalProfit / totalGrossProfit) * 100 : 0;

    // Average Order Value (AOV)
    const totalTrxCount = sales.length + digitalTrx.length;
    const averageOrderValue = totalTrxCount > 0 ? Math.round(totalGrossRevenue / totalTrxCount) : 0;
    const averageProfitPerTrx = totalTrxCount > 0 ? Math.round(totalGrossProfit / totalTrxCount) : 0;

    // Opex to Revenue & Gross Profit
    const expenseToRevenueRatio = totalGrossRevenue > 0 ? (totalExpenses / totalGrossRevenue) * 100 : 0;
    const expenseToProfitRatio = totalGrossProfit > 0 ? (totalExpenses / totalGrossProfit) * 100 : 0;

    // Daily Trend for charts (Last 14 or 30 days)
    const trendDaysCount = Math.min(rangeDays, 14);
    const trendData: { date: string; revenue: number; profit: number; expenses: number }[] = [];

    for (let i = trendDaysCount - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
      const dEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
      const label = d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });

      const [dSales, dDig, dExp] = await Promise.all([
        prisma.sale.findMany({
          where: { createdAt: { gte: dStart, lte: dEnd } },
          include: { items: true },
        }),
        prisma.digitalTransaction.findMany({
          where: { createdAt: { gte: dStart, lte: dEnd }, status: "SUCCESS" },
        }),
        prisma.expense.findMany({
          where: { date: { gte: dStart, lte: dEnd } },
        }),
      ]);

      const rev =
        dSales.reduce((sum, s) => sum + s.finalAmount, 0) +
        dDig.reduce((sum, d) => sum + d.sellingPrice, 0);

      const prof =
        dSales.reduce((sum, s) => sum + s.items.reduce((acc, it) => acc + it.profit, 0), 0) +
        dDig.reduce((sum, d) => sum + d.profit, 0);

      const exp = dExp.reduce((sum, e) => sum + e.amount, 0);

      trendData.push({ date: label, revenue: rev, profit: prof, expenses: exp });
    }

    // Smart Generated Insights based on real calculations
    const insights: { type: "SUCCESS" | "WARNING" | "INFO"; title: string; desc: string }[] = [];

    // Insight 1: Most profitable channel
    const channels = [
      { name: "Aksesoris & Produk POS", margin: posMargin, profit: posProfit, share: posProfitShare },
      { name: "Voucher Fisik", margin: voucherMargin, profit: voucherProfit, share: voucherProfitShare },
      { name: "Produk Digital (PPOB)", margin: digitalMargin, profit: digitalProfit, share: digitalProfitShare },
    ].sort((a, b) => b.margin - a.margin);

    insights.push({
      type: "SUCCESS",
      title: `Channel Margin Tertinggi: ${channels[0].name}`,
      desc: `${channels[0].name} menghasilkan margin keuntungan tertinggi (${channels[0].margin.toFixed(
        1
      )}%) dan menyumbang ${channels[0].share.toFixed(1)}% dari total laba kotor toko.`,
    });

    // Insight 2: Operational Expense Efficiency
    if (expenseToProfitRatio <= 25) {
      insights.push({
        type: "SUCCESS",
        title: "Beban Operasional Sangat Sehat",
        desc: `Beban operasional hanya menghabiskan ${expenseToProfitRatio.toFixed(
          1
        )}% dari laba kotor (di bawah batas ideal 30%). Efisiensi pengeluaran toko sangat prima.`,
      });
    } else if (expenseToProfitRatio <= 45) {
      insights.push({
        type: "INFO",
        title: "Beban Operasional Dalam Batas Wajar",
        desc: `Beban operasional menyerap ${expenseToProfitRatio.toFixed(
          1
        )}% dari laba kotor. Terus jaga pengeluaran rutin seperti utilitas dan konsumsi operasional.`,
      });
    } else {
      insights.push({
        type: "WARNING",
        title: "Peringatan: Beban Operasional Cukup Tinggi",
        desc: `Beban operasional telah menyerap ${expenseToProfitRatio.toFixed(
          1
        )}% dari laba kotor toko. Disarankan mengevaluasi pos-pos pengeluaran terbesar.`,
      });
    }

    // Insight 3: Top Operator in Physical Vouchers
    const sortedOperators = Object.values(operatorShareMap).sort((a, b) => b.qty - a.qty);
    if (sortedOperators.length > 0) {
      const topOp = sortedOperators[0];
      const opPct = voucherQty > 0 ? ((topOp.qty / voucherQty) * 100).toFixed(1) : "0";
      insights.push({
        type: "INFO",
        title: `Operator Terlaris: ${topOp.operator}`,
        desc: `Voucher fisik ${topOp.operator} mendominasi ${opPct}% (${topOp.qty} pcs) dari seluruh penjualan voucher fisik periode ini. Pastikan ketersediaan stok fisik ${topOp.operator} selalu terjaga.`,
      });
    }

    // Insight 4: Average Order Value
    insights.push({
      type: "INFO",
      title: "Rata-rata Nilai Transaksi (AOV)",
      desc: `Setiap transaksi pelanggan rata-rata bernilai Rp ${averageOrderValue.toLocaleString(
        "id-ID"
      )} dengan kontribusi keuntungan rata-rata Rp ${averageProfitPerTrx.toLocaleString(
        "id-ID"
      )} per transaksi.`,
    });

    return NextResponse.json({
      periodDays: rangeDays,
      summary: {
        totalGrossRevenue,
        totalGrossProfit,
        totalExpenses,
        netProfit,
        overallGrossMargin: Number(overallGrossMargin.toFixed(1)),
        netMargin: Number(netMargin.toFixed(1)),
        averageOrderValue,
        averageProfitPerTrx,
        totalTrxCount,
        expenseToRevenueRatio: Number(expenseToRevenueRatio.toFixed(1)),
        expenseToProfitRatio: Number(expenseToProfitRatio.toFixed(1)),
      },
      channelComparison: [
        {
          channel: "POS Aksesoris",
          revenue: posRevenue,
          cost: posCost,
          profit: posProfit,
          margin: Number(posMargin.toFixed(1)),
          profitShare: Number(posProfitShare.toFixed(1)),
          volume: posQty,
          unit: "unit",
        },
        {
          channel: "Voucher Fisik",
          revenue: voucherRevenue,
          cost: voucherCost,
          profit: voucherProfit,
          margin: Number(voucherMargin.toFixed(1)),
          profitShare: Number(voucherProfitShare.toFixed(1)),
          volume: voucherQty,
          unit: "pcs",
        },
        {
          channel: "Produk Digital",
          revenue: digitalRevenue,
          cost: digitalCost,
          profit: digitalProfit,
          margin: Number(digitalMargin.toFixed(1)),
          profitShare: Number(digitalProfitShare.toFixed(1)),
          volume: digitalTrx.length,
          unit: "trx",
        },
      ],
      topProducts: Object.values(topProductMap).sort((a, b) => b.qty - a.qty).slice(0, 5),
      topVouchers: Object.values(topVoucherMap).sort((a, b) => b.qty - a.qty).slice(0, 5),
      operatorShares: sortedOperators,
      digitalShares: Object.values(digitalCategoryShare).sort((a, b) => b.revenue - a.revenue),
      trendData,
      insights,
    });
  } catch (error) {
    console.error("GET Business Analytics Error:", error);
    return NextResponse.json({ error: "Gagal mengambil data analisis bisnis" }, { status: 500 });
  }
}

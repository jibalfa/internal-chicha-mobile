import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isOwner = session.role === "OWNER";

  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const todayFilter = {
      gte: todayStart,
      lte: todayEnd,
    };

    // 1. Sales Today (POS & Vouchers)
    const salesToday = await prisma.sale.findMany({
      where: { createdAt: todayFilter },
      include: { items: true },
    });

    let todayPosRevenue = 0;
    let todayPosProfit = 0;
    let todayVoucherRevenue = 0;
    let todayVoucherProfit = 0;
    let todayVoucherSoldQty = 0;
    let todayProductSoldQty = 0;

    for (const s of salesToday) {
      for (const item of s.items) {
        if (item.itemType === "PRODUCT") {
          todayPosRevenue += item.subtotal;
          todayPosProfit += item.profit;
          todayProductSoldQty += item.quantity;
        } else if (item.itemType === "VOUCHER") {
          todayVoucherRevenue += item.subtotal;
          todayVoucherProfit += item.profit;
          todayVoucherSoldQty += item.quantity;
        }
      }
    }

    // 2. Digital Transactions Today
    const digitalToday = await prisma.digitalTransaction.findMany({
      where: { createdAt: todayFilter },
    });

    const digitalSuccess = digitalToday.filter((d) => d.status === "SUCCESS");
    const todayDigitalRevenue = digitalSuccess.reduce((sum, d) => sum + d.sellingPrice, 0);
    const todayDigitalProfit = digitalSuccess.reduce((sum, d) => sum + d.profit, 0);
    const todayDigitalPending = digitalToday.filter((d) => d.status === "PENDING").length;

    // 3. Expenses Today (Owner only)
    let todayExpenses = 0;
    if (isOwner) {
      const expensesToday = await prisma.expense.findMany({
        where: { date: todayFilter },
      });
      todayExpenses = expensesToday.reduce((sum, e) => sum + e.amount, 0);
    }

    // 4. Combined Financial Metrics Today
    const todayGrossRevenue = isOwner ? todayPosRevenue + todayVoucherRevenue + todayDigitalRevenue : 0;
    const todayTransactions = salesToday.length + digitalToday.length;
    const todayGrossProfit = isOwner ? todayPosProfit + todayVoucherProfit + todayDigitalProfit : 0;
    const todayNetProfit = isOwner ? todayGrossProfit - todayExpenses : 0;

    // 5. Total Voucher Physical Stock in Store
    const vouchers = await prisma.voucher.findMany({ where: { isActive: true } });
    const totalVoucherStock = vouchers.reduce((sum, v) => sum + v.stock, 0);
    const lowStockVouchers = vouchers.filter((v) => v.stock <= v.minStock).length;

    // 6. Low Stock Products Alert (stock <= minStock)
    const products = await prisma.product.findMany({ where: { isActive: true } });
    const lowStockProducts = products.filter((p) => p.stock <= p.minStock);

    // 7. Recent Transactions for Activity Feed
    const [recentSales, recentDigital, recentVoucherMovements] = await Promise.all([
      prisma.sale.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: {
          cashier: { select: { name: true } },
          items: true,
        },
      }),
      prisma.digitalTransaction.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: { digitalProduct: true },
      }),
      prisma.voucherMovement.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: { voucher: true },
      }),
    ]);

    // 8. 7-Days Revenue & Profit Trend Data for Chart (Owner only)
    const trendDays: { date: string; revenue: number; profit: number; expenses: number }[] = [];
    if (isOwner) {
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
        const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
        const dayLabel = d.toLocaleDateString("id-ID", { weekday: "short", day: "numeric" });

        const [daySales, dayDigital, dayExp] = await Promise.all([
          prisma.sale.findMany({
            where: { createdAt: { gte: dayStart, lte: dayEnd } },
            include: { items: true },
          }),
          prisma.digitalTransaction.findMany({
            where: { createdAt: { gte: dayStart, lte: dayEnd }, status: "SUCCESS" },
          }),
          prisma.expense.findMany({
            where: { date: { gte: dayStart, lte: dayEnd } },
          }),
        ]);

        const rev =
          daySales.reduce((sum, s) => sum + s.finalAmount, 0) +
          dayDigital.reduce((sum, d) => sum + d.sellingPrice, 0);

        const prof =
          daySales.reduce((sum, s) => sum + s.items.reduce((acc, it) => acc + it.profit, 0), 0) +
          dayDigital.reduce((sum, d) => sum + d.profit, 0);

        const exp = dayExp.reduce((sum, e) => sum + e.amount, 0);

        trendDays.push({ date: dayLabel, revenue: rev, profit: prof, expenses: exp });
      }
    }

    return NextResponse.json({
      role: session.role,
      isOwner,
      metrics: {
        // Financials (available to OWNER only)
        todayRevenue: isOwner ? todayGrossRevenue : 0,
        todayGrossProfit: isOwner ? todayGrossProfit : 0,
        todayExpenses: isOwner ? todayExpenses : 0,
        todayNetProfit: isOwner ? todayNetProfit : 0,
        todayPosRevenue: isOwner ? todayPosRevenue : 0,
        todayPosProfit: isOwner ? todayPosProfit : 0,
        todayVoucherRevenue: isOwner ? todayVoucherRevenue : 0,
        todayVoucherProfit: isOwner ? todayVoucherProfit : 0,
        todayDigitalRevenue: isOwner ? todayDigitalRevenue : 0,
        todayDigitalProfit: isOwner ? todayDigitalProfit : 0,

        // Operational Counts (Safe for CASHIER)
        todayTransactions,
        todayProductSoldQty,
        todayVoucherSoldQty,
        totalVoucherStock,
        lowStockVouchers,
        lowStockCount: lowStockProducts.length,
        digitalTotal: digitalToday.length,
        digitalSuccess: digitalSuccess.length,
        digitalPending: todayDigitalPending,
      },
      lowStockItems: lowStockProducts.slice(0, 5),
      recentActivities: {
        sales: recentSales.map((s) => ({
          id: s.id,
          invoiceNumber: s.invoiceNumber,
          cashierName: s.cashier?.name || "Kasir",
          paymentMethod: s.paymentMethod,
          finalAmount: s.finalAmount,
        })),
        digital: recentDigital,
        voucherMovements: recentVoucherMovements,
      },
      trend: isOwner ? trendDays : [],
    });
  } catch (error) {
    console.error("GET Dashboard Stats Error:", error);
    return NextResponse.json({ error: "Gagal mengambil data statistik dashboard" }, { status: 500 });
  }
}

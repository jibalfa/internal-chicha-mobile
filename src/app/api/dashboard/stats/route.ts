import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWIBTodayRange, getWIBDayRange, getWIBDateString } from "@/lib/wibTime";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isOwner = session.role === "OWNER";

  try {
    // Zona Waktu WIB (UTC+7) - Dari 00:00:00 WIB sampai 23:59:59.999 WIB
    const { startDate: todayStart, endDate: todayEnd, displayDate } = getWIBTodayRange();

    const todayFilter = {
      gte: todayStart,
      lte: todayEnd,
    };

    const now = new Date();

    // 1. Sales Today (POS & Vouchers)
    // Non-kredit dihitung berdasarkan createdAt hari ini, Kredit yang lunas hari ini dihitung berdasarkan paidAt
    const salesToday = await (prisma.sale.findMany as any)({
      where: {
        OR: [
          { createdAt: todayFilter },
          {
            paymentMethod: "CREDIT",
            paymentStatus: "PAID",
            paidAt: todayFilter,
          },
        ],
      },
      include: {
        items: true,
        customer: { select: { name: true, phone: true } },
      },
    });

    let todayPosRevenue = 0;
    let todayPosProfit = 0;
    let todayVoucherRevenue = 0;
    let todayVoucherProfit = 0;
    let todayVoucherSoldQty = 0;
    let todayProductSoldQty = 0;

    // Metrik Uang Kas Fisik di Laci Hari Ini (WIB)
    let todayCashPos = 0;
    let todayCashVoucher = 0;
    let todayCashSettledDebt = 0;
    let todayNonCashPos = 0;
    let todayNonCashVoucher = 0;
    let todayNonCashSettledDebt = 0;
    const settledDebtList: Array<{
      id: string;
      invoiceNumber: string;
      customerName: string;
      finalAmount: number;
      paidMethod: string;
      paidAt: string;
    }> = [];

    for (const s of salesToday) {
      const isCreatedToday = s.createdAt >= todayStart && s.createdAt <= todayEnd;
      const isSettledToday = s.paidAt && s.paidAt >= todayStart && s.paidAt <= todayEnd;

      // Omzet & Profit dihitung saat transaksi dibuat (Akrual)
      if (isCreatedToday) {
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

      // Arus Kas Fisik & Non-Tunai
      if (s.paymentMethod === "CASH" && isCreatedToday) {
        for (const item of s.items) {
          if (item.itemType === "PRODUCT") {
            todayCashPos += item.subtotal;
          } else if (item.itemType === "VOUCHER") {
            todayCashVoucher += item.subtotal;
          }
        }
      } else if (s.paymentMethod === "CREDIT" && isSettledToday) {
        // Pelunasan nota piutang dihitung pada hari nota dilunaskan (paidAt)
        const method = (s.paidMethod || "CASH").toUpperCase();
        const amountPaid =
          s.paymentStatus === "PAID"
            ? s.finalAmount
            : Math.min(s.cashGiven || 0, s.finalAmount);

        if (method === "CASH") {
          todayCashSettledDebt += amountPaid;
        } else if (method === "QRIS" || method === "TRANSFER") {
          todayNonCashSettledDebt += amountPaid;
        }

        settledDebtList.push({
          id: s.id,
          invoiceNumber: s.invoiceNumber,
          customerName: s.customer?.name || "Pelanggan Bon",
          finalAmount: amountPaid,
          paidMethod: method,
          paidAt: s.paidAt ? s.paidAt.toISOString() : "",
        });
      } else if (isCreatedToday && (s.paymentMethod === "QRIS" || s.paymentMethod === "TRANSFER")) {
        for (const item of s.items) {
          if (item.itemType === "PRODUCT") {
            todayNonCashPos += item.subtotal;
          } else if (item.itemType === "VOUCHER") {
            todayNonCashVoucher += item.subtotal;
          }
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

    let todayCashDigital = 0;
    let todayNonCashDigital = 0;
    for (const d of digitalSuccess) {
      if (((d as any).paymentMethod || "CASH").toUpperCase() === "QRIS") {
        todayNonCashDigital += d.sellingPrice;
      } else {
        todayCashDigital += d.sellingPrice;
      }
    }

    // 3. Service Records Today (Jasa Servis HP)
    // Hanya servis yang SUDAH SELESAI / DIAMBIL (status: COMPLETED) dan LUNAS (paymentStatus: PAID)
    // Servis yang belum diambil (PENDING / IN_PROGRESS / UNPAID) belum masuk ke buku servis.
    const servicesToday = await (prisma as any).serviceRecord.findMany({
      where: {
        status: "COMPLETED",
        paymentStatus: "PAID",
        OR: [
          { completedAt: todayFilter },
          { completedAt: null, createdAt: todayFilter },
        ],
      },
      include: {
        technician: { select: { name: true } },
      },
    });

    const todayServiceRevenue = servicesToday.reduce((sum: number, s: any) => sum + (s.serviceFee || 0), 0);
    const todayServiceProfit = servicesToday.reduce((sum: number, s: any) => sum + (s.storeProfit || 0), 0);
    const todayTechnicianFee = servicesToday.reduce((sum: number, s: any) => sum + (s.technicianFee || 0), 0);
    const todayServiceCount = servicesToday.length;

    let todayCashService = 0;
    let todayNonCashService = 0;
    for (const s of servicesToday) {
      if (s.paymentMethod === "CASH") {
        todayCashService += s.serviceFee || 0;
      } else {
        todayNonCashService += s.serviceFee || 0;
      }
    }

    // 4. Expenses Today (Beban Operasional Toko)
    const expensesToday = await prisma.expense.findMany({
      where: { date: todayFilter },
    });
    const todayExpenses = expensesToday.reduce((sum, e) => sum + e.amount, 0);
    const todayCashExpense = todayExpenses; // Beban kas tunai

    // 5. Total Rekonsiliasi Uang Kas Fisik di Laci Kasir (WIB)
    const totalCashIn = todayCashPos + todayCashVoucher + todayCashService + todayCashDigital + todayCashSettledDebt;
    const netDrawerCash = Math.max(0, totalCashIn - todayCashExpense);
    const totalNonCash = todayNonCashPos + todayNonCashVoucher + todayNonCashDigital + todayNonCashService + todayNonCashSettledDebt;

    // 6. Combined Financial Metrics Today
    const todayGrossRevenue = isOwner
      ? todayPosRevenue + todayVoucherRevenue + todayDigitalRevenue + todayServiceRevenue
      : 0;
    const todayTransactions = salesToday.length + digitalToday.length + todayServiceCount;
    const todayGrossProfit = isOwner
      ? todayPosProfit + todayVoucherProfit + todayDigitalProfit + todayServiceProfit
      : 0;
    const todayNetProfit = isOwner ? todayGrossProfit - todayExpenses : 0;

    // 7. Total Voucher Physical Stock in Store
    const vouchers = await prisma.voucher.findMany({ where: { isActive: true } });
    const totalVoucherStock = vouchers.reduce((sum, v) => sum + v.stock, 0);
    const lowStockVouchers = vouchers.filter((v) => v.stock <= v.minStock).length;

    // 7. Low Stock Products Alert (stock <= minStock)
    const products = await prisma.product.findMany({ where: { isActive: true } });
    const lowStockProducts = products.filter((p) => p.stock <= p.minStock);

    // 8. Recent Transactions for Activity Feed
    const [recentSales, recentDigital, recentVoucherMovements, recentServiceRecords] = await Promise.all([
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
      (prisma as any).serviceRecord.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: { technician: { select: { name: true } } },
      }),
    ]);

    // 8. 7-Days Revenue & Profit Trend Data for Chart (Owner only)
    const trendDays: { date: string; revenue: number; profit: number; expenses: number }[] = [];
    if (isOwner) {
      for (let i = 6; i >= 0; i--) {
        const targetMs = todayStart.getTime() - i * 24 * 60 * 60 * 1000;
        const targetDateObj = new Date(targetMs);
        const dateStr = getWIBDateString(targetDateObj);
        const { startOfDay: dayStart, endOfDay: dayEnd } = getWIBDayRange(dateStr);
        const dayLabel = targetDateObj.toLocaleDateString("id-ID", {
          timeZone: "Asia/Jakarta",
          weekday: "short",
          day: "numeric",
        });

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
        todayServiceRevenue: isOwner ? todayServiceRevenue : 0,
        todayServiceProfit: isOwner ? todayServiceProfit : 0,
        todayTechnicianFee: isOwner ? todayTechnicianFee : 0,

        // Operational Counts (Safe for CASHIER)
        todayTransactions,
        todayProductSoldQty,
        todayVoucherSoldQty,
        todayServiceCount,
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
        services: recentServiceRecords,
      },
      physicalCash: {
        posCash: todayCashPos,
        voucherCash: todayCashVoucher,
        serviceCash: todayCashService,
        settledDebtCash: todayCashSettledDebt,
        expenseCash: todayCashExpense,
        totalCashIn,
        netDrawerCash,
        nonCash: {
          pos: todayNonCashPos,
          voucher: todayNonCashVoucher,
          digital: todayDigitalRevenue,
          service: todayNonCashService,
          settledDebt: todayNonCashSettledDebt,
          total: totalNonCash,
        },
        settledDebtList,
        timezone: "WIB (UTC+7)",
        dateLabel: displayDate,
      },
      trend: isOwner ? trendDays : [],
    });
  } catch (error) {
    console.error("GET Dashboard Stats Error:", error);
    return NextResponse.json({ error: "Gagal mengambil data statistik dashboard" }, { status: 500 });
  }
}

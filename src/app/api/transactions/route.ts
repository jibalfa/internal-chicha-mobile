import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isOwner = session.role === "OWNER";
    const { searchParams } = new URL(request.url);

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "10", 10)));
    const skip = (page - 1) * limit;

    const type = (searchParams.get("type") || "POS").toUpperCase(); // "POS" | "DIGITAL"
    const paymentMethod = (searchParams.get("paymentMethod") || "ALL").toUpperCase();
    const search = searchParams.get("search")?.trim() || "";
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const cashierId = searchParams.get("cashierId");

    // Date range setup
    let dateFilter: any = {};
    if (startDateParam || endDateParam) {
      if (startDateParam) {
        const start = new Date(startDateParam);
        start.setHours(0, 0, 0, 0);
        dateFilter.gte = start;
      }
      if (endDateParam) {
        const end = new Date(endDateParam);
        end.setHours(23, 59, 59, 999);
        dateFilter.lte = end;
      }
    }

    if (type === "DIGITAL") {
      // Query Digital Transactions
      const where: any = {};

      if (Object.keys(dateFilter).length > 0) {
        where.createdAt = dateFilter;
      }

      if (cashierId) {
        where.cashierId = cashierId;
      }

      if (search) {
        where.OR = [
          { trxNumber: { contains: search } },
          { destinationNumber: { contains: search } },
          { digitalProduct: { name: { contains: search } } },
          { digitalProduct: { provider: { contains: search } } },
        ];
      }

      const [totalCount, items, allMatching] = await Promise.all([
        prisma.digitalTransaction.count({ where }),
        prisma.digitalTransaction.findMany({
          where,
          include: {
            digitalProduct: true,
            cashier: { select: { id: true, name: true, username: true } },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        // For summary stats calculation
        prisma.digitalTransaction.findMany({
          where,
          select: {
            sellingPrice: true,
            profit: true,
            status: true,
          },
        }),
      ]);

      const totalRevenue = allMatching.reduce((acc, curr) => acc + (curr.sellingPrice || 0), 0);
      const totalProfit = isOwner
        ? allMatching.reduce((acc, curr) => acc + (curr.profit || 0), 0)
        : 0;

      const sanitizedItems = items.map((item) => ({
        id: item.id,
        trxType: "DIGITAL",
        invoiceNumber: item.trxNumber,
        createdAt: item.createdAt,
        destinationNumber: item.destinationNumber,
        productName: `${item.digitalProduct?.provider || ""} ${item.digitalProduct?.name || ""}`.trim(),
        totalAmount: item.sellingPrice,
        discount: 0,
        finalAmount: item.sellingPrice,
        paymentMethod: "CASH",
        cashier: item.cashier,
        status: item.status,
        notes: item.notes,
        profit: isOwner ? item.profit : 0,
        rawItems: [
          {
            id: item.id,
            itemName: `${item.digitalProduct?.provider || ""} ${item.digitalProduct?.name || ""} (${item.destinationNumber})`,
            quantity: 1,
            unitPrice: item.sellingPrice,
            subtotal: item.sellingPrice,
          },
        ],
      }));

      return NextResponse.json({
        data: sanitizedItems,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit) || 1,
          hasNext: page * limit < totalCount,
          hasPrev: page > 1,
        },
        summary: {
          totalCount,
          totalRevenue,
          totalDiscount: 0,
          totalProfit,
          cashAmount: totalRevenue,
          transferAmount: 0,
          qrisAmount: 0,
        },
      });
    }

    // Default: POS Sales (Penjualan Kasir)
    const whereSale: any = {};

    if (Object.keys(dateFilter).length > 0) {
      whereSale.createdAt = dateFilter;
    }

    if (paymentMethod && paymentMethod !== "ALL") {
      whereSale.paymentMethod = paymentMethod;
    }

    if (cashierId) {
      whereSale.cashierId = cashierId;
    }

    if (search) {
      whereSale.OR = [
        { invoiceNumber: { contains: search } },
        { cashier: { name: { contains: search } } },
        { items: { some: { itemName: { contains: search } } } },
      ];
    }

    const [totalCount, sales, allMatchingSales] = await Promise.all([
      prisma.sale.count({ where: whereSale }),
      prisma.sale.findMany({
        where: whereSale,
        include: {
          cashier: { select: { id: true, name: true, username: true } },
          items: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      // For summary stats calculation
      prisma.sale.findMany({
        where: whereSale,
        select: {
          totalAmount: true,
          discount: true,
          finalAmount: true,
          paymentMethod: true,
        },
      }),
    ]);

    let totalRevenue = 0;
    let totalDiscount = 0;
    let cashAmount = 0;
    let transferAmount = 0;
    let qrisAmount = 0;

    allMatchingSales.forEach((s) => {
      totalRevenue += s.finalAmount || 0;
      totalDiscount += s.discount || 0;
      if (s.paymentMethod === "CASH") cashAmount += s.finalAmount || 0;
      else if (s.paymentMethod === "TRANSFER") transferAmount += s.finalAmount || 0;
      else if (s.paymentMethod === "QRIS") qrisAmount += s.finalAmount || 0;
    });

    const sanitizedSales = sales.map((sale) => ({
      id: sale.id,
      trxType: "POS",
      invoiceNumber: sale.invoiceNumber,
      createdAt: sale.createdAt,
      totalAmount: sale.totalAmount,
      discount: sale.discount,
      finalAmount: sale.finalAmount,
      paymentMethod: sale.paymentMethod,
      cashGiven: sale.cashGiven,
      changeGiven: sale.changeGiven,
      notes: sale.notes,
      cashier: sale.cashier,
      itemsCount: sale.items.reduce((acc, curr) => acc + curr.quantity, 0),
      rawItems: sale.items.map((it) => ({
        id: it.id,
        itemType: it.itemType,
        itemName: it.itemName,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        subtotal: it.subtotal,
        costPrice: isOwner ? it.costPrice : 0,
        profit: isOwner ? it.profit : 0,
      })),
    }));

    return NextResponse.json({
      data: sanitizedSales,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit) || 1,
        hasNext: page * limit < totalCount,
        hasPrev: page > 1,
      },
      summary: {
        totalCount,
        totalRevenue,
        totalDiscount,
        cashAmount,
        transferAmount,
        qrisAmount,
      },
    });
  } catch (error: any) {
    console.error("GET Transactions Error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal mengambil riwayat transaksi" },
      { status: 500 }
    );
  }
}

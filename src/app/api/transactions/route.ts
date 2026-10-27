import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWIBDayRange } from "@/lib/wibTime";

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

    // Date range setup (Presisi Zona Waktu WIB UTC+7)
    let dateFilter: any = {};
    if (startDateParam || endDateParam) {
      if (startDateParam && endDateParam) {
        const { startOfDay } = getWIBDayRange(startDateParam);
        const { endOfDay } = getWIBDayRange(endDateParam);
        dateFilter.gte = startOfDay;
        dateFilter.lte = endOfDay;
      } else if (startDateParam) {
        const { startOfDay } = getWIBDayRange(startDateParam);
        dateFilter.gte = startOfDay;
      } else if (endDateParam) {
        const { endOfDay } = getWIBDayRange(endDateParam);
        dateFilter.lte = endOfDay;
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

      if (paymentMethod && paymentMethod !== "ALL") {
        where.paymentMethod = paymentMethod;
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
            paymentMethod: true,
          },
        }),
      ]);

      let totalRevenue = 0;
      let totalProfit = 0;
      let cashAmount = 0;
      let qrisAmount = 0;
      let transferAmount = 0;

      allMatching.forEach((trx: any) => {
        if (trx.status === "SUCCESS") {
          const price = trx.sellingPrice || 0;
          totalRevenue += price;
          if (isOwner) totalProfit += trx.profit || 0;

          const method = ((trx as any).paymentMethod || "CASH").toUpperCase();
          if (method === "QRIS") {
            qrisAmount += price;
          } else if (method === "TRANSFER") {
            transferAmount += price;
          } else {
            cashAmount += price;
          }
        }
      });

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
        paymentMethod: (item as any).paymentMethod || "CASH",
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
          cashAmount,
          transferAmount,
          qrisAmount,
          creditAmount: 0,
        },
      });
    }

    // Default: POS Sales (Penjualan Kasir)
    const conditions: any[] = [];

    if (Object.keys(dateFilter).length > 0) {
      conditions.push({
        OR: [
          { createdAt: dateFilter },
          {
            paymentMethod: "CREDIT",
            paidAt: dateFilter,
          },
        ],
      });
    }

    if (cashierId) {
      conditions.push({ cashierId });
    }

    if (paymentMethod && paymentMethod !== "ALL") {
      if (paymentMethod === "CASH") {
        conditions.push({
          OR: [
            { paymentMethod: "CASH" },
            {
              paymentMethod: "CREDIT",
              paidMethod: "CASH",
              paymentStatus: { in: ["PAID", "PARTIAL"] },
            },
          ],
        });
      } else if (paymentMethod === "QRIS") {
        conditions.push({
          OR: [
            { paymentMethod: "QRIS" },
            {
              paymentMethod: "CREDIT",
              paidMethod: "QRIS",
              paymentStatus: { in: ["PAID", "PARTIAL"] },
            },
          ],
        });
      } else if (paymentMethod === "TRANSFER") {
        conditions.push({
          OR: [
            { paymentMethod: "TRANSFER" },
            {
              paymentMethod: "CREDIT",
              paidMethod: "TRANSFER",
              paymentStatus: { in: ["PAID", "PARTIAL"] },
            },
          ],
        });
      } else if (paymentMethod === "CREDIT") {
        conditions.push({ paymentMethod: "CREDIT" });
      } else {
        conditions.push({ paymentMethod });
      }
    }

    if (search) {
      conditions.push({
        OR: [
          { invoiceNumber: { contains: search, mode: "insensitive" } },
          { customerName: { contains: search, mode: "insensitive" } },
          { cashier: { name: { contains: search, mode: "insensitive" } } },
          { items: { some: { itemName: { contains: search, mode: "insensitive" } } } },
        ],
      });
    }

    const whereSale = conditions.length > 0 ? { AND: conditions } : {};

    const [totalCount, sales, allMatchingSales] = await Promise.all([
      prisma.sale.count({ where: whereSale }),
      (prisma.sale.findMany as any)({
        where: whereSale,
        include: {
          customer: true,
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
          paymentStatus: true,
          paidMethod: true,
          cashGiven: true,
          paidAt: true,
          createdAt: true,
        },
      }),
    ]);

    let totalRevenue = 0;
    let totalDiscount = 0;
    let cashAmount = 0;
    let transferAmount = 0;
    let qrisAmount = 0;
    let creditAmount = 0;

    allMatchingSales.forEach((s: any) => {
      totalRevenue += s.finalAmount || 0;
      totalDiscount += s.discount || 0;

      if (s.paymentMethod === "CASH") {
        cashAmount += s.finalAmount || 0;
      } else if (s.paymentMethod === "TRANSFER") {
        transferAmount += s.finalAmount || 0;
      } else if (s.paymentMethod === "QRIS") {
        qrisAmount += s.finalAmount || 0;
      } else if (s.paymentMethod === "CREDIT") {
        const method = (s.paidMethod || "CASH").toUpperCase();

        if (s.paymentStatus === "PAID") {
          // Nota LUNAS: nominal uang masuk diakui ke metode pembayaran pelunasan
          if (method === "QRIS") {
            qrisAmount += s.finalAmount || 0;
          } else if (method === "TRANSFER") {
            transferAmount += s.finalAmount || 0;
          } else {
            // CASH / Tunai laci kasir
            cashAmount += s.finalAmount || 0;
          }
        } else if (s.paymentStatus === "PARTIAL") {
          // Nota Bayar Sebagian (DP): uang yang sudah masuk diakui ke metode bayar, sisa piutang dicatat
          const paidPart = Math.min(s.cashGiven || 0, s.finalAmount || 0);
          const unpaidPart = Math.max(0, (s.finalAmount || 0) - paidPart);
          creditAmount += unpaidPart;

          if (method === "QRIS") {
            qrisAmount += paidPart;
          } else if (method === "TRANSFER") {
            transferAmount += paidPart;
          } else {
            cashAmount += paidPart;
          }
        } else {
          // UNPAID: Belum lunas sama sekali, seluruh nominal adalah piutang nota
          creditAmount += s.finalAmount || 0;
        }
      }
    });

    const sanitizedSales = sales.map((sale: any) => ({
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
      paymentStatus: sale.paymentStatus || "PAID",
      dueDate: sale.dueDate,
      paidAt: sale.paidAt,
      paidMethod: sale.paidMethod,
      customerName: sale.customerName || sale.customer?.name || null,
      customerPhone: sale.customerPhone || sale.customer?.phone || null,
      notes: sale.notes,
      cashier: sale.cashier,
      itemsCount: sale.items.reduce((acc: number, curr: any) => acc + curr.quantity, 0),
      rawItems: sale.items.map((it: any) => ({
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
        creditAmount,
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

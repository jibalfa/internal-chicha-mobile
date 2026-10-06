import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const batchSalesSchema = z.object({
  items: z.array(
    z.object({
      voucherId: z.string(),
      remainingStock: z.number().int().min(0),
    })
  ),
  notes: z.string().optional(),
});

const correctionSchema = z.object({
  saleItemId: z.string(),
  newQuantity: z.number().int().min(0),
});

// GET today's recorded voucher sales
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");

    const targetDate = dateParam ? new Date(dateParam) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Fetch sale items of type VOUCHER created today
    const saleItems = await prisma.saleItem.findMany({
      where: {
        itemType: "VOUCHER",
        sale: {
          createdAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      },
      include: {
        sale: true,
        voucher: true,
      },
      orderBy: { id: "desc" },
    });

    return NextResponse.json({ saleItems });
  } catch (error) {
    console.error("GET Daily Voucher Sales Error:", error);
    return NextResponse.json(
      { error: "Gagal mengambil rekap penjualan voucher hari ini" },
      { status: 500 }
    );
  }
}

// POST batch daily sales recording (Sisa Stok based)
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== "OWNER" && session.role !== "CASHIER")) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = batchSalesSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 });
    }

    const { items, notes } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const recordedItems: any[] = [];
      let totalAmount = 0;

      // 1. Fetch current active vouchers
      const voucherIds = items.map((i) => i.voucherId);
      const vouchers = await tx.voucher.findMany({
        where: { id: { in: voucherIds } },
      });

      const voucherMap = new Map(vouchers.map((v) => [v.id, v]));

      const saleItemsToCreate: any[] = [];
      const updatedVouchers: any[] = [];
      const movementsToCreate: any[] = [];

      for (const item of items) {
        const voucher = voucherMap.get(item.voucherId);
        if (!voucher) continue;

        const previousStock = voucher.stock;
        const remainingStock = item.remainingStock;

        // Validation: remaining stock cannot exceed initial stock
        if (remainingStock > previousStock) {
          throw new Error(
            `Sisa stok untuk ${voucher.operator} ${voucher.nominal} (${remainingStock}) tidak boleh lebih besar dari stok awal (${previousStock}).`
          );
        }

        const soldQty = previousStock - remainingStock;
        if (soldQty <= 0) continue; // No sales for this voucher

        const itemSubtotal = soldQty * voucher.sellingPrice;
        const itemProfit = soldQty * (voucher.sellingPrice - voucher.costPrice);
        totalAmount += itemSubtotal;

        // Prepare update voucher stock
        updatedVouchers.push({
          id: voucher.id,
          newStock: remainingStock,
        });

        // Prepare movement log
        movementsToCreate.push({
          voucherId: voucher.id,
          type: "SOLD",
          quantity: soldQty,
          previousStock,
          newStock: remainingStock,
          notes: notes?.trim() || "Pencatatan penjualan voucher harian (by sisa stok)",
        });

        // Prepare SaleItem
        saleItemsToCreate.push({
          itemType: "VOUCHER",
          voucherId: voucher.id,
          itemName: `Voucher Fisik ${voucher.operator} ${voucher.nominal}`,
          quantity: soldQty,
          costPrice: voucher.costPrice,
          unitPrice: voucher.sellingPrice,
          subtotal: itemSubtotal,
          profit: itemProfit,
        });
      }

      if (saleItemsToCreate.length === 0) {
        throw new Error("Tidak ada kuantitas terjual yang dicatat.");
      }

      // Generate Invoice Number
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const countToday = await tx.sale.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      });
      const invoiceNumber = `VCH-${dateStr}-${String(countToday + 1).padStart(4, "0")}`;

      // Create Sale Record
      const sale = await tx.sale.create({
        data: {
          invoiceNumber,
          totalAmount,
          discount: 0,
          finalAmount: totalAmount,
          paymentMethod: "CASH",
          cashierId: session.userId,
          notes: notes || "Pencatatan Rekap Penjualan Voucher",
          items: {
            create: saleItemsToCreate,
          },
        },
        include: {
          items: {
            include: { voucher: true },
          },
        },
      });

      // Execute Voucher Stock Updates & Movement entries
      for (const u of updatedVouchers) {
        await tx.voucher.update({
          where: { id: u.id },
          data: { stock: u.newStock },
        });
      }

      for (const m of movementsToCreate) {
        await tx.voucherMovement.create({
          data: m,
        });
      }

      return sale;
    });

    return NextResponse.json({ success: true, sale: result }, { status: 201 });
  } catch (error: any) {
    console.error("Batch Voucher Sales Error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal menyimpan laporan penjualan voucher" },
      { status: 400 }
    );
  }
}

// PUT / PATCH - Correct today's sale quantity for a voucher
export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== "OWNER" && session.role !== "CASHIER")) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = correctionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 });
    }

    const { saleItemId, newQuantity } = parsed.data;

    const updatedSaleItem = await prisma.$transaction(async (tx) => {
      const existingItem = await tx.saleItem.findUnique({
        where: { id: saleItemId },
        include: { sale: true, voucher: true },
      });

      if (!existingItem) {
        throw new Error("Pencatatan penjualan tidak ditemukan.");
      }

      const diff = newQuantity - existingItem.quantity;
      if (diff === 0) return existingItem; // No change

      const voucher = existingItem.voucher;
      if (!voucher) {
        throw new Error("Data voucher tidak ditemukan.");
      }

      // Check stock availability if increasing sold quantity
      if (diff > 0 && voucher.stock < diff) {
        throw new Error(
          `Stok voucher ${voucher.operator} ${voucher.nominal} tidak mencukupi (sisa: ${voucher.stock} pcs)`
        );
      }

      const previousStock = voucher.stock;
      const newStock = previousStock - diff;

      // Update voucher stock
      await tx.voucher.update({
        where: { id: voucher.id },
        data: { stock: newStock },
      });

      // Record movement adjustment
      await tx.voucherMovement.create({
        data: {
          voucherId: voucher.id,
          type: "ADJUSTMENT",
          quantity: Math.abs(diff),
          previousStock,
          newStock,
          notes: `Koreksi rekap penjualan dari ${existingItem.quantity} pcs ke ${newQuantity} pcs`,
        },
      });

      // Update sale item subtotal & profit
      const newSubtotal = newQuantity * existingItem.unitPrice;
      const newProfit = newQuantity * (existingItem.unitPrice - existingItem.costPrice);

      const item = await tx.saleItem.update({
        where: { id: saleItemId },
        data: {
          quantity: newQuantity,
          subtotal: newSubtotal,
          profit: newProfit,
        },
      });

      // Recalculate parent Sale totalAmount & finalAmount
      const allItems = await tx.saleItem.findMany({
        where: { saleId: existingItem.saleId },
      });
      const newTotalAmount = allItems.reduce((sum, i) => sum + i.subtotal, 0);

      await tx.sale.update({
        where: { id: existingItem.saleId },
        data: {
          totalAmount: newTotalAmount,
          finalAmount: newTotalAmount,
        },
      });

      return item;
    });

    return NextResponse.json({ success: true, item: updatedSaleItem });
  } catch (error: any) {
    console.error("Voucher Correction Error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal mengoreksi penjualan voucher" },
      { status: 400 }
    );
  }
}

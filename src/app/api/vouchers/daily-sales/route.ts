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
  date: z.string().optional(), // YYYY-MM-DD
});

const correctionSchema = z.object({
  saleItemId: z.string(),
  newQuantity: z.number().int().min(0),
  newUnitPrice: z.number().min(0).optional(),
});

// GET recorded voucher sales for a specific date (defaults to today)
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");

    const now = new Date();
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

    const startOfDay = new Date(year, month, day, 0, 0, 0, 0);
    const endOfDay = new Date(year, month, day, 23, 59, 59, 999);

    // Fetch sale items of type VOUCHER created on this date
    const saleItems = await prisma.saleItem.findMany({
      where: {
        OR: [
          { itemType: "VOUCHER" },
          { voucherId: { not: null } },
        ],
        sale: {
          createdAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
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
            notes: true,
            cashier: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        voucher: true,
      },
      orderBy: { id: "desc" },
    });

    return NextResponse.json({ saleItems });
  } catch (error) {
    console.error("GET Daily Voucher Sales Error:", error);
    return NextResponse.json(
      { error: "Gagal mengambil rekap penjualan voucher" },
      { status: 500 }
    );
  }
}

// POST batch daily sales recording (Sisa Stok based, supports specific date)
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

    const { items, notes, date: dateParam } = parsed.data;

    // Determine target record date
    const now = new Date();
    let recordDate = new Date();
    if (dateParam) {
      const parts = dateParam.split("-");
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        recordDate = new Date(y, m, d, now.getHours(), now.getMinutes(), now.getSeconds());
      }
    }

    const result = await prisma.$transaction(async (tx) => {
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
        const dateLabelStr = dateParam || recordDate.toISOString().slice(0, 10);
        movementsToCreate.push({
          voucherId: voucher.id,
          type: "SOLD",
          quantity: soldQty,
          previousStock,
          newStock: remainingStock,
          notes: notes?.trim() || `Pencatatan penjualan voucher harian (${dateLabelStr})`,
          createdAt: recordDate,
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

      // Generate Invoice Number with date prefix
      const dateStr = recordDate.toISOString().slice(0, 10).replace(/-/g, "");
      const startOfRecordDay = new Date(recordDate);
      startOfRecordDay.setHours(0, 0, 0, 0);
      const endOfRecordDay = new Date(recordDate);
      endOfRecordDay.setHours(23, 59, 59, 999);

      const countOnDate = await tx.sale.count({
        where: {
          createdAt: {
            gte: startOfRecordDay,
            lte: endOfRecordDay,
          },
        },
      });
      const invoiceNumber = `VCH-${dateStr}-${String(countOnDate + 1).padStart(4, "0")}`;

      // Create Sale Record with specified createdAt
      const sale = await tx.sale.create({
        data: {
          invoiceNumber,
          totalAmount,
          discount: 0,
          finalAmount: totalAmount,
          paymentMethod: "CASH",
          cashierId: session.userId,
          notes: notes || "Pencatatan Rekap Penjualan Voucher",
          createdAt: recordDate,
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

// PUT / PATCH - Correct recorded sale quantity for a voucher
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

    const { saleItemId, newQuantity, newUnitPrice } = parsed.data;

    const updatedSaleItem = await prisma.$transaction(async (tx) => {
      const existingItem = await tx.saleItem.findUnique({
        where: { id: saleItemId },
        include: { sale: true, voucher: true },
      });

      if (!existingItem) {
        throw new Error("Pencatatan penjualan tidak ditemukan.");
      }

      const unitPriceToUse =
        newUnitPrice !== undefined && newUnitPrice !== null && !isNaN(newUnitPrice)
          ? newUnitPrice
          : existingItem.unitPrice;

      const diff = newQuantity - existingItem.quantity;
      const priceDiff = unitPriceToUse !== existingItem.unitPrice;

      if (diff === 0 && !priceDiff) return existingItem; // No change

      const voucher = existingItem.voucher;

      if (diff !== 0) {
        if (!voucher) {
          throw new Error("Data voucher tidak ditemukan untuk penyesuaian stok.");
        }

        // Check stock availability if increasing sold quantity
        if (diff > 0 && voucher.stock < diff) {
          throw new Error(
            `Stok voucher ${voucher.operator} ${voucher.nominal} tidak mencukupi (sisa persediaan fisik: ${voucher.stock} pcs)`
          );
        }

        const previousStock = voucher.stock;
        const newStock = previousStock - diff;

        // Update voucher stock
        await tx.voucher.update({
          where: { id: voucher.id },
          data: { stock: newStock },
        });

        const changeNotes = [
          `kuantitas ${existingItem.quantity} -> ${newQuantity} pcs`,
          ...(priceDiff
            ? [
                `harga Rp ${existingItem.unitPrice.toLocaleString("id-ID")} -> Rp ${unitPriceToUse.toLocaleString("id-ID")}`,
              ]
            : []),
        ].join(", ");

        // Record movement adjustment
        await tx.voucherMovement.create({
          data: {
            voucherId: voucher.id,
            type: "ADJUSTMENT",
            quantity: Math.abs(diff),
            previousStock,
            newStock,
            notes: `Koreksi rekap penjualan: ${changeNotes} (Faktur: #${existingItem.sale?.invoiceNumber || ""})`,
          },
        });
      } else if (priceDiff && voucher) {
        // Record movement adjustment note for price change even if quantity unchanged
        await tx.voucherMovement.create({
          data: {
            voucherId: voucher.id,
            type: "ADJUSTMENT",
            quantity: 0,
            previousStock: voucher.stock,
            newStock: voucher.stock,
            notes: `Koreksi harga penjualan voucher: Rp ${existingItem.unitPrice.toLocaleString("id-ID")} -> Rp ${unitPriceToUse.toLocaleString("id-ID")} (${newQuantity} pcs) (Faktur: #${existingItem.sale?.invoiceNumber || ""})`,
          },
        });
      }

      // Update sale item unitPrice, subtotal & profit
      const newSubtotal = newQuantity * unitPriceToUse;
      const newProfit = newQuantity * (unitPriceToUse - existingItem.costPrice);

      const item = await tx.saleItem.update({
        where: { id: saleItemId },
        data: {
          unitPrice: unitPriceToUse,
          quantity: newQuantity,
          subtotal: newSubtotal,
          profit: newProfit,
        },
      });

      // Recalculate parent Sale totalAmount & finalAmount
      const allItems = await tx.saleItem.findMany({
        where: { saleId: existingItem.saleId },
      });
      const newTotalAmount = allItems.reduce(
        (sum, i) => (i.id === item.id ? newSubtotal : sum + i.subtotal),
        0
      );

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

// DELETE - Cancel/Delete recorded voucher sale item and return stock
export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== "OWNER" && session.role !== "CASHIER")) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const saleItemId = searchParams.get("saleItemId");

    if (!saleItemId) {
      return NextResponse.json({ error: "saleItemId wajib disertakan" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      const existingItem = await tx.saleItem.findUnique({
        where: { id: saleItemId },
        include: { sale: true, voucher: true },
      });

      if (!existingItem) {
        throw new Error("Pencatatan penjualan voucher tidak ditemukan.");
      }

      // Return stock back to voucher
      if (existingItem.voucherId && existingItem.quantity > 0) {
        const voucher = await tx.voucher.findUnique({
          where: { id: existingItem.voucherId },
        });

        if (voucher) {
          const previousStock = voucher.stock;
          const newStock = previousStock + existingItem.quantity;

          await tx.voucher.update({
            where: { id: voucher.id },
            data: { stock: newStock },
          });

          await tx.voucherMovement.create({
            data: {
              voucherId: voucher.id,
              type: "ADJUSTMENT",
              quantity: existingItem.quantity,
              previousStock,
              newStock,
              notes: `Pembatalan rekapan penjualan voucher #${existingItem.sale?.invoiceNumber || ""} (${existingItem.quantity} pcs dikembalikan ke stok)`,
            },
          });
        }
      }

      const saleId = existingItem.saleId;

      // Delete the sale item
      await tx.saleItem.delete({
        where: { id: saleItemId },
      });

      // Check remaining items in the parent sale
      const remainingItems = await tx.saleItem.findMany({
        where: { saleId },
      });

      if (remainingItems.length === 0) {
        // If sale has no more items, delete parent sale
        await tx.sale.delete({
          where: { id: saleId },
        });
      } else {
        // Recalculate parent sale totals
        const newTotal = remainingItems.reduce((sum, item) => sum + item.subtotal, 0);
        await tx.sale.update({
          where: { id: saleId },
          data: {
            totalAmount: newTotal,
            finalAmount: newTotal,
          },
        });
      }
    });

    return NextResponse.json({
      success: true,
      message: "Pencatatan penjualan voucher berhasil dibatalkan dan stok telah dikembalikan ke katalog.",
    });
  } catch (error: any) {
    console.error("Delete Voucher Sale Item Error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal membatalkan pencatatan penjualan voucher" },
      { status: 400 }
    );
  }
}


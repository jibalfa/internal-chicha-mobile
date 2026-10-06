import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const saleItemSchema = z.object({
  itemType: z.enum(["PRODUCT", "VOUCHER"]),
  productId: z.string().optional().nullable(),
  voucherId: z.string().optional().nullable(),
  itemName: z.string().min(1),
  quantity: z.number().int().min(1),
  costPrice: z.number().min(0).optional().default(0),
  unitPrice: z.number().min(0),
});

const createSaleSchema = z.object({
  items: z.array(saleItemSchema).min(1, "Minimal harus ada 1 item transaksi"),
  discount: z.number().min(0).default(0),
  paymentMethod: z.enum(["CASH", "TRANSFER", "QRIS"]).default("CASH"),
  cashGiven: z.number().min(0).default(0),
  notes: z.string().optional(),
});

// Helper to generate Invoice Number: INV-YYYYMMDD-XXXX
async function generateInvoiceNumber(tx: any): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `INV-${dateStr}`;

  const lastSale = await tx.sale.findFirst({
    where: { invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: "desc" },
  });

  let counter = 1;
  if (lastSale && lastSale.invoiceNumber) {
    const parts = lastSale.invoiceNumber.split("-");
    const lastCounter = parseInt(parts[2] || "0", 10);
    if (!isNaN(lastCounter)) {
      counter = lastCounter + 1;
    }
  }

  return `${prefix}-${String(counter).padStart(4, "0")}`;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    const isOwner = session?.role === "OWNER";

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const search = searchParams.get("search")?.trim() || "";

    const where: any = {};
    if (search) {
      where.invoiceNumber = { contains: search };
    }

    const sales = await prisma.sale.findMany({
      where,
      include: {
        cashier: { select: { id: true, name: true } },
        items: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const sanitizedSales = isOwner
      ? sales
      : sales.map((s) => ({
          ...s,
          items: s.items.map((item) => ({
            ...item,
            costPrice: 0,
            profit: 0,
          })),
        }));

    return NextResponse.json({ sales: sanitizedSales });
  } catch (error) {
    console.error("GET Sales Error:", error);
    return NextResponse.json({ error: "Gagal mengambil data penjualan" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== "OWNER" && session.role !== "CASHIER")) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = createSaleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 });
    }

    const {
      items,
      discount,
      paymentMethod,
      cashGiven,
      notes,
    } = parsed.data;

    // Execute atomic transaction for sale and stock deductions
    const result = await prisma.$transaction(async (tx) => {
      // 1. Calculate totals and check stocks
      let subtotalTotal = 0;
      const verifiedItems: any[] = [];

      for (const item of items) {
        const itemSubtotal = item.unitPrice * item.quantity;
        subtotalTotal += itemSubtotal;

        if (item.itemType === "PRODUCT") {
          if (!item.productId) throw new Error("Product ID wajib diisi untuk item fisik");
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (!product) throw new Error(`Produk "${item.itemName}" tidak ditemukan`);
          if (product.stock < item.quantity) {
            throw new Error(
              `Stok produk "${product.name}" tidak mencukupi! Tersedia: ${product.stock}, diminta: ${item.quantity}`
            );
          }

          const actualCost = product.costPrice;
          const itemProfit = (item.unitPrice - actualCost) * item.quantity;

          verifiedItems.push({
            ...item,
            costPrice: actualCost,
            subtotal: itemSubtotal,
            profit: itemProfit,
            productRecord: product,
          });
        } else if (item.itemType === "VOUCHER") {
          if (!item.voucherId) throw new Error("Voucher ID wajib diisi");
          const voucher = await tx.voucher.findUnique({ where: { id: item.voucherId } });
          if (!voucher) throw new Error(`Voucher "${item.itemName}" tidak ditemukan`);
          if (voucher.stock < item.quantity) {
            throw new Error(
              `Stok voucher "${voucher.operator} ${voucher.nominal}" tidak mencukupi! Tersedia: ${voucher.stock}, diminta: ${item.quantity}`
            );
          }

          const actualCost = voucher.costPrice;
          const itemProfit = (item.unitPrice - actualCost) * item.quantity;

          verifiedItems.push({
            ...item,
            costPrice: actualCost,
            subtotal: itemSubtotal,
            profit: itemProfit,
            voucherRecord: voucher,
          });
        }
      }

      const finalAmount = Math.max(0, subtotalTotal - discount);
      let changeGiven = 0;
      if (paymentMethod === "CASH") {
        if (cashGiven < finalAmount) {
          throw new Error(
            `Uang tunai pembayaran (Rp ${cashGiven.toLocaleString()}) kurang dari total tagihan (Rp ${finalAmount.toLocaleString()})`
          );
        }
        changeGiven = cashGiven - finalAmount;
      } else {
        // Transfer/QRIS payment matches exactly finalAmount
        changeGiven = 0;
      }

      const invoiceNumber = await generateInvoiceNumber(tx);

      // 2. Create Sale Record
      const sale = await tx.sale.create({
        data: {
          invoiceNumber,
          totalAmount: subtotalTotal,
          discount,
          finalAmount,
          paymentMethod,
          cashGiven: paymentMethod === "CASH" ? cashGiven : finalAmount,
          changeGiven,
          notes: notes?.trim() || null,
          cashierId: session.userId,
        },
      });

      // 3. Create Sale Items and deduct stock with movements
      for (const item of verifiedItems) {
        await tx.saleItem.create({
          data: {
            saleId: sale.id,
            itemType: item.itemType,
            productId: item.productId || null,
            voucherId: item.voucherId || null,
            itemName: item.itemName,
            quantity: item.quantity,
            costPrice: item.costPrice,
            unitPrice: item.unitPrice,
            subtotal: item.subtotal,
            profit: item.profit,
          },
        });

        if (item.itemType === "PRODUCT") {
          const prev = item.productRecord.stock;
          const next = prev - item.quantity;

          await tx.product.update({
            where: { id: item.productId },
            data: { stock: next },
          });

          await tx.inventoryMovement.create({
            data: {
              productId: item.productId,
              type: "SALE",
              quantity: -item.quantity,
              previousStock: prev,
              newStock: next,
              referenceId: invoiceNumber,
              notes: `Penjualan Kasir POS: Faktur #${invoiceNumber}`,
              createdById: session.userId,
            },
          });
        } else if (item.itemType === "VOUCHER") {
          const prev = item.voucherRecord.stock;
          const next = prev - item.quantity;

          await tx.voucher.update({
            where: { id: item.voucherId },
            data: { stock: next },
          });

          await tx.voucherMovement.create({
            data: {
              voucherId: item.voucherId,
              type: "SOLD",
              quantity: -item.quantity,
              previousStock: prev,
              newStock: next,
              referenceId: invoiceNumber,
              notes: `Penjualan Voucher Kasir: Faktur #${invoiceNumber}`,
            },
          });
        }
      }

      return await tx.sale.findUnique({
        where: { id: sale.id },
        include: {
          items: true,
          cashier: { select: { id: true, name: true } },
        },
      });
    });

    return NextResponse.json({ success: true, sale: result }, { status: 201 });
  } catch (error: any) {
    console.error("Sale Transaction Error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal memproses transaksi penjualan" },
      { status: 400 }
    );
  }
}

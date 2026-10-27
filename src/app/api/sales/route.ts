import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withDbRetry } from "@/lib/dbRetry";
import { z } from "zod";

const saleItemSchema = z.object({
  itemType: z.enum(["PRODUCT", "VOUCHER"]),
  productId: z.string().optional().nullable(),
  voucherId: z.string().optional().nullable(),
  itemName: z.string().min(1),
  quantity: z.number().int().min(1),
  costPrice: z.number().min(0).optional().default(0),
  unitPrice: z.number().min(0, "Harga jual minimal Rp 0"),
});

const createSaleSchema = z.object({
  items: z.array(saleItemSchema).min(1, "Minimal harus ada 1 item transaksi"),
  discount: z.number().min(0).optional().default(0),
  paymentMethod: z.enum(["CASH", "TRANSFER", "QRIS", "CREDIT", "KREDIT", "NOTA"]).default("CASH"),
  cashGiven: z.number().min(0).default(0),
  notes: z.string().optional().nullable(),
  customerId: z.string().optional().nullable(),
  customerName: z.string().optional().nullable(),
  customerPhone: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
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
    const paymentStatus = searchParams.get("paymentStatus")?.toUpperCase() || "";

    const sales = await withDbRetry(async () => {
      const where: any = {};
      if (search) {
        where.OR = [
          { invoiceNumber: { contains: search, mode: "insensitive" } },
          { customerName: { contains: search, mode: "insensitive" } },
          { notes: { contains: search, mode: "insensitive" } },
        ];
      }
      if (paymentStatus && paymentStatus !== "ALL") {
        where.paymentStatus = paymentStatus;
      }

      return await (prisma.sale.findMany as any)({
        where,
        include: {
          cashier: { select: { id: true, name: true } },
          customer: true,
          items: true,
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      });
    }, { operationName: "GET Sales" });

    const sanitizedSales = isOwner
      ? sales
      : (sales as any[]).map((s: any) => ({
          ...s,
          items: (s.items || []).map((item: any) => ({
            ...item,
            costPrice: 0,
            profit: 0,
          })),
        }));

    return NextResponse.json({ sales: sanitizedSales });
  } catch (error: any) {
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
      discount = 0,
      paymentMethod: rawMethod,
      cashGiven,
      notes,
      customerId,
      customerName,
      customerPhone,
      dueDate,
    } = parsed.data;

    // Normalize payment method (KREDIT and NOTA map to CREDIT)
    const isCredit = rawMethod === "CREDIT" || rawMethod === "KREDIT" || rawMethod === "NOTA";
    const paymentMethod = isCredit ? "CREDIT" : (rawMethod as "CASH" | "TRANSFER" | "QRIS");

    // For CREDIT/NOTA, customer name is strictly required
    if (isCredit && !customerName?.trim()) {
      return NextResponse.json(
        { error: "Nama pelanggan wajib diisi untuk transaksi Kredit / Nota" },
        { status: 400 }
      );
    }

    // Execute atomic transaction for sale and stock deductions with automatic DB retry
    const result = await withDbRetry(async () => {
      return await prisma.$transaction(async (tx) => {
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

        const finalAmount = Math.max(0, subtotalTotal - (discount || 0));
        let changeGiven = 0;
        let paymentStatus = "PAID";
        let actualCashGiven = cashGiven;

        if (paymentMethod === "CASH") {
          if (cashGiven < finalAmount) {
            throw new Error(
              `Uang tunai pembayaran (Rp ${cashGiven.toLocaleString()}) kurang dari total tagihan (Rp ${finalAmount.toLocaleString()})`
            );
          }
          changeGiven = cashGiven - finalAmount;
          paymentStatus = "PAID";
        } else if (paymentMethod === "CREDIT") {
          // Down payment / Uang Muka (DP)
          actualCashGiven = Math.min(cashGiven || 0, finalAmount);
          changeGiven = 0;
          paymentStatus = actualCashGiven >= finalAmount ? "PAID" : actualCashGiven > 0 ? "PARTIAL" : "UNPAID";
        } else {
          // Transfer/QRIS payment matches exactly finalAmount
          actualCashGiven = finalAmount;
          changeGiven = 0;
          paymentStatus = "PAID";
        }

        // Handle Customer Record association
        let resolvedCustomerId: string | null = customerId || null;
        if (customerName?.trim()) {
          if (!resolvedCustomerId) {
            // Find or create customer
            if (customerPhone?.trim()) {
              const existingCust = await (tx as any).customer.findFirst({
                where: { phone: customerPhone.trim() },
              });
              if (existingCust) {
                resolvedCustomerId = existingCust.id;
              }
            }

            if (!resolvedCustomerId) {
              const newCust = await (tx as any).customer.create({
                data: {
                  name: customerName.trim(),
                  phone: customerPhone?.trim() || null,
                },
              });
              resolvedCustomerId = newCust.id;
            }
          }
        }

        const invoiceNumber = await generateInvoiceNumber(tx);

        // 2. Create Sale Record
        const sale = await (tx as any).sale.create({
          data: {
            invoiceNumber,
            totalAmount: subtotalTotal,
            discount: discount || 0,
            finalAmount,
            paymentMethod,
            cashGiven: actualCashGiven,
            changeGiven,
            paymentStatus,
            dueDate: dueDate ? new Date(dueDate) : null,
            paidAt: paymentStatus === "PAID" ? new Date() : null,
            paidMethod: paymentStatus === "PAID" ? (isCredit ? "CASH" : paymentMethod) : null,
            notes: notes?.trim() || null,
            cashierId: session.userId,
            customerId: resolvedCustomerId,
            customerName: customerName?.trim() || null,
            customerPhone: customerPhone?.trim() || null,
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

        return await (tx as any).sale.findUnique({
          where: { id: sale.id },
          include: {
            items: true,
            customer: true,
            cashier: { select: { id: true, name: true } },
          },
        });
      });
    }, { operationName: "Create Sale Transaction" });

    return NextResponse.json({ success: true, sale: result }, { status: 201 });
  } catch (error: any) {
    console.error("Sale Transaction Error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal memproses transaksi penjualan" },
      { status: 400 }
    );
  }
}

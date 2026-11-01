import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withDbRetry } from "@/lib/dbRetry";
import { z } from "zod";

const editSaleItemSchema = z.object({
  id: z.string().optional(),
  itemType: z.enum(["PRODUCT", "VOUCHER"]),
  productId: z.string().optional().nullable(),
  voucherId: z.string().optional().nullable(),
  itemName: z.string().min(1, "Nama item tidak boleh kosong"),
  quantity: z.number().int().min(1, "Kuantitas minimal 1"),
  unitPrice: z.number().min(0, "Harga satuan tidak boleh negatif"),
});

const editSaleSchema = z.object({
  items: z.array(editSaleItemSchema).min(1, "Minimal harus ada 1 item transaksi"),
  discount: z.number().min(0).default(0),
  paymentMethod: z.enum(["CASH", "TRANSFER", "QRIS", "CREDIT"]),
  cashGiven: z.number().min(0).optional(),
  notes: z.string().optional().nullable(),
  customerName: z.string().optional().nullable(),
  customerPhone: z.string().optional().nullable(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sale = await prisma.sale.findUnique({
      where: { id: params.id },
      include: {
        cashier: { select: { id: true, name: true } },
        customer: true,
        items: {
          include: {
            product: true,
            voucher: true,
          },
        },
      },
    });

    if (!sale) {
      return NextResponse.json({ error: "Transaksi tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json({ sale });
  } catch (error) {
    return NextResponse.json({ error: "Gagal mengambil data transaksi" }, { status: 500 });
  }
}

/**
 * PUT: Edit Transaksi (Produk, Harga, Kuantitas, Diskon, Metode Pembayaran, Pelanggan, Catatan)
 * Otomatis menyinkronkan stok inventaris & voucher, mutasi kas, serta laporan/dashboard.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session || (session.role !== "OWNER" && session.role !== "CASHIER")) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = editSaleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 });
    }

    const {
      items,
      discount = 0,
      paymentMethod,
      cashGiven,
      notes,
      customerName,
      customerPhone,
    } = parsed.data;

    const result = await withDbRetry(async () => {
      return await prisma.$transaction(async (tx) => {
        // 1. Ambil transaksi lama beserta item-itemnya
        const currentSale = await tx.sale.findUnique({
          where: { id: params.id },
          include: { items: true },
        });

        if (!currentSale) {
          throw new Error("Data transaksi tidak ditemukan");
        }

        if (currentSale.paymentStatus === "CANCELLED") {
          throw new Error("Transaksi yang sudah dibatalkan tidak dapat diedit");
        }

        // 2. Rollback stok lama (kembalikan kuantitas item lama ke inventaris)
        for (const oldItem of currentSale.items) {
          if (oldItem.itemType === "PRODUCT" && oldItem.productId) {
            await tx.product.update({
              where: { id: oldItem.productId },
              data: { stock: { increment: oldItem.quantity } },
            });
          } else if (oldItem.itemType === "VOUCHER" && oldItem.voucherId) {
            await tx.voucher.update({
              where: { id: oldItem.voucherId },
              data: { stock: { increment: oldItem.quantity } },
            });
          }
        }

        // 3. Verifikasi item baru & potong stok baru
        let subtotalTotal = 0;
        const verifiedItems: any[] = [];

        for (const newItem of items) {
          const itemSubtotal = newItem.unitPrice * newItem.quantity;
          subtotalTotal += itemSubtotal;

          if (newItem.itemType === "PRODUCT") {
            if (!newItem.productId) {
              throw new Error(`Product ID wajib diisi untuk "${newItem.itemName}"`);
            }
            const product = await tx.product.findUnique({ where: { id: newItem.productId } });
            if (!product) {
              throw new Error(`Produk "${newItem.itemName}" tidak ditemukan`);
            }
            if (product.stock < newItem.quantity) {
              throw new Error(
                `Stok produk "${product.name}" tidak mencukupi! Tersedia: ${product.stock}, diminta: ${newItem.quantity}`
              );
            }

            // Kurangi stok produk baru
            await tx.product.update({
              where: { id: newItem.productId },
              data: { stock: { decrement: newItem.quantity } },
            });

            const costPrice = product.costPrice;
            const profit = (newItem.unitPrice - costPrice) * newItem.quantity;

            verifiedItems.push({
              itemType: "PRODUCT",
              productId: newItem.productId,
              voucherId: null,
              itemName: newItem.itemName,
              quantity: newItem.quantity,
              costPrice,
              unitPrice: newItem.unitPrice,
              subtotal: itemSubtotal,
              profit,
            });
          } else if (newItem.itemType === "VOUCHER") {
            if (!newItem.voucherId) {
              throw new Error(`Voucher ID wajib diisi untuk "${newItem.itemName}"`);
            }
            const voucher = await tx.voucher.findUnique({ where: { id: newItem.voucherId } });
            if (!voucher) {
              throw new Error(`Voucher "${newItem.itemName}" tidak ditemukan`);
            }
            if (voucher.stock < newItem.quantity) {
              throw new Error(
                `Stok voucher "${voucher.operator} ${voucher.nominal}" tidak mencukupi! Tersedia: ${voucher.stock}, diminta: ${newItem.quantity}`
              );
            }

            // Kurangi stok voucher baru
            await tx.voucher.update({
              where: { id: newItem.voucherId },
              data: { stock: { decrement: newItem.quantity } },
            });

            const costPrice = voucher.costPrice;
            const profit = (newItem.unitPrice - costPrice) * newItem.quantity;

            verifiedItems.push({
              itemType: "VOUCHER",
              productId: null,
              voucherId: newItem.voucherId,
              itemName: newItem.itemName,
              quantity: newItem.quantity,
              costPrice,
              unitPrice: newItem.unitPrice,
              subtotal: itemSubtotal,
              profit,
            });
          }
        }

        // 4. Hapus item lama dan buat item baru
        await tx.saleItem.deleteMany({
          where: { saleId: params.id },
        });

        await tx.saleItem.createMany({
          data: verifiedItems.map((item) => ({
            ...item,
            saleId: params.id,
          })),
        });

        // 5. Hitung ulang total pembayaran & status
        const finalAmount = Math.max(0, subtotalTotal - (discount || 0));
        let changeGiven = 0;
        let actualCashGiven = cashGiven !== undefined ? cashGiven : currentSale.cashGiven || finalAmount;
        let paymentStatus = "PAID";

        if (paymentMethod === "CASH") {
          actualCashGiven = cashGiven !== undefined ? cashGiven : Math.max(finalAmount, currentSale.cashGiven || 0);
          changeGiven = Math.max(0, actualCashGiven - finalAmount);
          paymentStatus = "PAID";
        } else if (paymentMethod === "CREDIT") {
          actualCashGiven = Math.min(actualCashGiven, finalAmount);
          changeGiven = 0;
          paymentStatus = actualCashGiven >= finalAmount ? "PAID" : actualCashGiven > 0 ? "PARTIAL" : "UNPAID";
        } else {
          // TRANSFER / QRIS
          actualCashGiven = finalAmount;
          changeGiven = 0;
          paymentStatus = "PAID";
        }

        // 6. Update data transaksi
        const updatedSale = await tx.sale.update({
          where: { id: params.id },
          data: {
            totalAmount: subtotalTotal,
            discount: discount || 0,
            finalAmount,
            paymentMethod,
            cashGiven: actualCashGiven,
            changeGiven,
            paymentStatus,
            paidMethod: paymentStatus === "PAID" ? paymentMethod : null,
            notes: notes !== undefined ? notes?.trim() || null : currentSale.notes,
            customerName: customerName !== undefined ? customerName?.trim() || null : currentSale.customerName,
            customerPhone: customerPhone !== undefined ? customerPhone?.trim() || null : currentSale.customerPhone,
          },
          include: {
            cashier: { select: { id: true, name: true } },
            customer: true,
            items: true,
          },
        });

        return updatedSale;
      });
    }, { operationName: "Edit Sale Transaction" });

    return NextResponse.json({
      success: true,
      message: "Transaksi berhasil diperbarui",
      sale: result,
    });
  } catch (error: any) {
    console.error("PUT Sale Error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal memperbarui transaksi" },
      { status: 400 }
    );
  }
}

/**
 * DELETE: Pembatalan Transaksi (Void Sale)
 * Mengembalikan stok produk & voucher ke inventaris toko dan menandai status CANCELLED.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session || (session.role !== "OWNER" && session.role !== "CASHIER")) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const reason = searchParams.get("reason")?.trim() || "Dibatalkan oleh kasir/owner";

    const result = await withDbRetry(async () => {
      return await prisma.$transaction(async (tx) => {
        const sale = await tx.sale.findUnique({
          where: { id: params.id },
          include: { items: true },
        });

        if (!sale) {
          throw new Error("Data transaksi tidak ditemukan");
        }

        if (sale.paymentStatus === "CANCELLED") {
          throw new Error("Transaksi ini sudah berstatus DIBATALKAN sebelumnya");
        }

        // 1. Kembalikan stok produk & catat mutasi RETURN
        for (const item of sale.items) {
          if (item.itemType === "PRODUCT" && item.productId) {
            const p = await tx.product.findUnique({ where: { id: item.productId } });
            if (p) {
              const prev = p.stock;
              const next = prev + item.quantity;
              await tx.product.update({
                where: { id: item.productId },
                data: { stock: next },
              });
              await tx.inventoryMovement.create({
                data: {
                  productId: item.productId,
                  type: "RETURN",
                  quantity: item.quantity,
                  previousStock: prev,
                  newStock: next,
                  referenceId: sale.invoiceNumber,
                  notes: `Batal Nota #${sale.invoiceNumber}: ${reason}`,
                  createdById: session.userId,
                },
              });
            }
          } else if (item.itemType === "VOUCHER" && item.voucherId) {
            const v = await tx.voucher.findUnique({ where: { id: item.voucherId } });
            if (v) {
              const prev = v.stock;
              const next = prev + item.quantity;
              await tx.voucher.update({
                where: { id: item.voucherId },
                data: { stock: next },
              });
              await tx.voucherMovement.create({
                data: {
                  voucherId: item.voucherId,
                  type: "ADJUSTMENT",
                  quantity: item.quantity,
                  previousStock: prev,
                  newStock: next,
                  referenceId: sale.invoiceNumber,
                  notes: `Batal Nota #${sale.invoiceNumber}: ${reason}`,
                },
              });
            }
          }
        }

        // 2. Tandai status CANCELLED
        const cancelledNotes = sale.notes
          ? `[DIBATALKAN: ${reason}] | ${sale.notes}`
          : `[DIBATALKAN: ${reason}]`;

        const updatedSale = await tx.sale.update({
          where: { id: params.id },
          data: {
            paymentStatus: "CANCELLED",
            notes: cancelledNotes,
          },
          include: {
            cashier: { select: { id: true, name: true } },
            items: true,
          },
        });

        return updatedSale;
      });
    }, { operationName: "Cancel Sale Transaction" });

    return NextResponse.json({
      success: true,
      message: `Transaksi #${result.invoiceNumber} berhasil dibatalkan dan stok telah dikembalikan ke inventaris`,
      sale: result,
    });
  } catch (error: any) {
    console.error("DELETE / Cancel Sale Error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal membatalkan transaksi" },
      { status: 400 }
    );
  }
}

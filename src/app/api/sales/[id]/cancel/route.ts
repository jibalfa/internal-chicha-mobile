import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withDbRetry } from "@/lib/dbRetry";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session || (session.role !== "OWNER" && session.role !== "CASHIER")) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  try {
    let reason = "Dibatalkan oleh kasir/owner";
    try {
      const body = await request.json();
      if (body?.reason?.trim()) {
        reason = body.reason.trim();
      }
    } catch {
      // Body is optional
    }

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
    console.error("POST Cancel Sale Error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal membatalkan transaksi" },
      { status: 400 }
    );
  }
}


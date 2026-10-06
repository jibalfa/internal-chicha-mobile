import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const voucherStockInSchema = z.object({
  voucherId: z.string().min(1, "Voucher wajib dipilih"),
  quantity: z.number().int().min(1, "Kuantitas minimal 1 unit"),
  costPrice: z.number().min(0).optional(),
  notes: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== "OWNER" && session.role !== "CASHIER")) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = voucherStockInSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 });
    }

    const { voucherId, quantity, costPrice, notes } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const voucher = await tx.voucher.findUnique({
        where: { id: voucherId },
      });

      if (!voucher) {
        throw new Error("Voucher tidak ditemukan");
      }

      const previousStock = voucher.stock;
      const newStock = previousStock + quantity;

      const updateData: any = { stock: newStock };
      if (costPrice !== undefined && costPrice > 0) {
        updateData.costPrice = costPrice;
      }

      const updatedVoucher = await tx.voucher.update({
        where: { id: voucherId },
        data: updateData,
      });

      const movement = await tx.voucherMovement.create({
        data: {
          voucherId,
          type: "STOCK_IN",
          quantity,
          previousStock,
          newStock,
          notes: notes?.trim() || "Penerimaan stok masuk voucher fisik",
        },
      });

      return { voucher: updatedVoucher, movement };
    });

    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (error: any) {
    console.error("Voucher Stock In Error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal menambah stok voucher" },
      { status: 500 }
    );
  }
}

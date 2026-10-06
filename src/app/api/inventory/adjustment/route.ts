import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const adjustmentSchema = z.object({
  productId: z.string().min(1, "Produk wajib dipilih"),
  actualStock: z.number().int().min(0, "Stok fisik aktual tidak boleh negatif"),
  reason: z.string().min(3, "Alasan penyesuaian stok wajib diisi"),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== "OWNER" && session.role !== "CASHIER")) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = adjustmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 });
    }

    const { productId, actualStock, reason } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        throw new Error("Produk tidak ditemukan");
      }

      const previousStock = product.stock;
      const difference = actualStock - previousStock;

      if (difference === 0) {
        throw new Error("Stok fisik sama dengan stok sistem, tidak ada perubahan yang disesuaikan.");
      }

      const updatedProduct = await tx.product.update({
        where: { id: productId },
        data: { stock: actualStock },
        include: { category: true, supplier: true },
      });

      const movement = await tx.inventoryMovement.create({
        data: {
          productId,
          type: "ADJUSTMENT",
          quantity: difference, // Signed difference
          previousStock,
          newStock: actualStock,
          notes: `[Stock Opname] Selisih: ${difference > 0 ? "+" : ""}${difference}. Alasan: ${reason.trim()}`,
          createdById: session.userId,
        },
      });

      return { product: updatedProduct, movement };
    });

    return NextResponse.json({ success: true, ...result }, { status: 200 });
  } catch (error: any) {
    console.error("Stock Adjustment Error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal melakukan penyesuaian stok" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const stockInSchema = z.object({
  productId: z.string().min(1, "Produk wajib dipilih"),
  quantity: z.number().int().min(1, "Kuantitas minimal 1 unit"),
  costPrice: z.number().min(0).optional(),
  supplierId: z.string().optional().nullable(),
  notes: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== "OWNER" && session.role !== "CASHIER")) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = stockInSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 });
    }

    const { productId, quantity, costPrice, supplierId, notes } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        throw new Error("Produk tidak ditemukan");
      }

      const previousStock = product.stock;
      const newStock = previousStock + quantity;

      // Update product stock and optionally costPrice & supplierId
      const updateData: any = {
        stock: newStock,
      };
      if (costPrice !== undefined && costPrice > 0) {
        updateData.costPrice = costPrice;
      }
      if (supplierId) {
        updateData.supplierId = supplierId;
      }

      const updatedProduct = await tx.product.update({
        where: { id: productId },
        data: updateData,
        include: { category: true, supplier: true },
      });

      // Create inventory movement
      const movement = await tx.inventoryMovement.create({
        data: {
          productId,
          type: "PURCHASE",
          quantity,
          previousStock,
          newStock,
          notes: notes?.trim() || "Penambahan stok masuk (Restock)",
          createdById: session.userId,
        },
      });

      return { product: updatedProduct, movement };
    });

    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (error: any) {
    console.error("Stock In Error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal menambahkan stok" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateDigitalProductSchema = z.object({
  name: z.string().min(2).optional(),
  costPrice: z.number().min(0).optional(),
  sellingPrice: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
});

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
    const parsed = updateDigitalProductSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 });
    }

    const updated = await prisma.digitalProduct.update({
      where: { id: params.id },
      data: parsed.data,
    });

    return NextResponse.json({ success: true, product: updated });
  } catch (error) {
    return NextResponse.json({ error: "Gagal memperbarui produk digital" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session || (session.role !== "OWNER" && session.role !== "CASHIER")) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  try {
    const product = await prisma.digitalProduct.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            transactions: true,
          },
        },
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Produk digital tidak ditemukan" }, { status: 404 });
    }

    if (product._count.transactions > 0) {
      await prisma.digitalProduct.update({
        where: { id: params.id },
        data: { isActive: false },
      });
      return NextResponse.json({
        success: true,
        message: "Produk digital dinonaktifkan karena memiliki riwayat transaksi",
        softDeleted: true,
      });
    }

    await prisma.digitalProduct.delete({
      where: { id: params.id },
    });

    return NextResponse.json({
      success: true,
      message: "Produk digital berhasil dihapus permanen",
      softDeleted: false,
    });
  } catch (error: any) {
    console.error("DELETE Digital Product Error:", error);
    return NextResponse.json({ error: error.message || "Gagal menghapus produk digital" }, { status: 500 });
  }
}

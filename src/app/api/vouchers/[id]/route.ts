import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateVoucherSchema = z.object({
  costPrice: z.number().min(0).optional(),
  sellingPrice: z.number().min(0).optional(),
  minStock: z.number().int().min(0).optional(),
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
    const parsed = updateVoucherSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 });
    }

    const updated = await prisma.voucher.update({
      where: { id: params.id },
      data: parsed.data,
    });

    return NextResponse.json({ success: true, voucher: updated });
  } catch (error) {
    return NextResponse.json({ error: "Gagal memperbarui voucher" }, { status: 500 });
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
    const voucher = await prisma.voucher.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            saleItems: true,
          },
        },
      },
    });

    if (!voucher) {
      return NextResponse.json({ error: "Voucher tidak ditemukan" }, { status: 404 });
    }

    // Jika voucher sudah pernah terjual, lakukan soft-delete agar laporan transaksi tetap aman
    if (voucher._count.saleItems > 0) {
      await prisma.voucher.update({
        where: { id: params.id },
        data: { isActive: false },
      });

      return NextResponse.json({
        success: true,
        message: "Voucher dinonaktifkan dari katalog karena memiliki riwayat penjualan",
        softDeleted: true,
      });
    }

    // Jika belum ada penjualan, hapus riwayat mutasi stok lalu hapus permanen
    await prisma.voucherMovement.deleteMany({
      where: { voucherId: params.id },
    });

    await prisma.voucher.delete({
      where: { id: params.id },
    });

    return NextResponse.json({
      success: true,
      message: "Voucher berhasil dihapus permanen dari sistem",
      softDeleted: false,
    });
  } catch (error: any) {
    console.error("DELETE Voucher Error:", error);
    return NextResponse.json({ error: error.message || "Gagal menghapus voucher" }, { status: 500 });
  }
}

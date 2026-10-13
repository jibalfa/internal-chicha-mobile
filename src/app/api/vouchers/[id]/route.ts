import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withDbRetry } from "@/lib/dbRetry";
import { z } from "zod";

const updateVoucherSchema = z.object({
  costPrice: z.number().min(0).optional(),
  sellingPrice: z.number().min(0).optional(),
  stock: z.number().int().min(0).optional(),
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

    const { stock, costPrice, sellingPrice, minStock, isActive } = parsed.data;

    const result = await withDbRetry(async () => {
      const current = await prisma.voucher.findUnique({
        where: { id: params.id },
      });

      if (!current) {
        throw new Error("Voucher tidak ditemukan");
      }

      // Check if stock is being adjusted
      const stockChanged = stock !== undefined && stock !== current.stock;
      const stockDiff = stockChanged ? stock! - current.stock : 0;

      const updated = await prisma.$transaction(async (tx) => {
        const v = await tx.voucher.update({
          where: { id: params.id },
          data: {
            ...(costPrice !== undefined ? { costPrice } : {}),
            ...(sellingPrice !== undefined ? { sellingPrice } : {}),
            ...(stock !== undefined ? { stock } : {}),
            ...(minStock !== undefined ? { minStock } : {}),
            ...(isActive !== undefined ? { isActive } : {}),
          },
        });

        if (stockChanged) {
          await tx.voucherMovement.create({
            data: {
              voucherId: params.id,
              type: "ADJUSTMENT",
              quantity: stockDiff,
              previousStock: current.stock,
              newStock: stock!,
              notes: `Penyesuaian stok langsung dari katalog voucher oleh ${session.name}`,
            },
          });
        }

        return v;
      });

      return updated;
    }, { operationName: "Update Voucher" });

    return NextResponse.json({ success: true, voucher: result });
  } catch (error: any) {
    console.error("PUT Voucher Error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal memperbarui voucher" },
      { status: 500 }
    );
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
    const result = await withDbRetry(async () => {
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
        throw new Error("Voucher tidak ditemukan");
      }

      // Jika voucher sudah pernah terjual, lakukan soft-delete agar laporan transaksi tetap aman
      if (voucher._count.saleItems > 0) {
        await prisma.voucher.update({
          where: { id: params.id },
          data: { isActive: false },
        });

        return {
          softDeleted: true,
          message: "Voucher dinonaktifkan dari katalog karena memiliki riwayat penjualan",
        };
      }

      // Jika belum ada penjualan, hapus riwayat mutasi stok lalu hapus permanen
      await prisma.voucherMovement.deleteMany({
        where: { voucherId: params.id },
      });

      await prisma.voucher.delete({
        where: { id: params.id },
      });

      return {
        softDeleted: false,
        message: "Voucher berhasil dihapus permanen dari sistem",
      };
    }, { operationName: "Delete Voucher" });

    return NextResponse.json({
      success: true,
      message: result.message,
      softDeleted: result.softDeleted,
    });
  } catch (error: any) {
    console.error("DELETE Voucher Error:", error);
    return NextResponse.json({ error: error.message || "Gagal menghapus voucher" }, { status: 500 });
  }
}

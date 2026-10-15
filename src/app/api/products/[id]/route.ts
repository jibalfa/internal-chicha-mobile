import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateProductSchema = z.object({
  sku: z.string().min(2).optional(),
  barcode: z.string().optional().nullable(),
  name: z.string().min(2).optional(),
  categoryId: z.string().optional(),
  brand: z.string().optional().nullable(),
  costPrice: z.number().min(0).optional(),
  sellingPrice: z.number().min(0).optional(),
  minStock: z.number().int().min(0).optional(),
  supplierId: z.string().optional().nullable(),
  type: z.enum(["ACCESSORY", "GENERAL"]).optional(),
  isActive: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const product = await prisma.product.findUnique({
      where: { id: params.id },
      include: {
        category: true,
        supplier: true,
        inventoryMovements: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { createdBy: { select: { name: true } } },
        },
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json({ product });
  } catch (error) {
    return NextResponse.json({ error: "Gagal mengambil detail produk" }, { status: 500 });
  }
}

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
    const parsed = updateProductSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 });
    }

    const dataToUpdate: any = { ...parsed.data };
    if (dataToUpdate.sku) {
      dataToUpdate.sku = dataToUpdate.sku.trim().toUpperCase();
      const existingSku = await prisma.product.findFirst({
        where: { sku: dataToUpdate.sku, NOT: { id: params.id } },
      });
      if (existingSku) {
        return NextResponse.json({ error: `SKU "${dataToUpdate.sku}" sudah digunakan produk lain` }, { status: 409 });
      }
    }

    if (dataToUpdate.barcode !== undefined) {
      const cleanBarcode = dataToUpdate.barcode && dataToUpdate.barcode.trim() !== "" ? dataToUpdate.barcode.trim() : null;
      dataToUpdate.barcode = cleanBarcode;
      if (cleanBarcode) {
        const existingBarcode = await (prisma.product as any).findFirst({
          where: { barcode: cleanBarcode, NOT: { id: params.id } },
        });
        if (existingBarcode) {
          return NextResponse.json({ error: `Barcode "${cleanBarcode}" sudah digunakan oleh produk lain (${existingBarcode.name})` }, { status: 409 });
        }
      }
    }

    const updated = await (prisma.product as any).update({
      where: { id: params.id },
      data: dataToUpdate,
      include: { category: true, supplier: true },
    });

    return NextResponse.json({ success: true, product: updated });
  } catch (error) {
    return NextResponse.json({ error: "Gagal memperbarui produk" }, { status: 500 });
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
    const product = await prisma.product.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            saleItems: true,
          },
        },
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });
    }

    // Jika produk sudah memiliki riwayat penjualan, lakukan soft-delete agar laporan keuangan tetap valid
    if (product._count.saleItems > 0) {
      await prisma.product.update({
        where: { id: params.id },
        data: { isActive: false },
      });

      return NextResponse.json({
        success: true,
        message: "Produk dinonaktifkan dari katalog karena memiliki riwayat penjualan",
        softDeleted: true,
      });
    }

    // Jika belum ada riwayat penjualan, hapus riwayat mutasi stok lalu hapus produk secara permanen
    await prisma.inventoryMovement.deleteMany({
      where: { productId: params.id },
    });

    await prisma.product.delete({
      where: { id: params.id },
    });

    return NextResponse.json({
      success: true,
      message: "Produk berhasil dihapus permanen dari sistem",
      softDeleted: false,
    });
  } catch (error: any) {
    console.error("DELETE Product Error:", error);
    return NextResponse.json({ error: error.message || "Gagal menghapus produk" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const DEFAULT_TYPES = ["TOP-UP", "TARIK TUNAI", "PULSA", "TAGIHAN"];

export async function GET() {
  try {
    const products = await prisma.digitalProduct.findMany({
      where: { isActive: true },
      select: { category: true },
      distinct: ["category"],
    });

    const dbCategories = products.map((p) => p.category.trim().toUpperCase());
    const allTypes = Array.from(new Set([...DEFAULT_TYPES, ...dbCategories]));

    return NextResponse.json({ types: allTypes });
  } catch (error) {
    console.error("GET Digital Types Error:", error);
    return NextResponse.json({ error: "Gagal mengambil jenis transaksi" }, { status: 500 });
  }
}

const createTypeSchema = z.object({
  name: z.string().min(2, "Nama jenis transaksi minimal 2 karakter"),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== "OWNER" && session.role !== "CASHIER")) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = createTypeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 });
    }

    const categoryName = parsed.data.name.trim().toUpperCase();

    // Find or create a DigitalProduct entry for this category
    let product = await prisma.digitalProduct.findFirst({
      where: { category: categoryName },
    });

    if (product) {
      if (!product.isActive) {
        await prisma.digitalProduct.update({
          where: { id: product.id },
          data: { isActive: true },
        });
      }
    } else {
      product = await prisma.digitalProduct.create({
        data: {
          category: categoryName,
          provider: "GENERAL",
          name: parsed.data.name.trim(),
          nominal: 0,
          costPrice: 0,
          sellingPrice: 0,
          isActive: true,
        },
      });
    }

    return NextResponse.json({ success: true, type: categoryName }, { status: 201 });
  } catch (error) {
    console.error("POST Digital Type Error:", error);
    return NextResponse.json({ error: "Gagal menambahkan jenis transaksi" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "OWNER") {
    return NextResponse.json({ error: "Akses ditolak. Khusus Owner." }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const categoryName = searchParams.get("name")?.trim().toUpperCase();

    if (!categoryName) {
      return NextResponse.json({ error: "Nama jenis transaksi wajib diisi" }, { status: 400 });
    }

    if (DEFAULT_TYPES.includes(categoryName)) {
      return NextResponse.json({ error: "Jenis transaksi bawaan tidak dapat dihapus" }, { status: 400 });
    }

    await prisma.digitalProduct.updateMany({
      where: { category: categoryName },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true, message: `Jenis transaksi "${categoryName}" berhasil dihapus` });
  } catch (error) {
    console.error("DELETE Digital Type Error:", error);
    return NextResponse.json({ error: "Gagal menghapus jenis transaksi" }, { status: 500 });
  }
}

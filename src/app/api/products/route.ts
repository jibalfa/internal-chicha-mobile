import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createProductSchema = z.object({
  sku: z.string().min(2, "SKU minimal 2 karakter"),
  name: z.string().min(2, "Nama produk minimal 2 karakter"),
  categoryId: z.string().min(1, "Kategori wajib dipilih"),
  brand: z.string().optional(),
  costPrice: z.number().min(0, "Harga modal tidak boleh negatif"),
  sellingPrice: z.number().min(0, "Harga jual tidak boleh negatif"),
  stock: z.number().int().min(0, "Stok awal tidak boleh negatif").default(0),
  minStock: z.number().int().min(0).default(5),
  supplierId: z.string().optional().nullable(),
  type: z.enum(["ACCESSORY", "GENERAL"]).default("ACCESSORY"),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";
    const type = searchParams.get("type");
    const categoryId = searchParams.get("categoryId");
    const lowStock = searchParams.get("lowStock") === "true";

    const where: any = { isActive: true };

    if (type && type !== "ALL") {
      where.type = type;
    }

    if (categoryId && categoryId !== "ALL") {
      where.categoryId = categoryId;
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { sku: { contains: search } },
        { brand: { contains: search } },
      ];
    }

    const session = await getSession();
    const isOwner = session?.role === "OWNER";

    let products = await prisma.product.findMany({
      where,
      include: {
        category: true,
        supplier: true,
      },
      orderBy: { name: "asc" },
    });

    if (lowStock) {
      products = products.filter((p) => p.stock <= p.minStock);
    }

    const sanitizedProducts = isOwner
      ? products
      : products.map((p) => ({
          ...p,
          costPrice: 0,
        }));

    return NextResponse.json({ products: sanitizedProducts });
  } catch (error) {
    console.error("GET Products Error:", error);
    return NextResponse.json({ error: "Gagal mengambil data produk" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== "OWNER" && session.role !== "CASHIER")) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = createProductSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 });
    }

    const {
      sku,
      name,
      categoryId,
      brand,
      costPrice,
      sellingPrice,
      stock,
      minStock,
      supplierId,
      type,
    } = parsed.data;

    const existing = await prisma.product.findUnique({
      where: { sku: sku.trim().toUpperCase() },
    });
    if (existing) {
      return NextResponse.json({ error: `SKU "${sku}" sudah digunakan` }, { status: 409 });
    }

    // Atomic transaction: create product + initial movement
    const product = await prisma.$transaction(async (tx) => {
      const newProd = await tx.product.create({
        data: {
          sku: sku.trim().toUpperCase(),
          name: name.trim(),
          categoryId,
          brand: brand?.trim() || null,
          costPrice,
          sellingPrice,
          stock,
          minStock,
          supplierId: supplierId || null,
          type,
          isActive: true,
        },
        include: {
          category: true,
          supplier: true,
        },
      });

      if (stock > 0) {
        await tx.inventoryMovement.create({
          data: {
            productId: newProd.id,
            type: "INITIAL_STOCK",
            quantity: stock,
            previousStock: 0,
            newStock: stock,
            notes: "Saldo awal saat registrasi produk",
            createdById: session.userId,
          },
        });
      }

      return newProd;
    });

    return NextResponse.json({ success: true, product }, { status: 201 });
  } catch (error) {
    console.error("POST Product Error:", error);
    return NextResponse.json({ error: "Gagal menyimpan produk" }, { status: 500 });
  }
}

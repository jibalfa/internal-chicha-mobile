import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createDigitalProductSchema = z.object({
  category: z.string().min(2, "Kategori wajib diisi"),
  provider: z.string().min(2, "Provider wajib diisi"),
  name: z.string().min(2, "Nama produk digital minimal 2 karakter"),
  nominal: z.number().min(0).default(0),
  costPrice: z.number().min(0, "Harga modal tidak boleh negatif"),
  sellingPrice: z.number().min(0, "Harga jual tidak boleh negatif"),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const provider = searchParams.get("provider");

    const session = await getSession();
    const isOwner = session?.role === "OWNER";

    const where: any = { isActive: true };
    if (category && category !== "ALL") where.category = category;
    if (provider && provider !== "ALL") where.provider = provider;

    const products = await prisma.digitalProduct.findMany({
      where,
      orderBy: [{ category: "asc" }, { provider: "asc" }, { nominal: "asc" }],
    });

    const sanitizedProducts = isOwner
      ? products
      : products.map((p) => ({
          ...p,
          costPrice: 0,
        }));

    return NextResponse.json({ products: sanitizedProducts });
  } catch (error) {
    console.error("GET Digital Products Error:", error);
    return NextResponse.json({ error: "Gagal mengambil produk digital" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== "OWNER" && session.role !== "CASHIER")) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = createDigitalProductSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 });
    }

    const { category, provider, name, nominal, costPrice, sellingPrice } = parsed.data;

    const product = await prisma.digitalProduct.create({
      data: {
        category: category.trim().toUpperCase(),
        provider: provider.trim(),
        name: name.trim(),
        nominal,
        costPrice,
        sellingPrice,
        isActive: true,
      },
    });

    return NextResponse.json({ success: true, product }, { status: 201 });
  } catch (error) {
    console.error("POST Digital Product Error:", error);
    return NextResponse.json({ error: "Gagal membuat produk digital" }, { status: 500 });
  }
}

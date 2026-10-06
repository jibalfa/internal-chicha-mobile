import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createVoucherSchema = z.object({
  operator: z.string().min(2, "Nama operator minimal 2 karakter"),
  nominal: z.string().min(1, "Nominal wajib diisi"),
  costPrice: z.number().min(0, "Harga modal tidak boleh negatif"),
  sellingPrice: z.number().min(0, "Harga jual tidak boleh negatif"),
  stock: z.number().int().min(0, "Stok awal tidak boleh negatif").default(0),
  minStock: z.number().int().min(0).default(10),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const operator = searchParams.get("operator");
    const lowStock = searchParams.get("lowStock") === "true";

    const where: any = { isActive: true };
    if (operator && operator !== "ALL") {
      where.operator = operator;
    }

    const session = await getSession();
    const isOwner = session?.role === "OWNER";

    let vouchers = await prisma.voucher.findMany({
      where,
      orderBy: [{ operator: "asc" }, { costPrice: "asc" }],
    });

    if (lowStock) {
      vouchers = vouchers.filter((v) => v.stock <= v.minStock);
    }

    const sanitizedVouchers = isOwner
      ? vouchers
      : vouchers.map((v) => ({
          ...v,
          costPrice: 0,
        }));

    return NextResponse.json({ vouchers: sanitizedVouchers });
  } catch (error) {
    console.error("GET Vouchers Error:", error);
    return NextResponse.json({ error: "Gagal mengambil data voucher" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== "OWNER" && session.role !== "CASHIER")) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = createVoucherSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 });
    }

    const { operator, nominal, costPrice, sellingPrice, stock, minStock } = parsed.data;

    // Check unique operator + nominal
    const existing = await prisma.voucher.findUnique({
      where: {
        operator_nominal: {
          operator: operator.trim(),
          nominal: nominal.trim(),
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Voucher ${operator} nominal ${nominal} sudah terdaftar` },
        { status: 409 }
      );
    }

    // Atomic transaction: create voucher + initial movement
    const voucher = await prisma.$transaction(async (tx) => {
      const v = await tx.voucher.create({
        data: {
          operator: operator.trim(),
          nominal: nominal.trim(),
          costPrice,
          sellingPrice,
          stock,
          minStock,
          isActive: true,
        },
      });

      if (stock > 0) {
        await tx.voucherMovement.create({
          data: {
            voucherId: v.id,
            type: "INITIAL_STOCK",
            quantity: stock,
            previousStock: 0,
            newStock: stock,
            notes: "Saldo awal inventaris voucher",
          },
        });
      }

      return v;
    });

    return NextResponse.json({ success: true, voucher }, { status: 201 });
  } catch (error) {
    console.error("POST Voucher Error:", error);
    return NextResponse.json({ error: "Gagal menambahkan voucher" }, { status: 500 });
  }
}

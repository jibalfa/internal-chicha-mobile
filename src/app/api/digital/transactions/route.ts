import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateDigitalProfit } from "@/lib/calculations";
import { z } from "zod";

const createDigitalTransactionSchema = z.object({
  digitalProductId: z.string().optional(),
  category: z.string().optional(),
  nominal: z.number().min(0).optional(),
  adminFee: z.number().min(0).optional().default(2000),
  destinationNumber: z.string().optional(),
  status: z.enum(["PENDING", "SUCCESS", "FAILED", "REFUNDED"]).default("SUCCESS"),
  notes: z.string().optional(),
});

// Helper to generate transaction number: DGT-YYYYMMDD-XXXX
async function generateDigitalTrxNumber(): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `DGT-${dateStr}`;

  const lastTrx = await prisma.digitalTransaction.findFirst({
    where: { trxNumber: { startsWith: prefix } },
    orderBy: { trxNumber: "desc" },
  });

  let counter = 1;
  if (lastTrx && lastTrx.trxNumber) {
    const parts = lastTrx.trxNumber.split("-");
    const lastCounter = parseInt(parts[2] || "0", 10);
    if (!isNaN(lastCounter)) {
      counter = lastCounter + 1;
    }
  }

  return `${prefix}-${String(counter).padStart(4, "0")}`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const search = searchParams.get("search")?.trim() || "";
    const limit = parseInt(searchParams.get("limit") || "100", 10);

    const where: any = {};
    if (status && status !== "ALL") where.status = status;
    if (category && category !== "ALL") {
      where.digitalProduct = { category };
    }
    if (search) {
      where.OR = [
        { trxNumber: { contains: search } },
        { destinationNumber: { contains: search } },
        { notes: { contains: search } },
        { digitalProduct: { category: { contains: search } } },
      ];
    }

    const session = await getSession();
    const isOwner = session?.role === "OWNER";

    const transactions = await prisma.digitalTransaction.findMany({
      where,
      include: {
        digitalProduct: true,
        cashier: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const sanitizedTransactions = isOwner
      ? transactions
      : transactions.map((t) => ({
          ...t,
          costPrice: 0,
          profit: 0,
          digitalProduct: t.digitalProduct
            ? { ...t.digitalProduct, costPrice: 0 }
            : t.digitalProduct,
        }));

    return NextResponse.json({ transactions: sanitizedTransactions });
  } catch (error) {
    console.error("GET Digital Transactions Error:", error);
    return NextResponse.json(
      { error: "Gagal mengambil data transaksi digital" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== "OWNER" && session.role !== "CASHIER")) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = createDigitalTransactionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 });
    }

    const {
      digitalProductId,
      category,
      nominal,
      adminFee,
      destinationNumber,
      status,
      notes,
    } = parsed.data;

    let targetProductId = digitalProductId;
    let costPrice = 0;
    let sellingPrice = 0;
    let profit = 0;

    // Handle Custom / Ad-hoc Digital Transaction Type
    if (category && (nominal !== undefined || adminFee !== undefined)) {
      const cleanNominal = Number(nominal || 0);
      const cleanAdminFee = Number(adminFee || 0);
      const cleanCat = category.trim().toUpperCase();

      let genericProduct = await prisma.digitalProduct.findFirst({
        where: {
          category: cleanCat,
          name: `Transaksi ${cleanCat}`,
        },
      });

      if (!genericProduct) {
        genericProduct = await prisma.digitalProduct.create({
          data: {
            category: cleanCat,
            provider: cleanCat,
            name: `Transaksi ${cleanCat}`,
            nominal: 0,
            costPrice: 0,
            sellingPrice: 0,
          },
        });
      }

      targetProductId = genericProduct.id;
      costPrice = cleanNominal;
      sellingPrice = cleanNominal + cleanAdminFee;
      profit = cleanAdminFee;
    } else if (digitalProductId) {
      const product = await prisma.digitalProduct.findUnique({
        where: { id: digitalProductId },
      });

      if (!product) {
        return NextResponse.json({ error: "Produk digital tidak ditemukan" }, { status: 404 });
      }

      costPrice = product.costPrice;
      sellingPrice = product.sellingPrice;
      profit = calculateDigitalProfit(sellingPrice, costPrice, status);
    } else {
      return NextResponse.json({ error: "Kategori atau produk digital wajib ditentukan" }, { status: 400 });
    }

    const trxNumber = await generateDigitalTrxNumber();

    const transaction = await prisma.digitalTransaction.create({
      data: {
        trxNumber,
        digitalProductId: targetProductId!,
        destinationNumber: destinationNumber?.trim() || notes?.trim() || "-",
        costPrice,
        sellingPrice,
        profit,
        status,
        notes: notes?.trim() || null,
        cashierId: session.userId,
      },
      include: {
        digitalProduct: true,
        cashier: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ success: true, transaction }, { status: 201 });
  } catch (error) {
    console.error("POST Digital Transaction Error:", error);
    return NextResponse.json(
      { error: "Gagal memproses transaksi digital" },
      { status: 500 }
    );
  }
}

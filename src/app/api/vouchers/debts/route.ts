import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createDebtSchema = z.object({
  customerName: z.string().min(1, "Nama pelanggan wajib diisi"),
  customerPhone: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z
    .array(
      z.object({
        voucherId: z.string().min(1, "Voucher ID wajib diisi"),
        quantity: z.number().int().min(1, "Jumlah minimal 1 pcs"),
      })
    )
    .min(1, "Minimal pilih 1 jenis voucher"),
});

// Helper to generate Debt Number: BON-YYYYMMDD-XXXX
async function generateDebtNumber(tx: any): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `BON-${dateStr}`;

  const lastDebt = await tx.voucherDebt.findFirst({
    where: { debtNumber: { startsWith: prefix } },
    orderBy: { debtNumber: "desc" },
  });

  let counter = 1;
  if (lastDebt && lastDebt.debtNumber) {
    const parts = lastDebt.debtNumber.split("-");
    const lastCounter = parseInt(parts[2] || "0", 10);
    if (!isNaN(lastCounter)) {
      counter = lastCounter + 1;
    }
  }

  return `${prefix}-${String(counter).padStart(4, "0")}`;
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status")?.toUpperCase() || "ALL";
    const search = searchParams.get("search")?.trim() || "";

    const where: any = {};

    if (statusParam && statusParam !== "ALL") {
      where.status = statusParam;
    }

    if (search) {
      where.OR = [
        { customerName: { contains: search, mode: "insensitive" } },
        { customerPhone: { contains: search, mode: "insensitive" } },
        { debtNumber: { contains: search, mode: "insensitive" } },
        { notes: { contains: search, mode: "insensitive" } },
      ];
    }

    const debts = await prisma.voucherDebt.findMany({
      where,
      include: {
        cashier: { select: { id: true, name: true, username: true } },
        items: {
          include: {
            voucher: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Summary calculations
    const allDebts = await prisma.voucherDebt.findMany({
      select: {
        id: true,
        status: true,
        totalAmount: true,
        paidAt: true,
      },
    });

    const unpaidDebts = allDebts.filter((d) => d.status === "UNPAID");
    const unpaidCount = unpaidDebts.length;
    const unpaidTotal = unpaidDebts.reduce((sum, d) => sum + d.totalAmount, 0);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const paidToday = allDebts.filter(
      (d) => d.status === "PAID" && d.paidAt && new Date(d.paidAt) >= todayStart && new Date(d.paidAt) <= todayEnd
    );
    const paidTodayCount = paidToday.length;
    const paidTodayTotal = paidToday.reduce((sum, d) => sum + d.totalAmount, 0);

    return NextResponse.json({
      debts,
      summary: {
        unpaidCount,
        unpaidTotal,
        paidTodayCount,
        paidTodayTotal,
      },
    });
  } catch (error) {
    console.error("GET Voucher Debts Error:", error);
    return NextResponse.json({ error: "Gagal mengambil data piutang voucher" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== "OWNER" && session.role !== "CASHIER")) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = createDebtSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 });
    }

    const { customerName, customerPhone, dueDate, notes, items } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch and validate voucher stock
      const voucherIds = items.map((i) => i.voucherId);
      const vouchers = await tx.voucher.findMany({
        where: { id: { in: voucherIds } },
      });

      const voucherMap = new Map(vouchers.map((v) => [v.id, v]));

      let totalAmount = 0;
      const debtItemsData: any[] = [];
      const stockUpdates: any[] = [];
      const movementsData: any[] = [];

      for (const item of items) {
        const voucher = voucherMap.get(item.voucherId);
        if (!voucher) {
          throw new Error("Voucher tidak ditemukan dalam database.");
        }

        if (voucher.stock < item.quantity) {
          throw new Error(
            `Stok voucher ${voucher.operator} ${voucher.nominal} tidak mencukupi! Tersedia: ${voucher.stock} pcs, diminta: ${item.quantity} pcs.`
          );
        }

        const subtotal = item.quantity * voucher.sellingPrice;
        const profit = item.quantity * (voucher.sellingPrice - voucher.costPrice);
        totalAmount += subtotal;

        debtItemsData.push({
          voucherId: voucher.id,
          quantity: item.quantity,
          costPrice: voucher.costPrice,
          unitPrice: voucher.sellingPrice,
          subtotal,
          profit,
        });

        const prevStock = voucher.stock;
        const newStock = prevStock - item.quantity;

        stockUpdates.push({
          id: voucher.id,
          newStock,
        });

        movementsData.push({
          voucherId: voucher.id,
          type: "SOLD",
          quantity: item.quantity,
          previousStock: prevStock,
          newStock,
          notes: `Bon Pelanggan: ${customerName}`,
        });
      }

      const debtNumber = await generateDebtNumber(tx);

      // 2. Create VoucherDebt
      const debt = await tx.voucherDebt.create({
        data: {
          debtNumber,
          customerName: customerName.trim(),
          customerPhone: customerPhone?.trim() || null,
          dueDate: dueDate ? new Date(dueDate) : null,
          notes: notes?.trim() || null,
          totalAmount,
          status: "UNPAID",
          cashierId: session.userId,
          items: {
            create: debtItemsData,
          },
        },
        include: {
          items: { include: { voucher: true } },
          cashier: { select: { id: true, name: true } },
        },
      });

      // 3. Deduct Voucher stock and record movements
      for (const u of stockUpdates) {
        await tx.voucher.update({
          where: { id: u.id },
          data: { stock: u.newStock },
        });
      }

      for (const m of movementsData) {
        await tx.voucherMovement.create({
          data: {
            ...m,
            referenceId: debtNumber,
          },
        });
      }

      return debt;
    });

    return NextResponse.json({ success: true, debt: result }, { status: 201 });
  } catch (error: any) {
    console.error("Create Voucher Debt Error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal mencatat bon voucher pelanggan" },
      { status: 400 }
    );
  }
}

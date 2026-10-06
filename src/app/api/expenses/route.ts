import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createExpenseSchema = z.object({
  date: z.string().optional(),
  category: z.enum([
    "ELECTRICITY",
    "INTERNET",
    "RENT",
    "OPERATIONAL",
    "TRANSPORT",
    "SALARY",
    "OTHER",
  ]).default("OPERATIONAL"),
  description: z.string().min(2, "Deskripsi pengeluaran minimal 2 karakter"),
  amount: z.number().min(1, "Nominal pengeluaran minimal Rp 1"),
  notes: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "OWNER") {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const where: any = {};
    if (category && category !== "ALL") where.category = category;
    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    const expenses = await prisma.expense.findMany({
      where,
      include: {
        createdBy: { select: { id: true, name: true, role: true } },
      },
      orderBy: { date: "desc" },
    });

    const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);

    return NextResponse.json({ expenses, totalAmount });
  } catch (error) {
    console.error("GET Expenses Error:", error);
    return NextResponse.json({ error: "Gagal mengambil data pengeluaran" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "OWNER") {
    return NextResponse.json({ error: "Akses ditolak. Khusus Owner." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = createExpenseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 });
    }

    const { date, category, description, amount, notes } = parsed.data;

    const expense = await prisma.expense.create({
      data: {
        date: date ? new Date(date) : new Date(),
        category,
        description: description.trim(),
        amount,
        notes: notes?.trim() || null,
        createdById: session.userId,
      },
      include: {
        createdBy: { select: { id: true, name: true, role: true } },
      },
    });

    return NextResponse.json({ success: true, expense }, { status: 201 });
  } catch (error) {
    console.error("POST Expense Error:", error);
    return NextResponse.json({ error: "Gagal mencatat pengeluaran" }, { status: 500 });
  }
}

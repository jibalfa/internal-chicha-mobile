import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateExpenseSchema = z.object({
  date: z.string().optional(),
  category: z.enum([
    "ELECTRICITY",
    "INTERNET",
    "RENT",
    "OPERATIONAL",
    "TRANSPORT",
    "SALARY",
    "OTHER",
  ]).optional(),
  description: z.string().min(2, "Deskripsi pengeluaran minimal 2 karakter").optional(),
  amount: z.number().min(1, "Nominal pengeluaran minimal Rp 1").optional(),
  notes: z.string().optional().nullable(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session || session.role !== "OWNER") {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = updateExpenseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 });
    }

    const updateData: any = { ...parsed.data };
    if (updateData.date) {
      updateData.date = new Date(updateData.date);
    }

    const updated = await prisma.expense.update({
      where: { id: params.id },
      data: updateData,
      include: {
        createdBy: { select: { id: true, name: true, role: true } },
      },
    });

    return NextResponse.json({ success: true, expense: updated });
  } catch (error) {
    console.error("PUT Expense Error:", error);
    return NextResponse.json({ error: "Gagal memperbarui pengeluaran" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session || session.role !== "OWNER") {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  try {
    await prisma.expense.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true, message: "Pengeluaran berhasil dihapus" });
  } catch (error) {
    return NextResponse.json({ error: "Gagal menghapus pengeluaran" }, { status: 500 });
  }
}

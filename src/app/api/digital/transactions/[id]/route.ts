import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateDigitalProfit } from "@/lib/calculations";
import { z } from "zod";

const updateStatusSchema = z.object({
  status: z.enum(["PENDING", "SUCCESS", "FAILED", "REFUNDED"]),
  notes: z.string().optional(),
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
    const parsed = updateStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 });
    }

    const { status, notes } = parsed.data;

    const existing = await prisma.digitalTransaction.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Transaksi tidak ditemukan" }, { status: 404 });
    }

    // Recalculate profit based on new status
    const newProfit = calculateDigitalProfit(existing.sellingPrice, existing.costPrice, status);

    const updated = await prisma.digitalTransaction.update({
      where: { id: params.id },
      data: {
        status,
        profit: newProfit,
        notes: notes !== undefined ? notes : existing.notes,
      },
      include: {
        digitalProduct: true,
        cashier: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ success: true, transaction: updated });
  } catch (error) {
    console.error("Update Digital Transaction Error:", error);
    return NextResponse.json(
      { error: "Gagal memperbarui status transaksi" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session || session.role !== "OWNER") {
    return NextResponse.json({ error: "Akses ditolak. Khusus Owner." }, { status: 403 });
  }

  try {
    const existing = await prisma.digitalTransaction.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Transaksi tidak ditemukan" }, { status: 404 });
    }

    await prisma.digitalTransaction.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true, message: "Transaksi digital berhasil dihapus" });
  } catch (error) {
    console.error("DELETE Digital Transaction Error:", error);
    return NextResponse.json(
      { error: "Gagal menghapus transaksi digital" },
      { status: 500 }
    );
  }
}

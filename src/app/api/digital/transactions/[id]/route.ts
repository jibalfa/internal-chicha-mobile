import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateDigitalProfit } from "@/lib/calculations";
import { z } from "zod";

const updateDigitalTransactionSchema = z.object({
  status: z.enum(["PENDING", "SUCCESS", "FAILED", "REFUNDED"]).optional(),
  category: z.string().optional(),
  nominal: z.number().min(0).optional(),
  adminFee: z.number().min(0).optional(),
  destinationNumber: z.string().optional(),
  notes: z.string().optional(),
  date: z.string().optional(), // YYYY-MM-DD
  time: z.string().optional(), // HH:mm
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
    const parsed = updateDigitalTransactionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 });
    }

    const {
      status,
      category,
      nominal,
      adminFee,
      destinationNumber,
      notes,
      date,
      time,
    } = parsed.data;

    const existing = await prisma.digitalTransaction.findUnique({
      where: { id: params.id },
      include: { digitalProduct: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Transaksi tidak ditemukan" }, { status: 404 });
    }

    let targetProductId = existing.digitalProductId;
    if (category) {
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
    }

    // Determine updated financial values
    const newStatus = status || existing.status;
    const cleanNominal = nominal !== undefined ? Number(nominal) : existing.costPrice;
    const cleanAdminFee = adminFee !== undefined ? Number(adminFee) : existing.profit;

    const costPrice = cleanNominal;
    const sellingPrice = cleanNominal + cleanAdminFee;
    const profit = (newStatus === "FAILED" || newStatus === "REFUNDED") ? 0 : cleanAdminFee;

    // Determine updated date / createdAt
    let newCreatedAt = existing.createdAt;
    if (date) {
      const parts = date.split("-");
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        const origDate = new Date(existing.createdAt);
        let hours = origDate.getHours();
        let minutes = origDate.getMinutes();
        let seconds = origDate.getSeconds();
        if (time) {
          const tParts = time.split(":");
          if (tParts.length >= 2) {
            hours = parseInt(tParts[0], 10) || 0;
            minutes = parseInt(tParts[1], 10) || 0;
            seconds = 0;
          }
        }
        newCreatedAt = new Date(y, m, d, hours, minutes, seconds);
      }
    }

    const updated = await prisma.digitalTransaction.update({
      where: { id: params.id },
      data: {
        digitalProductId: targetProductId,
        costPrice,
        sellingPrice,
        profit,
        status: newStatus,
        destinationNumber: destinationNumber !== undefined ? (destinationNumber.trim() || "-") : existing.destinationNumber,
        notes: notes !== undefined ? (notes.trim() || null) : existing.notes,
        createdAt: newCreatedAt,
      },
      include: {
        digitalProduct: true,
        cashier: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ success: true, transaction: updated });
  } catch (error: any) {
    console.error("Update Digital Transaction Error:", error);
    return NextResponse.json(
      { error: error?.message || "Gagal memperbarui transaksi digital" },
      { status: 500 }
    );
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
    const existing = await prisma.digitalTransaction.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Transaksi tidak ditemukan" }, { status: 404 });
    }

    await prisma.digitalTransaction.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true, message: "Transaksi digital berhasil dibatalkan / dihapus" });
  } catch (error) {
    console.error("DELETE Digital Transaction Error:", error);
    return NextResponse.json(
      { error: "Gagal menghapus transaksi digital" },
      { status: 500 }
    );
  }
}

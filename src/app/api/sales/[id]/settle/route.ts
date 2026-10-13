import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withDbRetry } from "@/lib/dbRetry";
import { z } from "zod";

const settleSchema = z.object({
  paidMethod: z.enum(["CASH", "TRANSFER", "QRIS"]).default("CASH"),
  amount: z.number().min(0).optional(),
  notes: z.string().optional().nullable(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session || (session.role !== "OWNER" && session.role !== "CASHIER")) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = settleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 });
    }

    const { paidMethod, amount, notes } = parsed.data;

    const updatedSale = await withDbRetry(async () => {
      const sale = await prisma.sale.findUnique({
        where: { id: params.id },
      });

      if (!sale) {
        throw new Error("Data transaksi nota/penjualan tidak ditemukan");
      }

      const currentSale = sale as any;
      if (currentSale.paymentStatus === "PAID") {
        throw new Error("Transaksi nota ini sudah lunas sebelumnya");
      }

      const paymentAmount = amount !== undefined ? amount : currentSale.finalAmount;
      const newCashGiven = (currentSale.cashGiven || 0) + paymentAmount;
      const isFullyPaid = newCashGiven >= currentSale.finalAmount;

      return await (prisma.sale.update as any)({
        where: { id: params.id },
        data: {
          cashGiven: newCashGiven,
          paymentStatus: isFullyPaid ? "PAID" : "PARTIAL",
          paidAt: isFullyPaid ? new Date() : currentSale.paidAt,
          paidMethod: paidMethod,
          notes: notes?.trim()
            ? currentSale.notes
              ? `${currentSale.notes} | Pelunasan: ${notes.trim()}`
              : `Pelunasan: ${notes.trim()}`
            : currentSale.notes,
        },
        include: {
          customer: true,
          cashier: { select: { id: true, name: true } },
          items: true,
        },
      });
    }, { operationName: "Settle Credit Sale" });

    return NextResponse.json({
      success: true,
      message: "Pembayaran piutang berhasil dicatat",
      sale: updatedSale,
    });
  } catch (error: any) {
    console.error("Settle Credit Sale Error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal mencatat pelunasan piutang" },
      { status: 400 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const payDebtSchema = z.object({
  action: z.literal("PAY"),
  paidMethod: z.enum(["CASH", "TRANSFER", "QRIS"]).default("CASH"),
  notes: z.string().optional(),
});

// Helper to generate Invoice Number: INV-YYYYMMDD-XXXX
async function generateInvoiceNumber(tx: any): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `INV-${dateStr}`;

  const lastSale = await tx.sale.findFirst({
    where: { invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: "desc" },
  });

  let counter = 1;
  if (lastSale && lastSale.invoiceNumber) {
    const parts = lastSale.invoiceNumber.split("-");
    const lastCounter = parseInt(parts[2] || "0", 10);
    if (!isNaN(lastCounter)) {
      counter = lastCounter + 1;
    }
  }

  return `${prefix}-${String(counter).padStart(4, "0")}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const debt = await prisma.voucherDebt.findUnique({
      where: { id: params.id },
      include: {
        cashier: { select: { id: true, name: true, username: true } },
        items: {
          include: { voucher: true },
        },
      },
    });

    if (!debt) {
      return NextResponse.json({ error: "Data bon voucher tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json({ debt });
  } catch (error) {
    console.error("GET Single Debt Error:", error);
    return NextResponse.json({ error: "Gagal mengambil data bon voucher" }, { status: 500 });
  }
}

// PUT /api/vouchers/debts/[id] - Pay / Settle debt
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
    const parsed = payDebtSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 });
    }

    const { paidMethod, notes: payNotes } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const debt = await tx.voucherDebt.findUnique({
        where: { id: params.id },
        include: {
          items: {
            include: { voucher: true },
          },
        },
      });

      if (!debt) {
        throw new Error("Data bon voucher tidak ditemukan");
      }

      if (debt.status !== "UNPAID") {
        throw new Error(`Bon voucher ini sudah berstatus ${debt.status === "PAID" ? "Lunas" : "Dibatalkan"}.`);
      }

      // Generate invoice number for the sale transaction
      const invoiceNumber = await generateInvoiceNumber(tx);

      // Create Sale record to reflect financial income in sales, cash drawer, and reports
      const sale = await tx.sale.create({
        data: {
          invoiceNumber,
          totalAmount: debt.totalAmount,
          discount: 0,
          finalAmount: debt.totalAmount,
          paymentMethod: paidMethod,
          cashGiven: debt.totalAmount,
          changeGiven: 0,
          notes: `Pelunasan Bon #${debt.debtNumber} (${debt.customerName})${payNotes ? " - " + payNotes.trim() : ""}`,
          cashierId: session.userId,
          items: {
            create: debt.items.map((item) => ({
              itemType: "VOUCHER",
              voucherId: item.voucherId,
              itemName: `Voucher Fisik ${item.voucher.operator} ${item.voucher.nominal}`,
              quantity: item.quantity,
              costPrice: item.costPrice,
              unitPrice: item.unitPrice,
              subtotal: item.subtotal,
              profit: item.profit,
            })),
          },
        },
      });

      // Update debt status to PAID
      const updatedDebt = await tx.voucherDebt.update({
        where: { id: params.id },
        data: {
          status: "PAID",
          paidAt: new Date(),
          paidMethod,
          notes: payNotes
            ? debt.notes
              ? `${debt.notes} | Catatan Pelunasan: ${payNotes.trim()}`
              : `Catatan Pelunasan: ${payNotes.trim()}`
            : debt.notes,
        },
        include: {
          items: { include: { voucher: true } },
          cashier: { select: { id: true, name: true } },
        },
      });

      return { debt: updatedDebt, sale };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error("Pay Voucher Debt Error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal memproses pelunasan bon voucher" },
      { status: 400 }
    );
  }
}

// DELETE /api/vouchers/debts/[id] - Cancel unpaid debt and return stock
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session || (session.role !== "OWNER" && session.role !== "CASHIER")) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const debt = await tx.voucherDebt.findUnique({
        where: { id: params.id },
        include: {
          items: {
            include: { voucher: true },
          },
        },
      });

      if (!debt) {
        throw new Error("Data bon voucher tidak ditemukan");
      }

      if (debt.status === "PAID") {
        throw new Error("Bon yang sudah berstatus LUNAS tidak dapat dibatalkan langsung. Silakan hubungi Owner.");
      }

      if (debt.status === "CANCELLED") {
        throw new Error("Bon voucher ini sudah pernah dibatalkan.");
      }

      // Restore voucher stock for each item
      for (const item of debt.items) {
        const voucher = await tx.voucher.findUnique({
          where: { id: item.voucherId },
        });

        if (voucher) {
          const prev = voucher.stock;
          const next = prev + item.quantity;

          await tx.voucher.update({
            where: { id: voucher.id },
            data: { stock: next },
          });

          await tx.voucherMovement.create({
            data: {
              voucherId: voucher.id,
              type: "ADJUSTMENT",
              quantity: item.quantity,
              previousStock: prev,
              newStock: next,
              referenceId: debt.debtNumber,
              notes: `Pembatalan bon #${debt.debtNumber} (${debt.customerName}) - Stok fisik dikembalikan`,
            },
          });
        }
      }

      // Mark debt as CANCELLED
      const updatedDebt = await tx.voucherDebt.update({
        where: { id: params.id },
        data: {
          status: "CANCELLED",
        },
      });

      return updatedDebt;
    });

    return NextResponse.json({ success: true, debt: result });
  } catch (error: any) {
    console.error("Cancel Voucher Debt Error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal membatalkan bon voucher" },
      { status: 400 }
    );
  }
}

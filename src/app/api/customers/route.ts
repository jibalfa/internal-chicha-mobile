import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withDbRetry } from "@/lib/dbRetry";
import { z } from "zod";

const customerSchema = z.object({
  name: z.string().min(1, "Nama pelanggan wajib diisi"),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const customers = await withDbRetry(async () => {
      const where: any = {};
      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
        ];
      }

      return await (prisma as any).customer.findMany({
        where,
        include: {
          sales: {
            where: {
              paymentStatus: { in: ["UNPAID", "PARTIAL"] },
            },
            select: {
              id: true,
              invoiceNumber: true,
              finalAmount: true,
              cashGiven: true,
              paymentStatus: true,
              createdAt: true,
            },
          },
        },
        orderBy: { name: "asc" },
        take: limit,
      });
    }, { operationName: "GET Customers" });

    // Format output with computed debt amounts
    const formatted = customers.map((c: any) => {
      const unpaidSales = c.sales || [];
      const totalUnpaid = unpaidSales.reduce(
        (sum: number, s: any) => sum + Math.max(0, s.finalAmount - s.cashGiven),
        0
      );
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        address: c.address,
        notes: c.notes,
        createdAt: c.createdAt,
        unpaidInvoicesCount: unpaidSales.length,
        totalUnpaidDebt: totalUnpaid,
      };
    });

    return NextResponse.json({ customers: formatted });
  } catch (error: any) {
    console.error("GET Customers Error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal mengambil data pelanggan" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = customerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 });
    }

    const { name, phone, address, notes } = parsed.data;

    const customer = await withDbRetry(async () => {
      // Check if existing customer with same name/phone
      if (phone?.trim()) {
        const existing = await (prisma as any).customer.findFirst({
          where: { phone: phone.trim() },
        });
        if (existing) {
          // Update details if found
          return await (prisma as any).customer.update({
            where: { id: existing.id },
            data: {
              name: name.trim(),
              address: address?.trim() || existing.address,
              notes: notes?.trim() || existing.notes,
            },
          });
        }
      }

      return await (prisma as any).customer.create({
        data: {
          name: name.trim(),
          phone: phone?.trim() || null,
          address: address?.trim() || null,
          notes: notes?.trim() || null,
        },
      });
    }, { operationName: "POST Customer" });

    return NextResponse.json({ success: true, customer }, { status: 201 });
  } catch (error: any) {
    console.error("POST Customer Error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal menyimpan data pelanggan" },
      { status: 500 }
    );
  }
}

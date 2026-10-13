import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withDbRetry } from "@/lib/dbRetry";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only OWNER can view full financial reports (or CASHIER with permission if extended)
  if (session.role !== "OWNER") {
    return NextResponse.json({ error: "Akses ditolak. Khusus Owner." }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const statusParam = (searchParams.get("status") || "ALL").toUpperCase();
    const search = searchParams.get("search")?.trim() || "";
    const customerId = searchParams.get("customerId")?.trim() || "";

    const data = await withDbRetry(async () => {
      const now = new Date();

      // 1. Fetch all credit sales or sales with debt
      const where: any = {
        paymentMethod: "CREDIT",
      };

      if (statusParam === "UNPAID") {
        where.paymentStatus = { in: ["UNPAID", "PARTIAL"] };
      } else if (statusParam === "PAID") {
        where.paymentStatus = "PAID";
      }

      if (customerId) {
        where.customerId = customerId;
      }

      if (search) {
        where.OR = [
          { invoiceNumber: { contains: search, mode: "insensitive" } },
          { customerName: { contains: search, mode: "insensitive" } },
          { customerPhone: { contains: search, mode: "insensitive" } },
          { notes: { contains: search, mode: "insensitive" } },
        ];
      }

      const creditSales = await (prisma.sale.findMany as any)({
        where,
        include: {
          customer: true,
          cashier: { select: { id: true, name: true } },
          items: true,
        },
        orderBy: { createdAt: "desc" },
      });

      // 2. Fetch all customers and compute their debt balances
      const allCustomers = await (prisma as any).customer.findMany({
        include: {
          sales: {
            where: {
              paymentMethod: "CREDIT",
              paymentStatus: { in: ["UNPAID", "PARTIAL"] },
            },
            select: {
              id: true,
              finalAmount: true,
              cashGiven: true,
              createdAt: true,
            },
          },
        },
        orderBy: { name: "asc" },
      });

      const customerDebtsList = (allCustomers as any[])
        .map((c: any) => {
          const unpaidSales = c.sales || [];
          const totalDebt = unpaidSales.reduce(
            (sum: number, s: any) => sum + Math.max(0, s.finalAmount - s.cashGiven),
            0
          );
          const lastDate =
            unpaidSales.length > 0
              ? unpaidSales[unpaidSales.length - 1].createdAt
              : null;

          return {
            id: c.id,
            name: c.name,
            phone: c.phone,
            address: c.address,
            unpaidCount: unpaidSales.length,
            totalDebt,
            lastTransactionDate: lastDate,
          };
        })
        .filter((c: any) => c.totalDebt > 0 || c.unpaidCount > 0);

      // 3. Summary KPIs
      const allCreditSales = await prisma.sale.findMany({
        where: { paymentMethod: "CREDIT" },
        select: {
          finalAmount: true,
          cashGiven: true,
          paymentStatus: true,
          dueDate: true,
        },
      });

      let totalUnpaidDebt = 0;
      let totalPaidDebt = 0;
      let unpaidInvoicesCount = 0;
      let overdueCount = 0;

      for (const s of allCreditSales as any[]) {
        if (s.paymentStatus === "PAID") {
          totalPaidDebt += s.finalAmount;
        } else {
          const remaining = Math.max(0, s.finalAmount - s.cashGiven);
          totalUnpaidDebt += remaining;
          totalPaidDebt += s.cashGiven || 0;
          unpaidInvoicesCount++;

          if (s.dueDate && new Date(s.dueDate) < now) {
            overdueCount++;
          }
        }
      }

      const formattedInvoices = (creditSales as any[]).map((s: any) => ({
        id: s.id,
        invoiceNumber: s.invoiceNumber,
        createdAt: s.createdAt,
        customerId: s.customerId,
        customerName: s.customerName || s.customer?.name || "Pelanggan Umum",
        customerPhone: s.customerPhone || s.customer?.phone || null,
        totalAmount: s.totalAmount,
        finalAmount: s.finalAmount,
        cashGiven: s.cashGiven, // DP
        remainingDebt: Math.max(0, s.finalAmount - s.cashGiven),
        paymentStatus: s.paymentStatus,
        dueDate: s.dueDate,
        paidAt: s.paidAt,
        paidMethod: s.paidMethod,
        notes: s.notes,
        cashierName: s.cashier?.name || "Kasir",
        itemsCount: (s.items || []).length,
        items: s.items || [],
      }));

      return {
        summary: {
          totalUnpaidDebt,
          totalPaidDebt,
          unpaidInvoicesCount,
          overdueCount,
          indebtedCustomerCount: customerDebtsList.length,
        },
        customers: customerDebtsList,
        invoices: formattedInvoices,
      };
    }, { operationName: "GET Receivables Report" });

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("GET Receivables Report Error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal mengambil laporan piutang" },
      { status: 500 }
    );
  }
}

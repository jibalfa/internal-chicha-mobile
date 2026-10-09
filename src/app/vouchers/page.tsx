import React from "react";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import VoucherClient from "./VoucherClient";
import { prisma } from "@/lib/prisma";

export default async function VouchersPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const [vouchers, movements, todaySales, debts] = await Promise.all([
    prisma.voucher.findMany({
      where: { isActive: true },
      orderBy: [{ operator: "asc" }, { costPrice: "asc" }],
    }),
    prisma.voucherMovement.findMany({
      include: {
        voucher: {
          select: {
            id: true,
            operator: true,
            nominal: true,
            costPrice: true,
            sellingPrice: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
    prisma.saleItem.findMany({
      where: {
        itemType: "VOUCHER",
        sale: {
          createdAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      },
      include: {
        voucher: true,
      },
      orderBy: { id: "desc" },
    }),
    prisma.voucherDebt.findMany({
      include: {
        cashier: { select: { id: true, name: true, username: true } },
        items: {
          include: { voucher: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  const isOwner = session.role === "OWNER";
  const sanitizedVouchers = isOwner
    ? vouchers
    : vouchers.map((v) => ({ ...v, costPrice: 0 }));

  const sanitizedMovements = isOwner
    ? movements
    : movements.map((m) => ({
        ...m,
        voucher: m.voucher ? { ...m.voucher, costPrice: 0 } : m.voucher,
      }));

  const sanitizedTodaySales = isOwner
    ? todaySales
    : todaySales.map((s) => ({
        ...s,
        costPrice: 0,
        profit: 0,
        voucher: s.voucher ? { ...s.voucher, costPrice: 0 } : s.voucher,
      }));

  const sanitizedDebts = isOwner
    ? debts
    : debts.map((d) => ({
        ...d,
        items: d.items.map((i) => ({
          ...i,
          costPrice: 0,
          profit: 0,
          voucher: i.voucher ? { ...i.voucher, costPrice: 0 } : i.voucher,
        })),
      }));

  return (
    <AppShell user={session}>
      <VoucherClient
        initialVouchers={JSON.parse(JSON.stringify(sanitizedVouchers))}
        initialMovements={JSON.parse(JSON.stringify(sanitizedMovements))}
        initialTodaySales={JSON.parse(JSON.stringify(sanitizedTodaySales))}
        initialDebts={JSON.parse(JSON.stringify(sanitizedDebts))}
        userRole={session.role}
      />
    </AppShell>
  );
}

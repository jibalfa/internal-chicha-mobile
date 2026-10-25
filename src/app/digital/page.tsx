import React from "react";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import DigitalClient from "./DigitalClient";
import { prisma } from "@/lib/prisma";

const DEFAULT_TYPES = ["TOP-UP", "PULSA", "TAGIHAN"];

export default async function DigitalPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const [rawProducts, transactions] = await Promise.all([
    prisma.digitalProduct.findMany({
      where: { isActive: true },
      select: { category: true },
      distinct: ["category"],
    }),
    prisma.digitalTransaction.findMany({
      include: {
        digitalProduct: true,
        cashier: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 150,
    }),
  ]);

  const dbCategories = rawProducts.map((p) => p.category.trim().toUpperCase());
  const initialTypes = Array.from(new Set([...DEFAULT_TYPES, ...dbCategories]));

  // Pada transaksi digital (PPOB), costPrice adalah nilai nominal transaksi yang diproses kasir
  // Baik akun OWNER maupun CASHIER/Admin Kasir dapat melihat total nominal transaksi
  const sanitizedTransactions = transactions;

  return (
    <AppShell user={session}>
      <DigitalClient
        initialTypes={initialTypes}
        initialTransactions={JSON.parse(JSON.stringify(sanitizedTransactions))}
        cashierName={session.name}
        userRole={session.role}
      />
    </AppShell>
  );
}


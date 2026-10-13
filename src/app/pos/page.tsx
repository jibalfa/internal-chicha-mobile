import React from "react";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import PosClient from "./PosClient";
import { prisma } from "@/lib/prisma";
import { getStoreSettings } from "@/lib/storeSettings";

export default async function PosPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const [products, vouchers, storeSetting, customers] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      include: { category: true },
      orderBy: { name: "asc" },
    }),
    prisma.voucher.findMany({
      where: { isActive: true },
      orderBy: [{ operator: "asc" }, { costPrice: "asc" }],
    }),
    getStoreSettings().catch(() => null),
    (prisma as any).customer.findMany({
      orderBy: { name: "asc" },
      take: 100,
    }),
  ]);

  return (
    <AppShell user={session}>
      <PosClient
        initialProducts={JSON.parse(JSON.stringify(products))}
        initialVouchers={JSON.parse(JSON.stringify(vouchers))}
        initialCustomers={JSON.parse(JSON.stringify(customers))}
        cashierName={session.name}
        userRole={session.role}
        initialStoreSetting={storeSetting ? JSON.parse(JSON.stringify(storeSetting)) : null}
      />
    </AppShell>
  );
}

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

  const [products, vouchers, storeSetting] = await Promise.all([
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
  ]);

  return (
    <AppShell user={session}>
      <PosClient
        initialProducts={JSON.parse(JSON.stringify(products))}
        initialVouchers={JSON.parse(JSON.stringify(vouchers))}
        cashierName={session.name}
        initialStoreSetting={storeSetting ? JSON.parse(JSON.stringify(storeSetting)) : null}
      />
    </AppShell>
  );
}

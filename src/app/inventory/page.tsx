import React from "react";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import InventoryClient from "./InventoryClient";
import { prisma } from "@/lib/prisma";

export default async function InventoryPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const [products, suppliers, movements] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      include: { category: true, supplier: true },
      orderBy: { name: "asc" },
    }),
    prisma.supplier.findMany({ orderBy: { name: "asc" } }),
    prisma.inventoryMovement.findMany({
      include: {
        product: { select: { id: true, sku: true, name: true, brand: true, type: true } },
        createdBy: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const isOwner = session.role === "OWNER";
  const sanitizedProducts = isOwner
    ? products
    : products.map((p) => ({ ...p, costPrice: 0 }));

  return (
    <AppShell user={session}>
      <InventoryClient
        initialProducts={JSON.parse(JSON.stringify(sanitizedProducts))}
        suppliers={JSON.parse(JSON.stringify(suppliers))}
        initialMovements={JSON.parse(JSON.stringify(movements))}
        userRole={session.role}
      />
    </AppShell>
  );
}

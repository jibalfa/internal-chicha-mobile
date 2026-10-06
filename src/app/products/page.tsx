import React from "react";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import ProductListClient from "./ProductListClient";
import { prisma } from "@/lib/prisma";

export default async function ProductsPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const [products, categories, suppliers] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      include: { category: true, supplier: true },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.supplier.findMany({ orderBy: { name: "asc" } }),
  ]);

  const isOwner = session.role === "OWNER";
  const sanitizedProducts = isOwner
    ? products
    : products.map((p) => ({ ...p, costPrice: 0 }));

  return (
    <AppShell user={session}>
      <ProductListClient
        initialProducts={JSON.parse(JSON.stringify(sanitizedProducts))}
        categories={JSON.parse(JSON.stringify(categories))}
        suppliers={JSON.parse(JSON.stringify(suppliers))}
        userRole={session.role}
      />
    </AppShell>
  );
}

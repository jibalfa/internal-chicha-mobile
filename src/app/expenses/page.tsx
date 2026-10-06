import React from "react";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import ExpensesClient from "./ExpensesClient";
import { prisma } from "@/lib/prisma";

export default async function ExpensesPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (session.role !== "OWNER") {
    redirect("/dashboard");
  }

  const expenses = await prisma.expense.findMany({
    include: {
      createdBy: {
        select: { id: true, name: true, role: true },
      },
    },
    orderBy: { date: "desc" },
    take: 150,
  });

  return (
    <AppShell user={session}>
      <ExpensesClient
        initialExpenses={JSON.parse(JSON.stringify(expenses))}
        userRole={session.role}
      />
    </AppShell>
  );
}

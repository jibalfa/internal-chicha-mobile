import React from "react";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import UserManagementClient from "./UserManagementClient";
import { prisma } from "@/lib/prisma";

export default async function UsersPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (session.role !== "OWNER") {
    redirect("/dashboard");
  }

  const initialUsers = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      username: true,
      role: true,
      phone: true,
      isActive: true,
      createdAt: true,
      _count: {
        select: {
          sales: true,
          digitalTransactions: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <AppShell user={session}>
      <UserManagementClient initialUsers={JSON.parse(JSON.stringify(initialUsers))} />
    </AppShell>
  );
}

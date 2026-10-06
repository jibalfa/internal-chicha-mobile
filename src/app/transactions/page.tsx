import React from "react";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import TransactionsClient from "./TransactionsClient";
import { getStoreSettings } from "@/lib/storeSettings";

export default async function TransactionsPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const storeSetting = await getStoreSettings();

  return (
    <AppShell user={session}>
      <TransactionsClient
        user={session}
        storeSetting={JSON.parse(JSON.stringify(storeSetting))}
      />
    </AppShell>
  );
}

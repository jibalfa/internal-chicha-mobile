import React from "react";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { SettingsClient } from "@/app/settings/SettingsClient";
import { getStoreSettings } from "@/lib/storeSettings";

export default async function SettingsPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (session.role !== "OWNER") {
    redirect("/dashboard");
  }

  const setting = await getStoreSettings();

  return (
    <AppShell user={session}>
      <SettingsClient initialSetting={JSON.parse(JSON.stringify(setting))} />
    </AppShell>
  );
}

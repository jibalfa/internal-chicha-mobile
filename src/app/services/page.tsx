import React from "react";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import ServicesClient from "@/app/services/ServicesClient";
import { prisma } from "@/lib/prisma";

export default async function ServicesPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const [services, technicians, storeSetting] = await Promise.all([
    (prisma as any).serviceRecord.findMany({
      take: 150,
      orderBy: { createdAt: "desc" },
      include: {
        technician: true,
        cashier: { select: { id: true, name: true } },
      },
    }),
    (prisma as any).technician.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.storeSetting.findUnique({
      where: { id: "default_store_setting" },
    }),
  ]);

  const isOwner = session.role === "OWNER";

  const sanitizedServices = isOwner
    ? services
    : services.map((s: any) => ({
        ...s,
        technicianPercentage: 0,
        technicianFee: 0,
        storeProfit: 0,
        technician: s.technician
          ? { id: s.technician.id, name: s.technician.name }
          : null,
      }));

  const sanitizedTechs = isOwner
    ? technicians
    : technicians.map((t: any) => ({
        id: t.id,
        name: t.name,
        defaultPercentage: 0,
      }));

  return (
    <AppShell user={session}>
      <ServicesClient
        initialServices={JSON.parse(JSON.stringify(sanitizedServices))}
        technicians={JSON.parse(JSON.stringify(sanitizedTechs))}
        storeSetting={storeSetting ? JSON.parse(JSON.stringify(storeSetting)) : null}
        userRole={session.role}
        userName={session.name}
      />
    </AppShell>
  );
}

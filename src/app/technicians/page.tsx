import React from "react";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import TechniciansClient from "@/app/technicians/TechniciansClient";
import { prisma } from "@/lib/prisma";

export default async function TechniciansPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (session.role !== "OWNER") {
    redirect("/services");
  }

  const technicians = await (prisma as any).technician.findMany({
    orderBy: { name: "asc" },
    include: {
      services: {
        select: {
          id: true,
          serviceFee: true,
          sparepartCost: true,
          technicianFee: true,
          storeProfit: true,
          status: true,
          paymentStatus: true,
          createdAt: true,
        },
      },
    },
  });

  const serializedTechs = technicians.map((tech: any) => {
    const activeServices = tech.services.filter(
      (s: any) => s.status !== "CANCELLED"
    );
    const paidServices = tech.services.filter(
      (s: any) => s.status === "COMPLETED" && s.paymentStatus === "PAID"
    );

    const totalRevenue = paidServices.reduce(
      (sum: number, s: any) => sum + (s.serviceFee || 0),
      0
    );
    const totalCommission = paidServices.reduce(
      (sum: number, s: any) => sum + (s.technicianFee || 0),
      0
    );
    const totalStoreProfit = paidServices.reduce(
      (sum: number, s: any) => sum + (s.storeProfit || 0),
      0
    );

    return {
      id: tech.id,
      name: tech.name,
      phone: tech.phone || "",
      address: tech.address || "",
      defaultPercentage: tech.defaultPercentage,
      isActive: tech.isActive,
      createdAt: tech.createdAt.toISOString(),
      totalServicesCount: activeServices.length,
      completedCount: activeServices.filter((s: any) => s.status === "COMPLETED").length,
      pendingCount: activeServices.filter((s: any) => s.status !== "COMPLETED").length,
      totalRevenue,
      totalCommission,
      totalStoreProfit,
    };
  });

  return (
    <AppShell user={session}>
      <TechniciansClient
        initialTechnicians={serializedTechs}
        userRole={session.role}
        userName={session.name}
      />
    </AppShell>
  );
}

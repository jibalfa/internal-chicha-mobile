import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Non-owner (Cashier) only receives active technician id & name for selection dropdown
  if (session.role !== "OWNER") {
    try {
      const activeTechs = await (prisma as any).technician.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
        },
      });
      return NextResponse.json(activeTechs);
    } catch (error: any) {
      return NextResponse.json(
        { error: error.message || "Gagal memuat teknisi" },
        { status: 500 }
      );
    }
  }

  try {
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

    const data = technicians.map((tech: any) => {
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
        createdAt: tech.createdAt,
        totalServicesCount: activeServices.length,
        completedCount: activeServices.filter((s: any) => s.status === "COMPLETED").length,
        pendingCount: activeServices.filter((s: any) => s.status !== "COMPLETED").length,
        totalRevenue,
        totalCommission,
        totalStoreProfit,
      };
    });

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("GET Technicians Error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal memuat data teknisi" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "OWNER") {
    return NextResponse.json({ error: "Akses ditolak. Khusus Owner." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, phone, address, defaultPercentage } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Nama teknisi wajib diisi" },
        { status: 400 }
      );
    }

    const pct = parseFloat(defaultPercentage);
    const validPct = isNaN(pct) ? 50 : Math.min(100, Math.max(0, pct));

    const newTechnician = await (prisma as any).technician.create({
      data: {
        name: name.trim(),
        phone: phone ? phone.trim() : null,
        address: address ? address.trim() : null,
        defaultPercentage: validPct,
        isActive: true,
      },
    });

    return NextResponse.json(newTechnician, { status: 201 });
  } catch (error: any) {
    console.error("POST Technician Error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal menambahkan data teknisi" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const technicianId = searchParams.get("technicianId") || "";
    const status = searchParams.get("status") || "";
    const paymentStatus = searchParams.get("paymentStatus") || "";
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    const where: any = {};

    if (search.trim()) {
      where.OR = [
        { serviceNumber: { contains: search.trim(), mode: "insensitive" } },
        { deviceType: { contains: search.trim(), mode: "insensitive" } },
        { issue: { contains: search.trim(), mode: "insensitive" } },
        { customerName: { contains: search.trim(), mode: "insensitive" } },
        { customerPhone: { contains: search.trim(), mode: "insensitive" } },
      ];
    }

    if (technicianId) {
      where.technicianId = technicianId;
    }

    if (status && status !== "ALL") {
      where.status = status;
    }

    if (paymentStatus && paymentStatus !== "ALL") {
      where.paymentStatus = paymentStatus;
    }

    if (startDateParam || endDateParam) {
      where.createdAt = {};
      if (startDateParam) {
        const sStr = startDateParam.includes("T") ? startDateParam.split("T")[0] : startDateParam;
        where.createdAt.gte = new Date(`${sStr}T00:00:00.000+07:00`);
      }
      if (endDateParam) {
        const eStr = endDateParam.includes("T") ? endDateParam.split("T")[0] : endDateParam;
        where.createdAt.lte = new Date(`${eStr}T23:59:59.999+07:00`);
      }
    }

    const services = await (prisma as any).serviceRecord.findMany({
      where,
      include: {
        technician: {
          select: { id: true, name: true, phone: true, defaultPercentage: true },
        },
        cashier: {
          select: { id: true, name: true, username: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

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

    return NextResponse.json(sanitizedServices);
  } catch (error: any) {
    console.error("GET Services Error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal memuat data servis" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      deviceType,
      issue,
      serviceFee,
      sparepartCost = 0,
      technicianId,
      technicianPercentage,
      customerName,
      customerPhone,
      status = "COMPLETED",
      paymentStatus = "PAID",
      paymentMethod = "CASH",
      notes,
    } = body;

    if (!deviceType || !deviceType.trim()) {
      return NextResponse.json(
        { error: "Tipe HP wajib diisi" },
        { status: 400 }
      );
    }

    if (!issue || !issue.trim()) {
      return NextResponse.json(
        { error: "Kendala / Kerusakan wajib diisi" },
        { status: 400 }
      );
    }

    if (!technicianId) {
      return NextResponse.json(
        { error: "Pemilihan Teknisi wajib dipilih" },
        { status: 400 }
      );
    }

    const fee = parseFloat(serviceFee);
    if (isNaN(fee) || fee <= 0) {
      return NextResponse.json(
        { error: "Biaya jasa servis harus berupa angka positif" },
        { status: 400 }
      );
    }

    const partCost = Math.max(0, parseFloat(sparepartCost) || 0);

    // Get technician default percentage if not specified
    const technician = await (prisma as any).technician.findUnique({
      where: { id: technicianId },
    });

    if (!technician) {
      return NextResponse.json(
        { error: "Teknisi yang dipilih tidak ditemukan" },
        { status: 404 }
      );
    }

    const isOwner = session.role === "OWNER";
    const pct =
      isOwner && technicianPercentage !== undefined && technicianPercentage !== null
        ? Math.min(100, Math.max(0, parseFloat(technicianPercentage)))
        : (technician.defaultPercentage ?? 50);

    // Calculation:
    // netServicePool = serviceFee - sparepartCost
    // technicianFee = netServicePool * (technicianPercentage / 100)
    // storeProfit = serviceFee - sparepartCost - technicianFee
    const netPool = Math.max(0, fee - partCost);
    const techFee = Math.round(netPool * (pct / 100));
    const storeProfit = fee - partCost - techFee;

    // Generate unique service number: SRV-YYYYMMDD-XXXX
    const now = new Date();
    const datePrefix = `SRV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;

    const countToday = await (prisma as any).serviceRecord.count({
      where: {
        serviceNumber: { startsWith: datePrefix },
      },
    });

    const serviceNumber = `${datePrefix}-${String(countToday + 1).padStart(4, "0")}`;

    const newService = await (prisma as any).serviceRecord.create({
      data: {
        serviceNumber,
        deviceType: deviceType.trim(),
        issue: issue.trim(),
        serviceFee: fee,
        sparepartCost: partCost,
        technicianPercentage: pct,
        technicianFee: techFee,
        storeProfit,
        technicianId,
        customerName: customerName ? customerName.trim() : null,
        customerPhone: customerPhone ? customerPhone.trim() : null,
        status: status || "COMPLETED",
        paymentStatus: paymentStatus || "PAID",
        paymentMethod: paymentMethod || "CASH",
        notes: notes ? notes.trim() : null,
        cashierId: session.userId,
        completedAt: status === "COMPLETED" ? new Date() : null,
      },
      include: {
        technician: true,
        cashier: { select: { id: true, name: true } },
      },
    });

    const responseData = isOwner
      ? newService
      : {
          ...newService,
          technicianPercentage: 0,
          technicianFee: 0,
          storeProfit: 0,
          technician: newService.technician
            ? { id: newService.technician.id, name: newService.technician.name }
            : null,
        };

    return NextResponse.json(responseData, { status: 201 });
  } catch (error: any) {
    console.error("POST Service Error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal mencatat servis HP" },
      { status: 500 }
    );
  }
}

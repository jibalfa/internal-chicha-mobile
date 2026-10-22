import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const service = await (prisma as any).serviceRecord.findUnique({
      where: { id: params.id },
      include: {
        technician: true,
        cashier: { select: { id: true, name: true, username: true } },
      },
    });

    if (!service) {
      return NextResponse.json(
        { error: "Data servis tidak ditemukan" },
        { status: 404 }
      );
    }

    const isOwner = session.role === "OWNER";
    const responseData = isOwner
      ? service
      : {
          ...service,
          technicianPercentage: 0,
          technicianFee: 0,
          storeProfit: 0,
          technician: service.technician
            ? { id: service.technician.id, name: service.technician.name }
            : null,
        };

    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error("GET Service Detail Error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal memuat detail servis" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const existing = await (prisma as any).serviceRecord.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Data servis tidak ditemukan" },
        { status: 404 }
      );
    }

    const {
      deviceType,
      issue,
      serviceFee,
      sparepartCost,
      technicianId,
      technicianPercentage,
      customerName,
      customerPhone,
      status,
      paymentStatus,
      paymentMethod,
      notes,
    } = body;

    const isOwner = session.role === "OWNER";
    const fee =
      serviceFee !== undefined ? parseFloat(serviceFee) : existing.serviceFee;
    const partCost =
      sparepartCost !== undefined
        ? parseFloat(sparepartCost)
        : existing.sparepartCost;

    let pct = existing.technicianPercentage;
    if (isOwner && technicianPercentage !== undefined && technicianPercentage !== null) {
      pct = Math.min(100, Math.max(0, parseFloat(technicianPercentage)));
    } else if (technicianId && technicianId !== existing.technicianId) {
      const newTech = await (prisma as any).technician.findUnique({
        where: { id: technicianId },
      });
      if (newTech) {
        pct = newTech.defaultPercentage ?? 50;
      }
    }

    const netPool = Math.max(0, fee - partCost);
    const techFee = Math.round(netPool * (pct / 100));
    const storeProfit = fee - partCost - techFee;

    const updateData: any = {
      deviceType: deviceType !== undefined ? deviceType.trim() : existing.deviceType,
      issue: issue !== undefined ? issue.trim() : existing.issue,
      serviceFee: fee,
      sparepartCost: partCost,
      technicianPercentage: pct,
      technicianFee: techFee,
      storeProfit,
      technicianId: technicianId || existing.technicianId,
      customerName: customerName !== undefined ? (customerName ? customerName.trim() : null) : existing.customerName,
      customerPhone: customerPhone !== undefined ? (customerPhone ? customerPhone.trim() : null) : existing.customerPhone,
      status: status || existing.status,
      paymentStatus: paymentStatus || existing.paymentStatus,
      paymentMethod: paymentMethod || existing.paymentMethod,
      notes: notes !== undefined ? (notes ? notes.trim() : null) : existing.notes,
    };

    if (status === "COMPLETED" && existing.status !== "COMPLETED") {
      updateData.completedAt = new Date();
    }

    const updated = await (prisma as any).serviceRecord.update({
      where: { id: params.id },
      data: updateData,
      include: {
        technician: true,
        cashier: { select: { id: true, name: true } },
      },
    });

    const responseData = isOwner
      ? updated
      : {
          ...updated,
          technicianPercentage: 0,
          technicianFee: 0,
          storeProfit: 0,
          technician: updated.technician
            ? { id: updated.technician.id, name: updated.technician.name }
            : null,
        };

    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error("PUT Service Error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal memperbarui data servis" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.role !== "OWNER") {
    return NextResponse.json(
      { error: "Akses ditolak. Khusus Owner." },
      { status: 403 }
    );
  }

  try {
    await (prisma as any).serviceRecord.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ message: "Data servis berhasil dihapus" });
  } catch (error: any) {
    console.error("DELETE Service Error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal menghapus data servis" },
      { status: 500 }
    );
  }
}

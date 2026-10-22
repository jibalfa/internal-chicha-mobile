import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session || session.role !== "OWNER") {
    return NextResponse.json({ error: "Akses ditolak. Khusus Owner." }, { status: 403 });
  }

  try {
    const technician = await (prisma as any).technician.findUnique({
      where: { id: params.id },
      include: {
        services: {
          orderBy: { createdAt: "desc" },
          include: {
            cashier: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!technician) {
      return NextResponse.json(
        { error: "Teknisi tidak ditemukan" },
        { status: 404 }
      );
    }

    return NextResponse.json(technician);
  } catch (error: any) {
    console.error("GET Technician Detail Error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal memuat detail teknisi" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session || session.role !== "OWNER") {
    return NextResponse.json({ error: "Akses ditolak. Khusus Owner." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, phone, address, defaultPercentage, isActive } = body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (phone !== undefined) updateData.phone = phone ? phone.trim() : null;
    if (address !== undefined) updateData.address = address ? address.trim() : null;
    if (defaultPercentage !== undefined) {
      const pct = parseFloat(defaultPercentage);
      updateData.defaultPercentage = isNaN(pct) ? 50 : Math.min(100, Math.max(0, pct));
    }
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);

    const updated = await (prisma as any).technician.update({
      where: { id: params.id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("PUT Technician Error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal memperbarui data teknisi" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session || session.role !== "OWNER") {
    return NextResponse.json({ error: "Akses ditolak. Khusus Owner." }, { status: 403 });
  }

  try {
    const serviceCount = await (prisma as any).serviceRecord.count({
      where: { technicianId: params.id },
    });

    if (serviceCount > 0) {
      // If has history, soft delete / toggle inactive instead of hard delete
      await (prisma as any).technician.update({
        where: { id: params.id },
        data: { isActive: false },
      });
      return NextResponse.json({
        message: "Teknisi dinonaktifkan karena memiliki riwayat servis terkait",
      });
    }

    await (prisma as any).technician.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ message: "Teknisi berhasil dihapus" });
  } catch (error: any) {
    console.error("DELETE Technician Error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal menghapus data teknisi" },
      { status: 500 }
    );
  }
}

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
    const productId = searchParams.get("productId");
    const type = searchParams.get("type");
    const limit = parseInt(searchParams.get("limit") || "100", 10);

    const where: any = {};
    if (productId && productId !== "ALL") where.productId = productId;
    if (type && type !== "ALL") where.type = type;

    const movements = await prisma.inventoryMovement.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            sku: true,
            name: true,
            brand: true,
            type: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ movements });
  } catch (error) {
    console.error("GET Inventory Movements Error:", error);
    return NextResponse.json({ error: "Gagal mengambil riwayat mutasi" }, { status: 500 });
  }
}

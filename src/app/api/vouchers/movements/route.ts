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
    const voucherId = searchParams.get("voucherId");
    const operator = searchParams.get("operator");
    const limit = parseInt(searchParams.get("limit") || "100", 10);

    const where: any = {};
    if (voucherId && voucherId !== "ALL") where.voucherId = voucherId;
    if (operator && operator !== "ALL") {
      where.voucher = { operator };
    }

    const movements = await prisma.voucherMovement.findMany({
      where,
      include: {
        voucher: {
          select: {
            id: true,
            operator: true,
            nominal: true,
            costPrice: true,
            sellingPrice: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ movements });
  } catch (error) {
    console.error("GET Voucher Movements Error:", error);
    return NextResponse.json({ error: "Gagal mengambil log mutasi voucher" }, { status: 500 });
  }
}

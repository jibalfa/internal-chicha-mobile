import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { z } from "zod";
import { getStoreSettings, updateStoreSettings } from "@/lib/storeSettings";

const storeSettingSchema = z.object({
  name: z.string().min(2, "Nama toko minimal 2 karakter"),
  tagline: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  receiptFooter: z.string().optional().nullable(),
  printCopies: z.coerce.number().int().min(1).max(5).default(1),
  paperWidth: z.enum(["58mm", "80mm"]).default("58mm"),
  autoPrint: z.boolean().default(false),
});

export async function GET() {
  try {
    const setting = await getStoreSettings();
    return NextResponse.json({ setting });
  } catch (error: any) {
    console.error("GET Store Settings Error:", error);
    return NextResponse.json({ error: "Gagal memuat pengaturan toko" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "OWNER") {
    return NextResponse.json({ error: "Akses ditolak. Khusus Owner." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = storeSettingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 });
    }

    const updated = await updateStoreSettings(parsed.data);
    return NextResponse.json({ success: true, setting: updated });
  } catch (error: any) {
    console.error("PUT Store Settings Error:", error);
    return NextResponse.json({ error: error.message || "Gagal menyimpan pengaturan toko" }, { status: 500 });
  }
}


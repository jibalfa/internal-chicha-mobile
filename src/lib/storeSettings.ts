import { prisma } from "@/lib/prisma";

export interface StoreSettingData {
  id: string;
  name: string;
  tagline?: string | null;
  address?: string | null;
  phone?: string | null;
  receiptFooter?: string | null;
  printCopies: number;
  paperWidth: "58mm" | "80mm" | string;
  autoPrint: boolean;
  updatedAt?: Date | string;
}

export const DEFAULT_STORE_SETTINGS: StoreSettingData = {
  id: "default_store_setting",
  name: "CHICHA MOBILE",
  tagline: "Pusat Aksesoris & Pulsa",
  address: "Jl. Toko ChiCha Mobile",
  phone: "0812-3456-7890",
  receiptFooter: "Barang yang dibeli tidak dapat ditukar/dikembalikan. Terima kasih!",
  printCopies: 1,
  paperWidth: "58mm",
  autoPrint: false,
};

/**
 * Fetch current store settings
 */
export async function getStoreSettings(): Promise<StoreSettingData> {
  try {
    const setting = await (prisma as any).storeSetting.findUnique({
      where: { id: "default_store_setting" },
    });

    if (setting) {
      return {
        id: setting.id,
        name: setting.name,
        tagline: setting.tagline,
        address: setting.address,
        phone: setting.phone,
        receiptFooter: setting.receiptFooter,
        printCopies: Number(setting.printCopies) || 1,
        paperWidth: setting.paperWidth || "58mm",
        autoPrint: Boolean(setting.autoPrint),
        updatedAt: setting.updatedAt,
      };
    }

    // Create default if not found
    const created = await (prisma as any).storeSetting.create({
      data: DEFAULT_STORE_SETTINGS,
    });

    return {
      id: created.id,
      name: created.name,
      tagline: created.tagline,
      address: created.address,
      phone: created.phone,
      receiptFooter: created.receiptFooter,
      printCopies: Number(created.printCopies) || 1,
      paperWidth: created.paperWidth || "58mm",
      autoPrint: Boolean(created.autoPrint),
      updatedAt: created.updatedAt,
    };
  } catch (error) {
    console.error("Error in getStoreSettings:", error);
    return DEFAULT_STORE_SETTINGS;
  }
}

/**
 * Update store settings
 */
export async function updateStoreSettings(data: {
  name: string;
  tagline?: string | null;
  address?: string | null;
  phone?: string | null;
  receiptFooter?: string | null;
  printCopies: number;
  paperWidth: "58mm" | "80mm" | string;
  autoPrint: boolean;
}): Promise<StoreSettingData> {
  const cleanName = data.name.trim();
  const cleanTagline = data.tagline?.trim() || null;
  const cleanAddress = data.address?.trim() || null;
  const cleanPhone = data.phone?.trim() || null;
  const cleanFooter = data.receiptFooter?.trim() || null;
  const copies = Number(data.printCopies) || 1;
  const width = data.paperWidth === "80mm" ? "80mm" : "58mm";

  try {
    const updated = await (prisma as any).storeSetting.upsert({
      where: { id: "default_store_setting" },
      update: {
        name: cleanName,
        tagline: cleanTagline,
        address: cleanAddress,
        phone: cleanPhone,
        receiptFooter: cleanFooter,
        printCopies: copies,
        paperWidth: width,
        autoPrint: Boolean(data.autoPrint),
      },
      create: {
        id: "default_store_setting",
        name: cleanName,
        tagline: cleanTagline,
        address: cleanAddress,
        phone: cleanPhone,
        receiptFooter: cleanFooter,
        printCopies: copies,
        paperWidth: width,
        autoPrint: Boolean(data.autoPrint),
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      tagline: updated.tagline,
      address: updated.address,
      phone: updated.phone,
      receiptFooter: updated.receiptFooter,
      printCopies: Number(updated.printCopies) || 1,
      paperWidth: updated.paperWidth || "58mm",
      autoPrint: Boolean(updated.autoPrint),
      updatedAt: updated.updatedAt,
    };
  } catch (error) {
    console.error("Error in updateStoreSettings:", error);
    throw new Error("Gagal menyimpan pengaturan toko ke database");
  }
}

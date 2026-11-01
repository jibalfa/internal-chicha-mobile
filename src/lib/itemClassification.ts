/**
 * Utilitas Klasifikasi Produk & Transaksi ChiCha Mobile
 * Sesuai Standar Laporan Harian & Setoran Kas Toko:
 * 1. Penjualan Pulsa: Transaksi Digital (PPOB / Pulsa)
 * 2. Penjualan Voucher / Aqua / Tisu: Voucher Fisik + Air Mineral (Aqua, Aquaviva) + Tisu
 * 3. Penjualan Aksesoris (Acc): Aksesoris umum + Temp (Tempered Glass) + HP (Unit) + Batt (Baterai)
 * 4. Service HP: Jasa servis handphone
 */

export type ChiChaCategoryGroup = "PULSA" | "VOUCHER_AQUA_TISU" | "AKSESORIS" | "SERVICE";

export interface ItemClassificationInput {
  itemType?: string | null; // "PRODUCT" | "VOUCHER"
  itemName?: string | null;
  productType?: string | null; // "ACCESSORY" | "GENERAL"
  categoryName?: string | null;
}

/**
 * Mengklasifikasikan item penjualan apakah masuk ke Voucher/Aqua/Tisu atau Aksesoris (termasuk Temp, HP, Batt)
 */
export function classifySaleItem(input: ItemClassificationInput): "VOUCHER_AQUA_TISU" | "AKSESORIS" {
  // 1. Voucher Fisik selalu masuk kelompok Voucher / Aqua / Tisu
  if (input.itemType === "VOUCHER") {
    return "VOUCHER_AQUA_TISU";
  }

  const name = (input.itemName || "").toLowerCase();
  const cat = (input.categoryName || "").toLowerCase();

  // 2. Air Mineral (Aqua / Aquaviva / Mineral) dan Tisu (Tissue)
  const isAquaOrTisu =
    name.includes("aqua") ||
    name.includes("aquaviva") ||
    name.includes("mineral") ||
    name.includes("tisu") ||
    name.includes("tissue") ||
    name.includes("air minum") ||
    cat.includes("minuman") ||
    cat.includes("tisu") ||
    cat.includes("tissue") ||
    cat.includes("konsumsi");

  if (isAquaOrTisu) {
    return "VOUCHER_AQUA_TISU";
  }

  // 3. Aksesoris (Acc): Termasuk Temp (Tempered Glass), HP (Unit Handphone), Batt (Baterai), Charger, Case, dll.
  return "AKSESORIS";
}


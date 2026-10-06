/**
 * Calculates profit for physical product sales
 */
export function calculateProductProfit(
  sellingPrice: number,
  costPrice: number,
  quantity: number
): number {
  return (sellingPrice - costPrice) * quantity;
}

/**
 * Calculates profit for digital transactions
 * Realized only when status is SUCCESS
 */
export function calculateDigitalProfit(
  sellingPrice: number,
  costPrice: number,
  status: string
): number {
  if (status === "SUCCESS") {
    return sellingPrice - costPrice;
  }
  return 0;
}

/**
 * Format currency to IDR Rupiah
 */
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

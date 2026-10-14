/**
 * Utility function to intelligently sort vouchers:
 * 1. Operator (A-Z)
 * 2. Quota size (MB/GB parsed into MB, ascending. Unlimited placed at end)
 * 3. Validity duration (3HR -> 5HR -> 14HR -> 30HR)
 * 4. Selling price (cheapest first)
 * 5. Alphanumeric nominal fallback
 */

export interface VoucherLike {
  id?: string;
  operator: string;
  nominal: string;
  sellingPrice: number;
  costPrice?: number;
  stock?: number;
  minStock?: number;
  isActive?: boolean;
  [key: string]: any;
}

export interface ParsedNominal {
  isUnlimited: boolean;
  quotaMb: number;
  days: number;
  rawNumber: number;
}

export function parseVoucherNominal(nominal: string): ParsedNominal {
  const clean = (nominal || "").trim();
  const lower = clean.toLowerCase();

  // 1. Check if Unlimited
  const isUnlimited = lower.includes("unli") || lower.includes("unlimited");

  // 2. Extract validity days: e.g. /14HR, /30HR, 14HARI, 7D, UNLI 7, 7HR
  let days = 0;
  const daysMatch = lower.match(/(?:\/|\b)(\d+)\s*(?:hr|hari|d|day|days)\b/);
  if (daysMatch) {
    days = parseInt(daysMatch[1], 10) || 0;
  } else if (isUnlimited) {
    // Check "UNLI 7" -> 7
    const unliDaysMatch = lower.match(/unli(?:mited)?\s*(\d+)/);
    if (unliDaysMatch) {
      days = parseInt(unliDaysMatch[1], 10) || 0;
    }
  }

  // 3. Extract Quota: e.g. 5GB, 7,5GB, 1.5GB, 500MB, 24GB
  let quotaMb = 0;
  if (isUnlimited) {
    quotaMb = 999999999; // Put unlimited after regular quotas
  } else {
    // Look for GB or MB
    // Handle comma as decimal (e.g. 7,5GB -> 7.5)
    const quotaMatch = clean.match(/(\d+(?:[.,]\d+)?)\s*(GB|MB|TB)\b/i);
    if (quotaMatch) {
      const num = parseFloat(quotaMatch[1].replace(",", "."));
      const unit = quotaMatch[2].toUpperCase();
      if (unit === "TB") {
        quotaMb = num * 1024 * 1024;
      } else if (unit === "GB") {
        quotaMb = num * 1024;
      } else if (unit === "MB") {
        quotaMb = num;
      }
    } else {
      // If no GB/MB found, maybe a raw number like "10k" or "25000" or just "10"
      const rawNumMatch = clean.match(/(\d+(?:[.,]\d+)?)/);
      if (rawNumMatch) {
        quotaMb = parseFloat(rawNumMatch[1].replace(",", ".")) || 0;
      }
    }
  }

  // Raw number for general tiebreaking
  const numOnly = clean.replace(/[^\d]/g, "");
  const rawNumber = numOnly ? parseInt(numOnly, 10) : 0;

  return {
    isUnlimited,
    quotaMb,
    days,
    rawNumber,
  };
}

export function compareVouchers<T extends VoucherLike>(a: T, b: T): number {
  // 1. Sort by Operator (A-Z)
  const opA = (a.operator || "").trim();
  const opB = (b.operator || "").trim();
  const opCompare = opA.localeCompare(opB, "id", { sensitivity: "base" });
  if (opCompare !== 0) {
    return opCompare;
  }

  // 2. Parse Nominals
  const parsedA = parseVoucherNominal(a.nominal);
  const parsedB = parseVoucherNominal(b.nominal);

  // 3. Compare Quota size (smaller to larger, unlimited at end)
  if (parsedA.quotaMb !== parsedB.quotaMb) {
    return parsedA.quotaMb - parsedB.quotaMb;
  }

  // 4. Compare Validity Days (shorter to longer: 3HR -> 5HR -> 14HR)
  if (parsedA.days !== parsedB.days) {
    return parsedA.days - parsedB.days;
  }

  // 5. Compare Selling Price (cheaper to more expensive)
  const priceA = a.sellingPrice || 0;
  const priceB = b.sellingPrice || 0;
  if (priceA !== priceB) {
    return priceA - priceB;
  }

  // 6. Natural string comparison on nominal
  return (a.nominal || "").localeCompare(b.nominal || "", "id", { numeric: true });
}

export function sortVouchers<T extends VoucherLike>(vouchers: T[]): T[] {
  if (!Array.isArray(vouchers)) return [];
  return [...vouchers].sort(compareVouchers);
}

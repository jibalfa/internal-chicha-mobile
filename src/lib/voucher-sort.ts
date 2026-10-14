/**
 * Utility function to intelligently sort vouchers based on the physical store inventory ledger (Excel sheet):
 * 1. Operator Order:
 *    - Telkomsel (Tsel, Simpati, As) -> Priority 1 (Starts with V.Tsel 5/2)
 *    - Smartfren (SF) -> Priority 2
 *    - Tri (Three, 3) -> Priority 3
 *    - XL -> Priority 4
 *    - Indosat (Im3, Ooredoo) -> Priority 5
 *    - Axis -> Priority 6
 *    - Other operators -> Priority 7 (A-Z)
 * 2. Exact Excel Sheet Row Sequence (matching store's physical binder / recap sheet)
 * 3. Validity Duration (1HR -> 2HR -> 3HR -> 5HR -> 7HR -> 14/15HR -> 28/30HR)
 * 4. Quota Size (MB/GB parsed into MB, ascending. Unlimited at end)
 * 5. Selling Price (cheapest first)
 * 6. Alphanumeric nominal fallback
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

export const OPERATOR_PRIORITY: Record<string, number> = {
  telkomsel: 1,
  tsel: 1,
  simpati: 1,
  as: 1,
  smartfren: 2,
  sf: 2,
  tri: 3,
  three: 3,
  "3": 3,
  xl: 4,
  indosat: 5,
  im3: 5,
  ooredoo: 5,
  axis: 6,
};

export function getOperatorRank(operator: string): number {
  const op = (operator || "").toLowerCase().trim();
  for (const [key, rank] of Object.entries(OPERATOR_PRIORITY)) {
    if (op.includes(key)) return rank;
  }
  return 99;
}

// Ordered mappings matching the store's physical ledger / Excel sheet:
// Column A:
// Row 3: P.Simpati 4gb
// Row 4: V.Tsel 4/1
// Row 5: V.Tsel 5/2
// Row 6: V.Tsel 4/3
// Row 7: V.Tsel 4/5
// Row 8: V.Tsel 6/5
// Row 9: V.Tsl 7/7
// Row 10: V.SF 10/7
// Row 11: V.SF Unli 7
// Row 12: V.SF 4/14
// Row 13: V.SF Unli 6/30
// Row 14: V.Tri 2/1
// Row 15: V.Tri 10/3
// Row 16: V.Tri 3/7
// Row 17: V.Tri 6/5
// Row 18: V.Tri 9/7
// Row 19: V.Tri 7/30
// Row 20: V.Tri 6 Unli
// Row 21: V.Tri 6 Aon
// Row 22: V.XL 3,5/7
// Row 23: V.XL 4,5/30
// Row 24: V.XL 12/30
// Row 25: V.Im3 2,5
// Row 26: V.Im3 9/7
// Row 27: V.Im3 5/5
// Row 28: V.Im3 6/30
// Row 29: V.Axis 3/1
// Row 30: V.Axis 3/3
// Row 31: V.Axis 5/3
// Row 32: V.Axis 4/5
// Row 33: V.Axis 5/5
// Row 34: V.Axis 10/3
// Row 35: V.Axis 16/5
// Row 36: V.Axis 25/5
// Row 37: V.Axis 17/7
// Row 38: V.Axis 5/15
// Row 39: V.Axis 25/15
// Row 40: V.Axis 6,5/30
// Row 41: V.Axis 10/30
// Row 42: V.Axis 16/30

const EXCEL_ROWS = [
  // 1. Telkomsel
  { op: "telkomsel", row: 3, regex: [/simpati/i] },
  { op: "telkomsel", row: 4, regex: [/(?<!\d)4[\s\/]+1\b/i, /(?<!\d)4\s*gb.*1\s*(?:hr|hari)/i] },
  { op: "telkomsel", row: 5, regex: [/(?<!\d)5[\s\/]+2\b/i, /(?<!\d)5\s*gb.*2\s*(?:hr|hari)/i] }, // V.Tsel 5/2 (e.g. TSEL 5GB/2HR)
  { op: "telkomsel", row: 5.5, regex: [/(?<!\d)6[\s\/]+2\b/i, /(?<!\d)6\s*gb.*2\s*(?:hr|hari)/i] }, // 6GB/2HR
  { op: "telkomsel", row: 6, regex: [/(?<!\d)[45][\s\/]+3\b/i, /(?<!\d)[45]\s*gb.*3\s*(?:hr|hari)/i] }, // V.Tsel 4/3 & 5GB/3HR
  { op: "telkomsel", row: 7, regex: [/(?<!\d)4[\s\/]+5\b/i, /(?<!\d)4\s*gb.*5\s*(?:hr|hari)/i] }, // V.Tsel 4/5
  { op: "telkomsel", row: 8, regex: [/(?<!\d)[67][\s\/]+5\b/i, /(?<!\d)[67]\s*gb.*5\s*(?:hr|hari)/i] }, // V.Tsel 6/5 & 7GB/5HR
  { op: "telkomsel", row: 9, regex: [/(?<!\d)7[\s\/]+7\b/i, /(?<!\d)7\s*gb.*7\s*(?:hr|hari)/i] }, // V.Tsl 7/7 (7GB/7HR)
  { op: "telkomsel", row: 9.5, regex: [/(?<!\d)11[\s\/]+7\b/i, /(?<!\d)11\s*gb.*7\s*(?:hr|hari)/i] }, // 11GB/7HR

  // 2. Smartfren
  { op: "smartfren", row: 10, regex: [/(?<!\d)(?:10|9)[\s\/]+7\b/i, /(?<!\d)(?:10|9)\s*gb.*7\s*(?:hr|hari)/i] }, // V.SF 10/7 & 9GB/7HR
  { op: "smartfren", row: 11, regex: [/unli.*7/i, /7.*unli/i] }, // V.SF Unli 7
  { op: "smartfren", row: 12, regex: [/(?<!\d)(?:4|7[,.]5)[\s\/]+14\b/i, /(?<!\d)(?:4|7[,.]5)\s*gb.*14\s*(?:hr|hari)/i] }, // V.SF 4/14 & 7,5GB/14HR
  { op: "smartfren", row: 13, regex: [/unli.*30/i, /unli.*6[\s\/]*30/i] }, // V.SF Unli 6/30

  // 3. Tri
  { op: "tri", row: 14, regex: [/(?<!\d)(?:2|6)[\s\/]+1\b/i, /(?<!\d)(?:2|6)\s*gb.*1\s*(?:hr|hari)/i] }, // V.Tri 2/1 & 6GB/1HR
  { op: "tri", row: 15, regex: [/(?<!\d)(?:10|11)[\s\/]+3\b/i, /(?<!\d)(?:10|11)\s*gb.*3\s*(?:hr|hari)/i] }, // V.Tri 10/3 & 11GB/3HR
  { op: "tri", row: 16, regex: [/(?<!\d)3[\s\/]+7\b/i, /(?<!\d)3\s*gb.*7\s*(?:hr|hari)/i] }, // V.Tri 3/7
  { op: "tri", row: 17, regex: [/(?<!\d)6[\s\/]+5\b/i, /(?<!\d)6\s*gb.*5\s*(?:hr|hari)/i] }, // V.Tri 6/5
  { op: "tri", row: 18, regex: [/(?<!\d)(?:9|15)[\s\/]+7\b/i, /(?<!\d)(?:9|15)\s*gb.*7\s*(?:hr|hari)/i] }, // V.Tri 9/7 & 15GB/7HR
  { op: "tri", row: 19, regex: [/(?<!\d)7[\s\/]+30\b/i, /(?<!\d)7\s*gb.*30\s*(?:hr|hari)/i] }, // V.Tri 7/30
  { op: "tri", row: 20, regex: [/unli/i] }, // V.Tri 6 Unli
  { op: "tri", row: 21, regex: [/aon/i] }, // V.Tri 6 Aon

  // 4. XL
  { op: "xl", row: 22, regex: [/(?<!\d)3[,.]5[\s\/]+7\b/i, /(?<!\d)3[,.]5\s*gb.*7\s*(?:hr|hari)/i] }, // V.XL 3,5/7
  { op: "xl", row: 23, regex: [/(?<!\d)4[,.]5[\s\/]+30\b/i, /(?<!\d)4[,.]5\s*gb.*30\s*(?:hr|hari)/i] }, // V.XL 4,5/30
  { op: "xl", row: 24, regex: [/(?<!\d)(?:12|15)[\s\/]+(?:28|30)\b/i, /(?<!\d)(?:12|15)\s*gb.*(?:28|30)\s*(?:hr|hari)/i] }, // V.XL 12/30 & 15GB/28HR

  // 5. Indosat
  { op: "indosat", row: 25, regex: [/(?<!\d)(?:2[,.]5|4)[\s\/]+5\b/i, /(?<!\d)(?:2[,.]5|4)\s*gb.*5\s*(?:hr|hari)/i, /(?<!\d)2[,.]5\b/i] }, // V.Im3 2,5 & 4GB/5HR
  { op: "indosat", row: 26, regex: [/(?<!\d)(?:5|9)[\s\/]+5\b/i, /(?<!\d)(?:5|9)\s*gb.*5\s*(?:hr|hari)/i] }, // V.Im3 5/5 & 9GB/5HR
  { op: "indosat", row: 27, regex: [/(?<!\d)(?:9|13)[\s\/]+7\b/i, /(?<!\d)(?:9|13)\s*gb.*7\s*(?:hr|hari)/i] }, // V.Im3 9/7 & 13GB/7HR
  { op: "indosat", row: 28, regex: [/(?<!\d)6[\s\/]+30\b/i, /(?<!\d)6\s*gb.*30\s*(?:hr|hari)/i] }, // V.Im3 6/30

  // 6. Axis
  { op: "axis", row: 29, regex: [/(?<!\d)(?:3|8)[\s\/]+1\b/i, /(?<!\d)(?:3|8)\s*gb.*1\s*(?:hr|hari)/i] }, // V.Axis 3/1 & 8GB/1HR
  { op: "axis", row: 30, regex: [/(?<!\d)3[\s\/]+3\b/i, /(?<!\d)3\s*gb.*3\s*(?:hr|hari)/i] }, // V.Axis 3/3
  { op: "axis", row: 31, regex: [/(?<!\d)5[\s\/]+3\b/i, /(?<!\d)5\s*gb.*3\s*(?:hr|hari)/i] }, // V.Axis 5/3
  { op: "axis", row: 32, regex: [/(?<!\d)4[\s\/]+5\b/i, /(?<!\d)4\s*gb.*5\s*(?:hr|hari)/i] }, // V.Axis 4/5
  { op: "axis", row: 33, regex: [/(?<!\d)5[\s\/]+5\b/i, /(?<!\d)5\s*gb.*5\s*(?:hr|hari)/i] }, // V.Axis 5/5
  { op: "axis", row: 34, regex: [/(?<!\d)(?:10|13)[\s\/]+3\b/i, /(?<!\d)(?:10|13)\s*gb.*3\s*(?:hr|hari)/i] }, // V.Axis 10/3 & 13GB/3HR (Row 34)
  { op: "axis", row: 35, regex: [/(?<!\d)16[\s\/]+5\b/i, /(?<!\d)16\s*gb.*5\s*(?:hr|hari)/i] }, // V.Axis 16/5
  { op: "axis", row: 36, regex: [/(?<!\d)(?:25|24)[\s\/]+5\b/i, /(?<!\d)(?:25|24)\s*gb.*5\s*(?:hr|hari)/i] }, // V.Axis 25/5 & 24GB/5HR
  { op: "axis", row: 37, regex: [/(?<!\d)17[\s\/]+7\b/i, /(?<!\d)17\s*gb.*7\s*(?:hr|hari)/i] }, // V.Axis 17/7
  { op: "axis", row: 38, regex: [/(?<!\d)5[\s\/]+(?:14|15)\b/i, /(?<!\d)5\s*gb.*(?:14|15)\s*(?:hr|hari)/i] }, // V.Axis 5/15 & 5GB/14HR
  { op: "axis", row: 39, regex: [/(?<!\d)25[\s\/]+15\b/i, /(?<!\d)25\s*gb.*15\s*(?:hr|hari)/i] }, // V.Axis 25/15
  { op: "axis", row: 40, regex: [/(?<!\d)(?:6[,.]5|7)[\s\/]+30\b/i, /(?<!\d)(?:6[,.]5|7)\s*gb.*30\s*(?:hr|hari)/i] }, // V.Axis 6,5/30 & 7GB/30HR
  { op: "axis", row: 41, regex: [/(?<!\d)10[\s\/]+30\b/i, /(?<!\d)10\s*gb.*30\s*(?:hr|hari)/i] }, // V.Axis 10/30
  { op: "axis", row: 42, regex: [/(?<!\d)(?:16|15)[\s\/]+(?:28|30)\b/i, /(?<!\d)(?:16|15)\s*gb.*(?:28|30)\s*(?:hr|hari)/i] }, // V.Axis 16/30 & 15GB/28HR
];

export function getExcelRowRank(operator: string, nominal: string): number {
  const op = (operator || "").toLowerCase();
  const nom = (nominal || "").toLowerCase();

  for (const item of EXCEL_ROWS) {
    if (op.includes(item.op)) {
      for (const reg of item.regex) {
        if (reg.test(nom)) {
          return item.row;
        }
      }
    }
  }
  return 9999;
}

export function parseVoucherNominal(nominal: string): ParsedNominal {
  const clean = (nominal || "").trim();
  const lower = clean.toLowerCase();

  // 1. Check if Unlimited or AON
  const isUnlimited = lower.includes("unli") || lower.includes("unlimited") || lower.includes("aon");

  // 2. Extract validity days: e.g. /14HR, /30HR, 14HARI, 7D, UNLI 7, 7HR, 5/2 -> 2
  let days = 0;
  const daysMatch = lower.match(/(?:\/|\b)(\d+)\s*(?:hr|hari|d|day|days)\b/);
  if (daysMatch) {
    days = parseInt(daysMatch[1], 10) || 0;
  } else if (isUnlimited) {
    const unliDaysMatch = lower.match(/unli(?:mited)?\s*(\d+)/);
    if (unliDaysMatch) {
      days = parseInt(unliDaysMatch[1], 10) || 0;
    } else if (lower.includes("aon")) {
      days = 365;
    }
  } else {
    // Check "X/Y" pattern where Y is days e.g. 5/2 -> 2
    const slashMatch = lower.match(/\b\d+(?:[.,]\d+)?\s*\/\s*(\d+)\b/);
    if (slashMatch) {
      days = parseInt(slashMatch[1], 10) || 0;
    }
  }

  // 3. Extract Quota: e.g. 5GB, 7,5GB, 1.5GB, 500MB, 24GB
  let quotaMb = 0;
  if (isUnlimited) {
    quotaMb = 999999999;
  } else {
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
      const slashMatch = clean.match(/\b(\d+(?:[.,]\d+)?)\s*\/\s*\d+\b/);
      if (slashMatch) {
        quotaMb = (parseFloat(slashMatch[1].replace(",", ".")) || 0) * 1024;
      } else {
        const rawNumMatch = clean.match(/(\d+(?:[.,]\d+)?)/);
        if (rawNumMatch) {
          quotaMb = parseFloat(rawNumMatch[1].replace(",", ".")) || 0;
        }
      }
    }
  }

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
  // 1. Sort by Operator Priority (Telkomsel -> Smartfren -> Tri -> XL -> Indosat -> Axis -> Others)
  const opRankA = getOperatorRank(a.operator);
  const opRankB = getOperatorRank(b.operator);
  if (opRankA !== opRankB) {
    return opRankA - opRankB;
  }

  // If both operators are outside the known priority list (both 99), sort alphabetically
  if (opRankA === 99) {
    const opA = (a.operator || "").trim();
    const opB = (b.operator || "").trim();
    const opCompare = opA.localeCompare(opB, "id", { sensitivity: "base" });
    if (opCompare !== 0) {
      return opCompare;
    }
  }

  // 2. Exact Excel Row Rank
  const rowA = getExcelRowRank(a.operator, a.nominal);
  const rowB = getExcelRowRank(b.operator, b.nominal);
  if (rowA !== rowB) {
    return rowA - rowB;
  }

  // 3. Fallback: Parse Nominals
  const parsedA = parseVoucherNominal(a.nominal);
  const parsedB = parseVoucherNominal(b.nominal);

  // 4. Compare Validity Days (shorter days first: 1HR -> 2HR -> 3HR -> 5HR -> 7HR -> 14/15HR -> 30HR)
  if (parsedA.days !== parsedB.days) {
    return parsedA.days - parsedB.days;
  }

  // 5. Compare Quota size (smaller to larger, unlimited at end)
  if (parsedA.quotaMb !== parsedB.quotaMb) {
    return parsedA.quotaMb - parsedB.quotaMb;
  }

  // 6. Compare Selling Price (cheaper to more expensive)
  const priceA = a.sellingPrice || 0;
  const priceB = b.sellingPrice || 0;
  if (priceA !== priceB) {
    return priceA - priceB;
  }

  // 7. Natural string comparison on nominal
  return (a.nominal || "").localeCompare(b.nominal || "", "id", { numeric: true });
}

export function sortVouchers<T extends VoucherLike>(vouchers: T[]): T[] {
  if (!Array.isArray(vouchers)) return [];
  return [...vouchers].sort(compareVouchers);
}

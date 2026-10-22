import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";
import { sortVouchers } from "@/lib/voucher-sort";

// Professional Palette for Corporate / Executive Excel Reports
const C = {
  navy: "FF1E3A8A",
  royalBlue: "FF1D4ED8",
  softBlue: "FFDBEAFE",
  lightBlue: "FFEFF6FF",
  darkSlate: "FF0F172A",
  slateHeader: "FF334155",
  slateText: "FF475569",
  slateMuted: "FF64748B",
  borderLight: "FFE2E8F0",
  borderHeader: "FF94A3B8",
  borderDark: "FF1E293B",
  zebraBg: "FFF8FAFC",
  white: "FFFFFFFF",

  // Sheet Theme Headers
  retailPrimary: "FF1E40AF",
  retailHeader: "FF1E3A8A",
  retailLight: "FFDBEAFE",

  voucherPrimary: "FF5B21B6",
  voucherHeader: "FF4C1D95",
  voucherLight: "FFEDE9FE",

  digitalPrimary: "FF065F46",
  digitalHeader: "FF047857",
  digitalLight: "FFD1FAE5",

  expensePrimary: "FF78350F",
  expenseHeader: "FFB45309",
  expenseLight: "FFFEF3C7",

  receivablePrimary: "FF9F1239",
  receivableHeader: "FFBE123C",
  receivableLight: "FFFFE4E6",

  stockPrimary: "FF075985",
  stockHeader: "FF0284C7",
  stockLight: "FFE0F2FE",

  // Status Badges
  greenBg: "FFDCFCE7",
  greenText: "FF166534",
  greenBorder: "FF16A34A",

  amberBg: "FFFEF3C7",
  amberText: "FF92400E",
  amberBorder: "FFD97706",

  redBg: "FFFEE2E2",
  redText: "FF991B1B",
  redBorder: "FFDC2626",
};

const NUM_FMT_RP = '"Rp "#,##0;[Red]-"Rp "#,##0;"Rp "0';
const NUM_FMT_QTY = '#,##0';
const NUM_FMT_PCT = '0.0%';

type ColFormat = "rp" | "qty" | "pct" | "center" | "left" | "status";

function applyStatusStyle(cell: ExcelJS.Cell, statusText: string) {
  const s = String(statusText).toUpperCase().trim();
  if (
    [
      "LUNAS",
      "BERHASIL",
      "AMAN",
      "SURPLUS / PROFIT BERSIH",
      "SURPLUS / PROFIT BERSIH USAHA",
    ].includes(s)
  ) {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.greenBg } };
    cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: C.greenText } };
  } else if (
    ["BELUM LUNAS", "PENDING", "MENUNGGU", "MENIPIS", "KREDIT"].includes(s)
  ) {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.amberBg } };
    cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: C.amberText } };
  } else if (
    ["GAGAL", "HABIS", "DEFISIT / RUGI", "DEFISIT / KERUGIAN USAHA"].includes(s)
  ) {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.redBg } };
    cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: C.redText } };
  }
}

function addSheetHeader(
  ws: ExcelJS.Worksheet,
  title: string,
  subtitle: string,
  totalCols: number,
  primaryColor: string = C.navy
) {
  // Title row
  ws.mergeCells(1, 1, 1, totalCols);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { name: "Calibri", size: 13, bold: true, color: { argb: C.white } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: primaryColor } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 32;

  // Subtitle row
  ws.mergeCells(2, 1, 2, totalCols);
  const subCell = ws.getCell(2, 1);
  subCell.value = subtitle;
  subCell.font = { name: "Calibri", size: 10, italic: true, color: { argb: C.slateText } };
  subCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
  subCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(2).height = 20;

  // Spacer
  ws.getRow(3).height = 10;
}

function addTableHeader(
  ws: ExcelJS.Worksheet,
  rowNum: number,
  headers: string[],
  bgColor: string = C.slateHeader
) {
  const row = ws.getRow(rowNum);
  row.height = 26;
  headers.forEach((h, idx) => {
    const cell = row.getCell(idx + 1);
    cell.value = h;
    cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: C.white } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: C.borderHeader } },
      bottom: { style: "thin", color: { argb: C.borderHeader } },
      left: { style: "thin", color: { argb: C.borderHeader } },
      right: { style: "thin", color: { argb: C.borderHeader } },
    };
  });
}

function renderDataRow(
  row: ExcelJS.Row,
  values: any[],
  colFormats: ColFormat[],
  isEven: boolean
) {
  row.height = 22;
  const bg = isEven ? C.zebraBg : C.white;

  values.forEach((val, idx) => {
    const cell = row.getCell(idx + 1);
    cell.value = val;
    cell.font = { name: "Calibri", size: 10, color: { argb: C.darkSlate } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
    cell.border = {
      top: { style: "thin", color: { argb: C.borderLight } },
      bottom: { style: "thin", color: { argb: C.borderLight } },
      left: { style: "thin", color: { argb: C.borderLight } },
      right: { style: "thin", color: { argb: C.borderLight } },
    };

    const fmt = colFormats[idx] || "left";
    switch (fmt) {
      case "rp":
        cell.alignment = { horizontal: "right", vertical: "middle" };
        if (typeof val === "number") cell.numFmt = NUM_FMT_RP;
        break;
      case "qty":
        cell.alignment = { horizontal: "center", vertical: "middle" };
        if (typeof val === "number") cell.numFmt = NUM_FMT_QTY;
        break;
      case "pct":
        cell.alignment = { horizontal: "center", vertical: "middle" };
        if (typeof val === "number") cell.numFmt = NUM_FMT_PCT;
        break;
      case "center":
        cell.alignment = { horizontal: "center", vertical: "middle" };
        break;
      case "status":
        cell.alignment = { horizontal: "center", vertical: "middle" };
        if (typeof val === "string") {
          applyStatusStyle(cell, val);
        }
        break;
      default:
        cell.alignment = { horizontal: "left", vertical: "middle" };
        break;
    }
  });
}

function renderTotalRow(
  row: ExcelJS.Row,
  values: any[],
  colFormats: ColFormat[],
  bgColor: string = C.softBlue
) {
  row.height = 25;
  values.forEach((val, idx) => {
    const cell = row.getCell(idx + 1);
    cell.value = val === "" || val === undefined ? null : val;
    cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: C.darkSlate } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
    cell.border = {
      top: { style: "thin", color: { argb: C.borderHeader } },
      bottom: { style: "double", color: { argb: C.borderDark } },
      left: { style: "thin", color: { argb: C.borderHeader } },
      right: { style: "thin", color: { argb: C.borderHeader } },
    };

    const fmt = colFormats[idx] || "left";
    switch (fmt) {
      case "rp":
        cell.alignment = { horizontal: "right", vertical: "middle" };
        if (typeof val === "number") cell.numFmt = NUM_FMT_RP;
        break;
      case "qty":
        cell.alignment = { horizontal: "center", vertical: "middle" };
        if (typeof val === "number") cell.numFmt = NUM_FMT_QTY;
        break;
      case "pct":
        cell.alignment = { horizontal: "center", vertical: "middle" };
        if (typeof val === "number") cell.numFmt = NUM_FMT_PCT;
        break;
      case "center":
        cell.alignment = { horizontal: "center", vertical: "middle" };
        break;
      default:
        cell.alignment = { horizontal: "left", vertical: "middle" };
        break;
    }
  });
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isOwner = session.role === "OWNER";

  try {
    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    const now = new Date();
    // Default to this month
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    let startDate = defaultStart;
    let endDate = defaultEnd;

    if (startDateParam) {
      const parts = startDateParam.split("-");
      if (parts.length === 3) {
        startDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 0, 0, 0, 0);
      } else {
        startDate = new Date(startDateParam);
      }
    }

    if (endDateParam) {
      const parts = endDateParam.split("-");
      if (parts.length === 3) {
        endDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 23, 59, 59, 999);
      } else {
        endDate = new Date(endDateParam);
      }
    }

    const dateFilter = {
      gte: startDate,
      lte: endDate,
    };

    const periodStr = `${startDate.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })} s/d ${endDate.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}`;
    const printTimeStr = now.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) + " " + now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WIB";

    // 1. Fetch Sales (POS Retail & Vouchers)
    const sales = await prisma.sale.findMany({
      where: {
        OR: [
          {
            paymentMethod: { not: "CREDIT" },
            createdAt: dateFilter,
          },
          {
            paymentMethod: "CREDIT",
            paymentStatus: "PAID",
            paidAt: dateFilter,
          },
        ],
      },
      include: {
        items: {
          include: {
            product: { include: { category: true } },
            voucher: true,
          },
        },
        cashier: { select: { id: true, name: true, username: true } },
        customer: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // 2. Fetch Digital Transactions (PPOB)
    const digitalTrx = await prisma.digitalTransaction.findMany({
      where: { createdAt: dateFilter },
      include: {
        digitalProduct: true,
        cashier: { select: { id: true, name: true, username: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // 3. Fetch Expenses
    const expenses = await prisma.expense.findMany({
      where: { date: dateFilter },
      include: {
        createdBy: { select: { id: true, name: true, username: true } },
      },
      orderBy: { date: "desc" },
    });

    // 4. Fetch Receivables (Credit sales)
    const receivables = await prisma.sale.findMany({
      where: {
        paymentMethod: "CREDIT",
      },
      include: {
        cashier: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true, phone: true } },
        items: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // 5. Fetch Vouchers Catalog (with standard sequence)
    const rawVouchers = await prisma.voucher.findMany({
      where: { isActive: true },
    });
    const vouchers = sortVouchers(rawVouchers);

    // ==========================================
    // AGGREGATION CALCULATIONS FOR P&L
    // ==========================================
    let posRevenue = 0;
    let posCost = 0;
    let posProfit = 0;
    let posProductItemsCount = 0;

    let voucherRevenue = 0;
    let voucherCost = 0;
    let voucherProfit = 0;
    let voucherSoldPcs = 0;

    const retailItemsRows: any[] = [];
    const voucherItemsRows: any[] = [];

    let retailIdx = 1;
    let voucherIdx = 1;

    for (const sale of sales) {
      const saleDateStr =
        new Date(sale.createdAt).toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }) +
        " " +
        new Date(sale.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

      const cashierName = sale.cashier?.name || "Kasir";
      const customerName = sale.customerName || sale.customer?.name || "-";
      const isPOS = !sale.invoiceNumber.startsWith("VCH-");

      for (const item of sale.items) {
        if (item.itemType === "PRODUCT") {
          posRevenue += item.subtotal;
          posCost += item.costPrice * item.quantity;
          posProfit += item.profit;
          posProductItemsCount += item.quantity;

          retailItemsRows.push([
            retailIdx++,
            saleDateStr,
            sale.invoiceNumber,
            cashierName,
            customerName,
            item.itemName,
            item.product?.category?.name || "Aksesoris",
            item.quantity,
            isOwner ? item.costPrice : 0,
            item.unitPrice,
            item.subtotal,
            isOwner ? item.profit : 0,
            sale.paymentMethod === "CREDIT" ? "KREDIT" : sale.paymentMethod,
            sale.paymentStatus === "PAID" ? "Lunas" : "Belum Lunas",
            sale.notes || "-",
          ]);
        } else if (item.itemType === "VOUCHER") {
          voucherRevenue += item.subtotal;
          voucherCost += item.costPrice * item.quantity;
          voucherProfit += item.profit;
          voucherSoldPcs += item.quantity;

          voucherItemsRows.push([
            voucherIdx++,
            saleDateStr,
            sale.invoiceNumber,
            isPOS ? "Kasir POS" : "Pencatatan Sisa Stok",
            cashierName,
            item.voucher?.operator || "Lainnya",
            item.voucher?.nominal || "-",
            item.itemName,
            item.quantity,
            isOwner ? item.costPrice : 0,
            item.unitPrice,
            item.subtotal,
            isOwner ? item.profit : 0,
            sale.paymentMethod === "CREDIT" ? "KREDIT" : sale.paymentMethod,
            sale.paymentStatus === "PAID" ? "Lunas" : "Belum Lunas",
          ]);
        }
      }
    }

    const digitalSuccess = digitalTrx.filter((t) => t.status === "SUCCESS");
    const digitalRevenue = digitalSuccess.reduce((sum, t) => sum + t.sellingPrice, 0);
    const digitalCost = digitalSuccess.reduce((sum, t) => sum + t.costPrice, 0);
    const digitalProfit = digitalSuccess.reduce((sum, t) => sum + t.profit, 0);

    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    const totalGrossRevenue = posRevenue + voucherRevenue + digitalRevenue;
    const totalCOGS = posCost + voucherCost + digitalCost;
    const totalGrossProfit = posProfit + voucherProfit + digitalProfit;
    const netProfit = totalGrossProfit - totalExpenses;

    // Expense category breakdown
    const expenseCategoryMap: Record<string, number> = {
      ELECTRICITY: 0,
      INTERNET: 0,
      RENT: 0,
      OPERATIONAL: 0,
      TRANSPORT: 0,
      SALARY: 0,
      OTHER: 0,
    };
    for (const e of expenses) {
      expenseCategoryMap[e.category] = (expenseCategoryMap[e.category] || 0) + e.amount;
    }

    // Initialize Excel Workbook
    const wb = new ExcelJS.Workbook();
    wb.creator = "ChiCha Mobile Internal System";
    wb.lastModifiedBy = session.name || "Owner";
    wb.created = now;
    wb.modified = now;

    // ==========================================
    // SHEET 1: RINGKASAN LABA RUGI
    // ==========================================
    const wsPnl = wb.addWorksheet("Ringkasan Laba Rugi", {
      views: [{ showGridLines: true }],
    });

    addSheetHeader(
      wsPnl,
      "CHICHA MOBILE - LAPORAN EKSEKUTIF LABA RUGI & KEUANGAN",
      `Periode: ${periodStr} | Dicetak Pada: ${printTimeStr} | Oleh: ${session.name || "Kasir"} (${session.role})`,
      7,
      C.navy
    );

    // Section 1 Header
    wsPnl.mergeCells(4, 1, 4, 7);
    const s1 = wsPnl.getCell(4, 1);
    s1.value = "1. RINGKASAN PENDAPATAN & LABA KOTOR PER DIVISI USAHA";
    s1.font = { name: "Calibri", size: 11, bold: true, color: { argb: C.white } };
    s1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.royalBlue } };
    s1.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    wsPnl.getRow(4).height = 24;

    addTableHeader(
      wsPnl,
      5,
      [
        "No",
        "Divisi Usaha",
        "Jumlah Volume",
        "Total Omset (Rp)",
        "Harga Pokok / Modal (Rp)",
        "Laba Kotor (Rp)",
        "Margin Kotor (%)",
      ],
      C.slateHeader
    );

    const s1Rows = [
      [
        1,
        "Penjualan Retail & Aksesoris",
        `${posProductItemsCount} pcs`,
        posRevenue,
        isOwner ? posCost : 0,
        isOwner ? posProfit : 0,
        posRevenue > 0 ? posProfit / posRevenue : 0,
      ],
      [
        2,
        "Penjualan Voucher Fisik HP",
        `${voucherSoldPcs} pcs`,
        voucherRevenue,
        isOwner ? voucherCost : 0,
        isOwner ? voucherProfit : 0,
        voucherRevenue > 0 ? voucherProfit / voucherRevenue : 0,
      ],
      [
        3,
        "Transaksi Digital & PPOB (Pulsa, PLN, dll)",
        `${digitalSuccess.length} trx`,
        digitalRevenue,
        isOwner ? digitalCost : 0,
        isOwner ? digitalProfit : 0,
        digitalRevenue > 0 ? digitalProfit / digitalRevenue : 0,
      ],
    ];

    s1Rows.forEach((rData, idx) => {
      renderDataRow(
        wsPnl.getRow(6 + idx),
        rData,
        ["center", "left", "center", "rp", "rp", "rp", "pct"],
        idx % 2 === 1
      );
    });

    renderTotalRow(
      wsPnl.getRow(9),
      [
        "",
        "TOTAL PENDAPATAN & LABA KOTOR",
        `${posProductItemsCount + voucherSoldPcs} pcs / ${digitalSuccess.length} trx`,
        totalGrossRevenue,
        isOwner ? totalCOGS : 0,
        isOwner ? totalGrossProfit : 0,
        totalGrossRevenue > 0 ? totalGrossProfit / totalGrossRevenue : 0,
      ],
      ["center", "left", "center", "rp", "rp", "rp", "pct"],
      C.softBlue
    );

    wsPnl.getRow(10).height = 12;

    // Section 2: Beban Operasional
    wsPnl.mergeCells(11, 1, 11, 7);
    const s2 = wsPnl.getCell(11, 1);
    s2.value = "2. RINCIAN BEBAN & BIAYA OPERASIONAL (OPEX)";
    s2.font = { name: "Calibri", size: 11, bold: true, color: { argb: C.white } };
    s2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.expenseHeader } };
    s2.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    wsPnl.getRow(11).height = 24;

    const row12 = wsPnl.getRow(12);
    row12.height = 26;
    wsPnl.getCell(12, 1).value = "No";
    wsPnl.getCell(12, 2).value = "Kategori Beban";
    wsPnl.mergeCells(12, 3, 12, 5);
    wsPnl.getCell(12, 3).value = "Keterangan / Rincian Operasional";
    wsPnl.mergeCells(12, 6, 12, 7);
    wsPnl.getCell(12, 6).value = "Total Pengeluaran (Rp)";

    for (let c = 1; c <= 7; c++) {
      const cell = wsPnl.getCell(12, c);
      cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: C.white } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.slateHeader } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = {
        top: { style: "thin", color: { argb: C.borderHeader } },
        bottom: { style: "thin", color: { argb: C.borderHeader } },
        left: { style: "thin", color: { argb: C.borderHeader } },
        right: { style: "thin", color: { argb: C.borderHeader } },
      };
    }

    const expenseItems = [
      { no: 1, cat: "Listrik & Utilitas", desc: "Tagihan listrik PLN, token, air toko", val: expenseCategoryMap.ELECTRICITY || 0 },
      { no: 2, cat: "Internet & Komunikasi", desc: "Tagihan internet wifi toko & pulsa operasional", val: expenseCategoryMap.INTERNET || 0 },
      { no: 3, cat: "Sewa Tempat / Ruko", desc: "Biaya sewa toko / kios counter", val: expenseCategoryMap.RENT || 0 },
      { no: 4, cat: "Operasional Harian", desc: "ATK, plastik kresek, nota, konsumsi, maintenance", val: expenseCategoryMap.OPERATIONAL || 0 },
      { no: 5, cat: "Transportasi & Logistik", desc: "Bensin, ongkos kirim pasokan / distributor", val: expenseCategoryMap.TRANSPORT || 0 },
      { no: 6, cat: "Gaji & Upah Karyawan", desc: "Gaji kasir, bonus pencapaian karyawan", val: expenseCategoryMap.SALARY || 0 },
      { no: 7, cat: "Beban Lain-lain", desc: "Pengeluaran tidak terduga lainnya", val: expenseCategoryMap.OTHER || 0 },
    ];

    expenseItems.forEach((item, idx) => {
      const r = 13 + idx;
      const row = wsPnl.getRow(r);
      row.height = 22;
      const bg = idx % 2 === 1 ? C.zebraBg : C.white;

      wsPnl.mergeCells(r, 3, r, 5);
      wsPnl.mergeCells(r, 6, r, 7);

      wsPnl.getCell(r, 1).value = item.no;
      wsPnl.getCell(r, 1).alignment = { horizontal: "center", vertical: "middle" };

      wsPnl.getCell(r, 2).value = item.cat;
      wsPnl.getCell(r, 2).alignment = { horizontal: "left", vertical: "middle" };

      wsPnl.getCell(r, 3).value = item.desc;
      wsPnl.getCell(r, 3).alignment = { horizontal: "left", vertical: "middle" };

      wsPnl.getCell(r, 6).value = item.val;
      wsPnl.getCell(r, 6).alignment = { horizontal: "right", vertical: "middle" };
      wsPnl.getCell(r, 6).numFmt = NUM_FMT_RP;

      for (let c = 1; c <= 7; c++) {
        const cell = wsPnl.getCell(r, c);
        cell.font = { name: "Calibri", size: 10, color: { argb: C.darkSlate } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        cell.border = {
          top: { style: "thin", color: { argb: C.borderLight } },
          bottom: { style: "thin", color: { argb: C.borderLight } },
          left: { style: "thin", color: { argb: C.borderLight } },
          right: { style: "thin", color: { argb: C.borderLight } },
        };
      }
    });

    const r20 = 20;
    const row20 = wsPnl.getRow(r20);
    row20.height = 25;
    wsPnl.mergeCells(r20, 3, r20, 5);
    wsPnl.mergeCells(r20, 6, r20, 7);

    wsPnl.getCell(r20, 1).value = null;
    wsPnl.getCell(r20, 2).value = "TOTAL BEBAN OPERASIONAL";
    wsPnl.getCell(r20, 2).alignment = { horizontal: "left", vertical: "middle" };
    wsPnl.getCell(r20, 3).value = null;
    wsPnl.getCell(r20, 6).value = totalExpenses;
    wsPnl.getCell(r20, 6).alignment = { horizontal: "right", vertical: "middle" };
    wsPnl.getCell(r20, 6).numFmt = NUM_FMT_RP;

    for (let c = 1; c <= 7; c++) {
      const cell = wsPnl.getCell(r20, c);
      cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: C.darkSlate } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.expenseLight } };
      cell.border = {
        top: { style: "thin", color: { argb: C.borderHeader } },
        bottom: { style: "double", color: { argb: C.borderDark } },
        left: { style: "thin", color: { argb: C.borderHeader } },
        right: { style: "thin", color: { argb: C.borderHeader } },
      };
    }

    wsPnl.getRow(21).height = 12;

    // Section 3: Hasil Akhir Keuangan Bersih (Net Income)
    wsPnl.mergeCells(22, 1, 22, 7);
    const s3 = wsPnl.getCell(22, 1);
    s3.value = "3. HASIL AKHIR KEUANGAN BERSIH (NET INCOME)";
    s3.font = { name: "Calibri", size: 11, bold: true, color: { argb: C.white } };
    s3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.digitalHeader } };
    s3.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    wsPnl.getRow(22).height = 24;

    const row23 = wsPnl.getRow(23);
    row23.height = 26;
    wsPnl.getCell(23, 1).value = "No";
    wsPnl.getCell(23, 2).value = "Indikator Keuangan";
    wsPnl.mergeCells(23, 3, 23, 4);
    wsPnl.getCell(23, 3).value = "Nilai (Rp / %)";
    wsPnl.mergeCells(23, 5, 23, 7);
    wsPnl.getCell(23, 5).value = "Keterangan & Analisis";

    for (let c = 1; c <= 7; c++) {
      const cell = wsPnl.getCell(23, c);
      cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: C.white } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.slateHeader } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = {
        top: { style: "thin", color: { argb: C.borderHeader } },
        bottom: { style: "thin", color: { argb: C.borderHeader } },
        left: { style: "thin", color: { argb: C.borderHeader } },
        right: { style: "thin", color: { argb: C.borderHeader } },
      };
    }

    const pnlSummaryItems = [
      {
        no: 1,
        label: "Total Omset Penjualan Kotor",
        val: totalGrossRevenue,
        desc: "Total uang masuk dari seluruh lini usaha (Retail, Voucher, PPOB)",
        type: "rp",
        highlight: "softGreen",
      },
      {
        no: 2,
        label: "Total Harga Pokok Penjualan (HPP)",
        val: isOwner ? totalCOGS : "Terkunci (RBAC)",
        desc: "Biaya modal barang & voucher fisik yang terjual",
        type: isOwner ? "rp" : "locked",
        highlight: "neutral",
      },
      {
        no: 3,
        label: "Total Laba Kotor Usaha",
        val: isOwner ? totalGrossProfit : "Terkunci (RBAC)",
        desc: "Laba kotor sebelum dikurangi beban operasional",
        type: isOwner ? "rp" : "locked",
        highlight: "softBlue",
      },
      {
        no: 4,
        label: "Total Pengeluaran Operasional",
        val: totalExpenses,
        desc: "Biaya operasional toko selama periode yang dipilih",
        type: "rp",
        highlight: "softAmber",
      },
      {
        no: 5,
        label: "LABA BERSIH USAHA (NET PROFIT)",
        val: isOwner ? netProfit : "Terkunci (RBAC)",
        desc: isOwner
          ? netProfit >= 0
            ? "Surplus / Profit Bersih Usaha (Surplus Keuangan)"
            : "Defisit / Kerugian Usaha (Defisit Keuangan)"
          : "Terkunci",
        type: isOwner ? "rp" : "locked",
        highlight: "netProfit",
      },
      {
        no: 6,
        label: "Persentase Margin Bersih (Net Margin)",
        val: isOwner ? (totalGrossRevenue > 0 ? netProfit / totalGrossRevenue : 0) : "Terkunci",
        desc: "Persentase perbandingan laba bersih terhadap total omset",
        type: isOwner ? "pct" : "locked",
        highlight: "neutral",
      },
      {
        no: 7,
        label: "Rasio Efisiensi Beban (Opex Ratio)",
        val: isOwner ? (totalGrossProfit > 0 ? totalExpenses / totalGrossProfit : 0) : "Terkunci",
        desc: "Persentase beban operasional terhadap perolehan laba kotor",
        type: isOwner ? "pct" : "locked",
        highlight: "neutral",
      },
    ];

    pnlSummaryItems.forEach((item, idx) => {
      const r = 24 + idx;
      const row = wsPnl.getRow(r);
      const isNetProfitRow = item.highlight === "netProfit";
      row.height = isNetProfitRow ? 28 : 22;

      wsPnl.mergeCells(r, 3, r, 4);
      wsPnl.mergeCells(r, 5, r, 7);

      wsPnl.getCell(r, 1).value = item.no;
      wsPnl.getCell(r, 1).alignment = { horizontal: "center", vertical: "middle" };

      wsPnl.getCell(r, 2).value = item.label;
      wsPnl.getCell(r, 2).alignment = { horizontal: "left", vertical: "middle" };

      wsPnl.getCell(r, 3).value = item.val;
      wsPnl.getCell(r, 3).alignment = {
        horizontal: item.type === "rp" ? "right" : "center",
        vertical: "middle",
      };
      if (item.type === "rp" && typeof item.val === "number") {
        wsPnl.getCell(r, 3).numFmt = NUM_FMT_RP;
      } else if (item.type === "pct" && typeof item.val === "number") {
        wsPnl.getCell(r, 3).numFmt = NUM_FMT_PCT;
      }

      wsPnl.getCell(r, 5).value = item.desc;
      wsPnl.getCell(r, 5).alignment = { horizontal: "left", vertical: "middle" };

      let rowBg = idx % 2 === 1 ? C.zebraBg : C.white;
      let fontColor = C.darkSlate;
      let isBold = false;
      let borderColor = C.borderLight;
      let bottomBorderStyle: ExcelJS.BorderStyle = "thin";

      if (item.highlight === "softGreen") {
        rowBg = "FFF0FDF4";
        isBold = true;
      } else if (item.highlight === "softBlue") {
        rowBg = "FFEFF6FF";
        isBold = true;
      } else if (item.highlight === "softAmber") {
        rowBg = "FFFFFBEB";
        isBold = true;
      } else if (isNetProfitRow) {
        isBold = true;
        if (typeof netProfit === "number" && netProfit < 0) {
          rowBg = C.redBg;
          fontColor = C.redText;
          borderColor = C.redBorder;
          bottomBorderStyle = "double";
        } else {
          rowBg = C.greenBg;
          fontColor = C.greenText;
          borderColor = C.greenBorder;
          bottomBorderStyle = "double";
        }
      }

      for (let c = 1; c <= 7; c++) {
        const cell = wsPnl.getCell(r, c);
        cell.font = {
          name: "Calibri",
          size: isNetProfitRow ? 11 : 10,
          bold: isBold,
          color: { argb: fontColor },
        };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowBg } };
        cell.border = {
          top: { style: "thin", color: { argb: borderColor } },
          bottom: { style: bottomBorderStyle, color: { argb: borderColor } },
          left: { style: "thin", color: { argb: borderColor } },
          right: { style: "thin", color: { argb: borderColor } },
        };
      }

      if (isNetProfitRow) {
        wsPnl.getCell(r, 3).font = {
          name: "Calibri",
          size: 12,
          bold: true,
          color: { argb: fontColor },
        };
      }
    });

    wsPnl.columns = [
      { width: 6 },
      { width: 40 },
      { width: 20 },
      { width: 22 },
      { width: 24 },
      { width: 22 },
      { width: 18 },
    ];

    // ==========================================
    // SHEET 2: RETAIL & AKSESORIS
    // ==========================================
    const wsRetail = wb.addWorksheet("Retail & Aksesoris", {
      views: [{ showGridLines: true }],
    });

    addSheetHeader(
      wsRetail,
      "CHICHA MOBILE - DETAIL TRANSAKSI PENJUALAN RETAIL & AKSESORIS",
      `Periode: ${periodStr} | Total Item Terjual: ${posProductItemsCount} pcs`,
      15,
      C.retailPrimary
    );

    const retailHeaders = [
      "No",
      "Waktu Transaksi",
      "No. Faktur",
      "Kasir",
      "Pelanggan",
      "Nama Produk / Aksesoris",
      "Kategori",
      "Qty (Pcs)",
      "Harga Modal (Rp)",
      "Harga Jual (Rp)",
      "Total Omset (Rp)",
      "Laba Kotor (Rp)",
      "Metode Bayar",
      "Status Lunas",
      "Catatan",
    ];
    addTableHeader(wsRetail, 4, retailHeaders, C.retailHeader);

    const retailColFormats: ColFormat[] = [
      "center",
      "center",
      "center",
      "left",
      "left",
      "left",
      "left",
      "qty",
      "rp",
      "rp",
      "rp",
      "rp",
      "center",
      "status",
      "left",
    ];

    retailItemsRows.forEach((rowVals, idx) => {
      renderDataRow(wsRetail.getRow(5 + idx), rowVals, retailColFormats, idx % 2 === 1);
    });

    const retailTotalRowNum = 5 + retailItemsRows.length;
    renderTotalRow(
      wsRetail.getRow(retailTotalRowNum),
      [
        "",
        "TOTAL PENJUALAN RETAIL",
        "",
        "",
        "",
        "",
        "",
        posProductItemsCount,
        "",
        "",
        posRevenue,
        isOwner ? posProfit : 0,
        "",
        "",
        "",
      ],
      retailColFormats,
      C.retailLight
    );

    wsRetail.columns = [
      { width: 6 },
      { width: 20 },
      { width: 20 },
      { width: 16 },
      { width: 20 },
      { width: 34 },
      { width: 18 },
      { width: 12 },
      { width: 18 },
      { width: 18 },
      { width: 20 },
      { width: 18 },
      { width: 15 },
      { width: 15 },
      { width: 25 },
    ];

    // ==========================================
    // SHEET 3: VOUCHER FISIK
    // ==========================================
    const wsVoucher = wb.addWorksheet("Voucher Fisik", {
      views: [{ showGridLines: true }],
    });

    addSheetHeader(
      wsVoucher,
      "CHICHA MOBILE - DETAIL TRANSAKSI PENJUALAN VOUCHER FISIK",
      `Periode: ${periodStr} | Total Voucher Terjual: ${voucherSoldPcs} pcs`,
      15,
      C.voucherPrimary
    );

    const voucherHeaders = [
      "No",
      "Waktu Transaksi",
      "No. Faktur",
      "Sumber Transaksi",
      "Kasir",
      "Operator",
      "Nominal",
      "Nama Voucher",
      "Qty (Pcs)",
      "Harga Modal (Rp)",
      "Harga Jual (Rp)",
      "Total Omset (Rp)",
      "Laba Kotor (Rp)",
      "Metode Bayar",
      "Status Lunas",
    ];
    addTableHeader(wsVoucher, 4, voucherHeaders, C.voucherHeader);

    const voucherColFormats: ColFormat[] = [
      "center",
      "center",
      "center",
      "center",
      "left",
      "center",
      "center",
      "left",
      "qty",
      "rp",
      "rp",
      "rp",
      "rp",
      "center",
      "status",
    ];

    voucherItemsRows.forEach((rowVals, idx) => {
      renderDataRow(wsVoucher.getRow(5 + idx), rowVals, voucherColFormats, idx % 2 === 1);
    });

    const voucherTotalRowNum = 5 + voucherItemsRows.length;
    renderTotalRow(
      wsVoucher.getRow(voucherTotalRowNum),
      [
        "",
        "TOTAL PENJUALAN VOUCHER",
        "",
        "",
        "",
        "",
        "",
        "",
        voucherSoldPcs,
        "",
        "",
        voucherRevenue,
        isOwner ? voucherProfit : 0,
        "",
        "",
      ],
      voucherColFormats,
      C.voucherLight
    );

    wsVoucher.columns = [
      { width: 6 },
      { width: 20 },
      { width: 20 },
      { width: 22 },
      { width: 16 },
      { width: 16 },
      { width: 14 },
      { width: 32 },
      { width: 12 },
      { width: 18 },
      { width: 18 },
      { width: 20 },
      { width: 18 },
      { width: 15 },
      { width: 15 },
    ];

    // ==========================================
    // SHEET 4: PRODUK DIGITAL PPOB
    // ==========================================
    const wsDigital = wb.addWorksheet("Produk Digital PPOB", {
      views: [{ showGridLines: true }],
    });

    addSheetHeader(
      wsDigital,
      "CHICHA MOBILE - DETAIL TRANSAKSI PRODUK DIGITAL & PPOB",
      `Periode: ${periodStr} | Total Transaksi Sukses: ${digitalSuccess.length} trx`,
      13,
      C.digitalPrimary
    );

    const digitalHeaders = [
      "No",
      "Waktu Transaksi",
      "No. Transaksi (ID)",
      "Kasir",
      "Kategori",
      "Provider",
      "Nama Produk Digital",
      "Nomor Tujuan / Meter",
      "Harga Modal (Rp)",
      "Harga Jual (Rp)",
      "Laba Bersih (Rp)",
      "Status Transaksi",
      "Catatan",
    ];
    addTableHeader(wsDigital, 4, digitalHeaders, C.digitalHeader);

    const digitalColFormats: ColFormat[] = [
      "center",
      "center",
      "center",
      "left",
      "center",
      "center",
      "left",
      "center",
      "rp",
      "rp",
      "rp",
      "status",
      "left",
    ];

    const digitalRows = digitalTrx.map((t, i) => {
      const dateStr =
        new Date(t.createdAt).toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }) +
        " " +
        new Date(t.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

      return [
        i + 1,
        dateStr,
        t.trxNumber,
        t.cashier?.name || "Kasir",
        t.digitalProduct?.category || "PULSA",
        t.digitalProduct?.provider || "-",
        t.digitalProduct?.name || "-",
        t.destinationNumber,
        isOwner ? t.costPrice : 0,
        t.sellingPrice,
        isOwner && t.status === "SUCCESS" ? t.profit : 0,
        t.status === "SUCCESS" ? "BERHASIL" : t.status === "PENDING" ? "MENUNGGU" : "GAGAL",
        t.notes || "-",
      ];
    });

    digitalRows.forEach((rowVals, idx) => {
      renderDataRow(wsDigital.getRow(5 + idx), rowVals, digitalColFormats, idx % 2 === 1);
    });

    const digitalTotalRowNum = 5 + digitalRows.length;
    renderTotalRow(
      wsDigital.getRow(digitalTotalRowNum),
      [
        "",
        "TOTAL TRANSAKSI DIGITAL BERHASIL",
        "",
        "",
        "",
        "",
        "",
        `${digitalSuccess.length} transaksi`,
        "",
        digitalRevenue,
        isOwner ? digitalProfit : 0,
        "",
        "",
      ],
      digitalColFormats,
      C.digitalLight
    );

    wsDigital.columns = [
      { width: 6 },
      { width: 20 },
      { width: 24 },
      { width: 16 },
      { width: 15 },
      { width: 16 },
      { width: 30 },
      { width: 22 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 16 },
      { width: 22 },
    ];

    // ==========================================
    // SHEET 5: BEBAN OPERASIONAL
    // ==========================================
    const wsExpense = wb.addWorksheet("Beban Operasional", {
      views: [{ showGridLines: true }],
    });

    addSheetHeader(
      wsExpense,
      "CHICHA MOBILE - DAFTAR PENGELUARAN & BEBAN OPERASIONAL",
      `Periode: ${periodStr} | Total Pengeluaran: ${printTimeStr}`,
      7,
      C.expensePrimary
    );

    const expenseHeaders = [
      "No",
      "Tanggal Pengeluaran",
      "Kategori Beban",
      "Keterangan / Deskripsi",
      "Jumlah Biaya (Rp)",
      "Dicatat Oleh",
      "Catatan Tambahan",
    ];
    addTableHeader(wsExpense, 4, expenseHeaders, C.expenseHeader);

    const expenseColFormats: ColFormat[] = [
      "center",
      "center",
      "left",
      "left",
      "rp",
      "left",
      "left",
    ];

    const categoryLabels: Record<string, string> = {
      ELECTRICITY: "Listrik & PLN",
      INTERNET: "Internet & Wifi",
      RENT: "Sewa Tempat / Ruko",
      OPERATIONAL: "Operasional Toko",
      TRANSPORT: "Transportasi & Kurir",
      SALARY: "Gaji & Upah",
      OTHER: "Lain-lain",
    };

    const expenseRows = expenses.map((e, i) => {
      const dateStr = new Date(e.date).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });

      return [
        i + 1,
        dateStr,
        categoryLabels[e.category] || e.category,
        e.description,
        e.amount,
        e.createdBy?.name || "Admin",
        e.notes || "-",
      ];
    });

    expenseRows.forEach((rowVals, idx) => {
      renderDataRow(wsExpense.getRow(5 + idx), rowVals, expenseColFormats, idx % 2 === 1);
    });

    const expenseTotalRowNum = 5 + expenseRows.length;
    renderTotalRow(
      wsExpense.getRow(expenseTotalRowNum),
      ["", "TOTAL PENGELUARAN OPERASIONAL", "", "", totalExpenses, "", ""],
      expenseColFormats,
      C.expenseLight
    );

    wsExpense.columns = [
      { width: 6 },
      { width: 18 },
      { width: 24 },
      { width: 38 },
      { width: 22 },
      { width: 18 },
      { width: 28 },
    ];

    // ==========================================
    // SHEET 6: PIUTANG & NOTA
    // ==========================================
    const wsReceivables = wb.addWorksheet("Piutang & Nota", {
      views: [{ showGridLines: true }],
    });

    addSheetHeader(
      wsReceivables,
      "CHICHA MOBILE - DAFTAR PIUTANG & NOTA PELANGGAN",
      `Waktu Penarikan Data: ${printTimeStr}`,
      12,
      C.receivablePrimary
    );

    const receivableHeaders = [
      "No",
      "Tanggal Transaksi",
      "No. Faktur",
      "Nama Pelanggan",
      "No. Telepon",
      "Kasir",
      "Jatuh Tempo",
      "Nilai Tagihan (Rp)",
      "Status Pelunasan",
      "Tanggal Lunas",
      "Metode Pelunasan",
      "Catatan",
    ];
    addTableHeader(wsReceivables, 4, receivableHeaders, C.receivableHeader);

    const receivableColFormats: ColFormat[] = [
      "center",
      "center",
      "center",
      "left",
      "center",
      "left",
      "center",
      "rp",
      "status",
      "center",
      "center",
      "left",
    ];

    const receivableRows = receivables.map((r, i) => {
      const dateStr = new Date(r.createdAt).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      const dueDateStr = r.dueDate
        ? new Date(r.dueDate).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" })
        : "-";
      const paidAtStr = r.paidAt
        ? new Date(r.paidAt).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" })
        : "-";

      return [
        i + 1,
        dateStr,
        r.invoiceNumber,
        r.customerName || r.customer?.name || "Umum",
        r.customerPhone || r.customer?.phone || "-",
        r.cashier?.name || "Kasir",
        dueDateStr,
        r.finalAmount,
        r.paymentStatus === "PAID" ? "LUNAS" : "BELUM LUNAS",
        paidAtStr,
        r.paidMethod || "-",
        r.notes || "-",
      ];
    });

    receivableRows.forEach((rowVals, idx) => {
      renderDataRow(wsReceivables.getRow(5 + idx), rowVals, receivableColFormats, idx % 2 === 1);
    });

    const unpaidTotal = receivables
      .filter((r) => r.paymentStatus !== "PAID")
      .reduce((sum, r) => sum + r.finalAmount, 0);

    const receivableTotalRowNum = 5 + receivableRows.length;
    renderTotalRow(
      wsReceivables.getRow(receivableTotalRowNum),
      ["", "TOTAL PIUTANG BELUM LUNAS", "", "", "", "", "", unpaidTotal, "", "", "", ""],
      receivableColFormats,
      C.receivableLight
    );

    wsReceivables.columns = [
      { width: 6 },
      { width: 18 },
      { width: 20 },
      { width: 24 },
      { width: 18 },
      { width: 16 },
      { width: 16 },
      { width: 22 },
      { width: 16 },
      { width: 16 },
      { width: 18 },
      { width: 25 },
    ];

    // ==========================================
    // SHEET 7: STOK VOUCHER FISIK
    // ==========================================
    const wsCatalog = wb.addWorksheet("Stok Voucher Fisik", {
      views: [{ showGridLines: true }],
    });

    addSheetHeader(
      wsCatalog,
      "CHICHA MOBILE - KATALOG & INVENTARIS STOK VOUCHER FISIK",
      `Posisi Stok Per: ${printTimeStr} | Total Varian: ${vouchers.length} item`,
      10,
      C.stockPrimary
    );

    const catalogHeaders = [
      "No",
      "Operator Provider",
      "Nominal",
      "Nama Lengkap Voucher",
      "Stok Fisik (Pcs)",
      "Batas Min. Stok",
      "Status Persediaan",
      "Harga Modal (Rp)",
      "Harga Jual (Rp)",
      "Total Nilai Aset Stok (Rp)",
    ];
    addTableHeader(wsCatalog, 4, catalogHeaders, C.stockHeader);

    const catalogColFormats: ColFormat[] = [
      "center",
      "center",
      "center",
      "left",
      "qty",
      "qty",
      "status",
      "rp",
      "rp",
      "rp",
    ];

    let totalStockPcs = 0;
    let totalAssetValue = 0;

    const voucherCatalogRows = vouchers.map((v, i) => {
      totalStockPcs += v.stock;
      const asset = v.stock * v.costPrice;
      totalAssetValue += asset;

      let status = "Aman";
      if (v.stock === 0) status = "Habis";
      else if (v.stock <= v.minStock) status = "Menipis";

      return [
        i + 1,
        v.operator,
        v.nominal,
        `Voucher Fisik ${v.operator} ${v.nominal}`,
        v.stock,
        v.minStock,
        status,
        isOwner ? v.costPrice : 0,
        v.sellingPrice,
        isOwner ? asset : 0,
      ];
    });

    voucherCatalogRows.forEach((rowVals, idx) => {
      renderDataRow(wsCatalog.getRow(5 + idx), rowVals, catalogColFormats, idx % 2 === 1);
    });

    const catalogTotalRowNum = 5 + voucherCatalogRows.length;
    renderTotalRow(
      wsCatalog.getRow(catalogTotalRowNum),
      [
        "",
        "TOTAL PERSEDIAAN VOUCHER FISIK",
        "",
        "",
        totalStockPcs,
        "",
        "",
        "",
        "",
        isOwner ? totalAssetValue : 0,
      ],
      catalogColFormats,
      C.stockLight
    );

    wsCatalog.columns = [
      { width: 6 },
      { width: 18 },
      { width: 14 },
      { width: 34 },
      { width: 16 },
      { width: 16 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 24 },
    ];

    // Generate binary buffer
    const excelBuffer = await wb.xlsx.writeBuffer();

    const filename = `Laporan_ChiCha_Mobile_${startDateParam || "Bulan_Ini"}_sd_${endDateParam || "Sekarang"}.xlsx`.replace(/\s+/g, "_");

    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": excelBuffer.byteLength.toString(),
      },
    });
  } catch (error: any) {
    console.error("Export Excel Reports Error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal menyusun file Excel laporan" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import { sortVouchers } from "@/lib/voucher-sort";

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
    const exportType = searchParams.get("type") || "ALL"; // ALL or VOUCHER

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

    // 1. Fetch Sales (POS Retail & Vouchers) - All transactions without slicing
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

    // 5. Fetch Vouchers Catalog (with standard 38 sequence)
    const rawVouchers = await prisma.voucher.findMany({
      where: { isActive: true },
    });
    const vouchers = sortVouchers(rawVouchers);

    // Create Excel Workbook
    const wb = XLSX.utils.book_new();

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
      const saleDateStr = new Date(sale.createdAt).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }) + " " + new Date(sale.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

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
    const grossMarginPercent = totalGrossRevenue > 0 ? (totalGrossProfit / totalGrossRevenue) * 100 : 0;
    const netMarginPercent = totalGrossRevenue > 0 ? (netProfit / totalGrossRevenue) * 100 : 0;
    const opexRatioPercent = totalGrossProfit > 0 ? (totalExpenses / totalGrossProfit) * 100 : 0;

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

    // ==========================================
    // SHEET 1: RINGKASAN LABA RUGI
    // ==========================================
    const pnlRows: any[] = [
      ["CHICHA MOBILE - LAPORAN EKSEKUTIF LABA RUGI & KEUANGAN"],
      [`Periode: ${periodStr}`],
      [`Dicetak Pada: ${printTimeStr} | Oleh: ${session.name || "Kasir"} (${session.role})`],
      [],
      ["1. RINGKASAN PENDAPATAN & LABA KOTOR PER DIVISI USAHA"],
      ["No", "Divisi Usaha", "Jumlah Volume", "Total Omset (Rp)", "Harga Pokok / Modal (Rp)", "Laba Kotor (Rp)", "Margin Kotor (%)"],
      [
        1,
        "Penjualan Retail & Aksesoris",
        `${posProductItemsCount} pcs`,
        posRevenue,
        isOwner ? posCost : 0,
        isOwner ? posProfit : 0,
        posRevenue > 0 ? `${((posProfit / posRevenue) * 100).toFixed(1)}%` : "0%",
      ],
      [
        2,
        "Penjualan Voucher Fisik HP",
        `${voucherSoldPcs} pcs`,
        voucherRevenue,
        isOwner ? voucherCost : 0,
        isOwner ? voucherProfit : 0,
        voucherRevenue > 0 ? `${((voucherProfit / voucherRevenue) * 100).toFixed(1)}%` : "0%",
      ],
      [
        3,
        "Transaksi Digital & PPOB (Pulsa, PLN, dll)",
        `${digitalSuccess.length} trx`,
        digitalRevenue,
        isOwner ? digitalCost : 0,
        isOwner ? digitalProfit : 0,
        digitalRevenue > 0 ? `${((digitalProfit / digitalRevenue) * 100).toFixed(1)}%` : "0%",
      ],
      [
        "",
        "TOTAL PENDAPATAN & LABA KOTOR",
        `${posProductItemsCount + voucherSoldPcs} pcs / ${digitalSuccess.length} trx`,
        totalGrossRevenue,
        isOwner ? totalCOGS : 0,
        isOwner ? totalGrossProfit : 0,
        `${grossMarginPercent.toFixed(1)}%`,
      ],
      [],
      ["2. RINCIAN BEBAN & BIAYA OPERASIONAL (OPEX)"],
      ["No", "Kategori Beban", "Keterangan", "Total Pengeluaran (Rp)"],
      [1, "Listrik & Utilitas", "Tagihan listrik PLN, token, air", expenseCategoryMap.ELECTRICITY || 0],
      [2, "Internet & Komunikasi", "Tagihan internet wifi toko & pulsa", expenseCategoryMap.INTERNET || 0],
      [3, "Sewa Tempat / Ruko", "Biaya sewa toko / kios", expenseCategoryMap.RENT || 0],
      [4, "Operasional Harian", "ATK, plastik kresek, konsumsi harian, maintenance", expenseCategoryMap.OPERATIONAL || 0],
      [5, "Transportasi & Logistik", "Bensin, ongkos kirim pasokan / distributor", expenseCategoryMap.TRANSPORT || 0],
      [6, "Gaji & Upah Karyawan", "Gaji kasir, bonus pencapaian", expenseCategoryMap.SALARY || 0],
      [7, "Beban Lain-lain", "Pengeluaran tidak terduga", expenseCategoryMap.OTHER || 0],
      ["", "TOTAL BEBAN OPERASIONAL", "", totalExpenses],
      [],
      ["3. HASIL AKHIR KEUANGAN BERSIH (NET INCOME)"],
      ["Indikator Keuangan", "Nilai (Rp / %)", "Keterangan"],
      ["Total Omset Penjualan Kotor", totalGrossRevenue, "Total uang masuk dari seluruh lini usaha"],
      ["Total Harga Pokok Penjualan (HPP)", isOwner ? totalCOGS : "Terkunci (RBAC)", "Biaya modal barang & voucher fisik yang terjual"],
      ["Total Laba Kotor Usaha", isOwner ? totalGrossProfit : "Terkunci (RBAC)", "Laba sebelum dikurangi beban operasional"],
      ["Total Pengeluaran Operasional", totalExpenses, "Biaya operasional toko selama periode"],
      ["LABA BERSIH USAHA (NET PROFIT)", isOwner ? netProfit : "Terkunci (RBAC)", isOwner ? (netProfit >= 0 ? "Surplus / Profit Bersih" : "Defisit / Rugi") : "Terkunci"],
      ["Persentase Margin Bersih (Net Margin)", isOwner ? `${netMarginPercent.toFixed(1)}%` : "Terkunci", "Persentase laba bersih dari total omset"],
      ["Rasio Efisiensi Beban (Opex Ratio)", isOwner ? `${opexRatioPercent.toFixed(1)}%` : "Terkunci", "Persentase beban operasional terhadap laba kotor"],
    ];

    const wsPnl = XLSX.utils.aoa_to_sheet(pnlRows);
    wsPnl["!cols"] = [
      { wch: 6 },
      { wch: 38 },
      { wch: 22 },
      { wch: 22 },
      { wch: 25 },
      { wch: 22 },
      { wch: 18 },
    ];
    XLSX.utils.book_append_sheet(wb, wsPnl, "Ringkasan Laba Rugi");

    // ==========================================
    // SHEET 2: RETAIL & AKSESORIS
    // ==========================================
    const retailHeader: any[] = [
      ["CHICHA MOBILE - DETAIL TRANSAKSI PENJUALAN RETAIL & AKSESORIS"],
      [`Periode: ${periodStr}`],
      [],
      [
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
      ],
      ...retailItemsRows,
      [],
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
    ];

    const wsRetail = XLSX.utils.aoa_to_sheet(retailHeader);
    wsRetail["!cols"] = [
      { wch: 6 },
      { wch: 18 },
      { wch: 18 },
      { wch: 14 },
      { wch: 18 },
      { wch: 32 },
      { wch: 16 },
      { wch: 10 },
      { wch: 16 },
      { wch: 16 },
      { wch: 18 },
      { wch: 16 },
      { wch: 14 },
      { wch: 12 },
      { wch: 25 },
    ];
    XLSX.utils.book_append_sheet(wb, wsRetail, "Retail & Aksesoris");

    // ==========================================
    // SHEET 3: PENJUALAN VOUCHER FISIK
    // ==========================================
    const voucherHeader: any[] = [
      ["CHICHA MOBILE - DETAIL TRANSAKSI PENJUALAN VOUCHER FISIK"],
      [`Periode: ${periodStr}`],
      [],
      [
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
      ],
      ...voucherItemsRows,
      [],
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
    ];

    const wsVoucher = XLSX.utils.aoa_to_sheet(voucherHeader);
    wsVoucher["!cols"] = [
      { wch: 6 },
      { wch: 18 },
      { wch: 18 },
      { wch: 20 },
      { wch: 14 },
      { wch: 14 },
      { wch: 12 },
      { wch: 28 },
      { wch: 10 },
      { wch: 16 },
      { wch: 16 },
      { wch: 18 },
      { wch: 16 },
      { wch: 14 },
      { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, wsVoucher, "Voucher Fisik");

    // ==========================================
    // SHEET 4: TRANSAKSI DIGITAL PPOB
    // ==========================================
    const digitalRows: any[] = digitalTrx.map((t, i) => {
      const dateStr = new Date(t.createdAt).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }) + " " + new Date(t.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

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

    const digitalSheetContent: any[] = [
      ["CHICHA MOBILE - DETAIL TRANSAKSI PRODUK DIGITAL & PPOB"],
      [`Periode: ${periodStr}`],
      [],
      [
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
      ],
      ...digitalRows,
      [],
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
    ];

    const wsDigital = XLSX.utils.aoa_to_sheet(digitalSheetContent);
    wsDigital["!cols"] = [
      { wch: 6 },
      { wch: 18 },
      { wch: 20 },
      { wch: 14 },
      { wch: 12 },
      { wch: 14 },
      { wch: 28 },
      { wch: 20 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 20 },
    ];
    XLSX.utils.book_append_sheet(wb, wsDigital, "Produk Digital PPOB");

    // ==========================================
    // SHEET 5: BEBAN OPERASIONAL
    // ==========================================
    const categoryLabels: Record<string, string> = {
      ELECTRICITY: "Listrik & PLN",
      INTERNET: "Internet & Wifi",
      RENT: "Sewa Tempat / Ruko",
      OPERATIONAL: "Operasional Toko",
      TRANSPORT: "Transportasi & Kurir",
      SALARY: "Gaji & Upah",
      OTHER: "Lain-lain",
    };

    const expenseRows: any[] = expenses.map((e, i) => {
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

    const expenseSheetContent: any[] = [
      ["CHICHA MOBILE - DAFTAR PENGELUARAN & BEBAN OPERASIONAL"],
      [`Periode: ${periodStr}`],
      [],
      [
        "No",
        "Tanggal Pengeluaran",
        "Kategori Beban",
        "Keterangan / Deskripsi",
        "Jumlah Biaya (Rp)",
        "Dicatat Oleh",
        "Catatan Tambahan",
      ],
      ...expenseRows,
      [],
      ["", "TOTAL PENGELUARAN OPERASIONAL", "", "", totalExpenses, "", ""],
    ];

    const wsExpense = XLSX.utils.aoa_to_sheet(expenseSheetContent);
    wsExpense["!cols"] = [
      { wch: 6 },
      { wch: 18 },
      { wch: 22 },
      { wch: 35 },
      { wch: 20 },
      { wch: 16 },
      { wch: 25 },
    ];
    XLSX.utils.book_append_sheet(wb, wsExpense, "Beban Operasional");

    // ==========================================
    // SHEET 6: PIUTANG & NOTA
    // ==========================================
    const receivableRows: any[] = receivables.map((r, i) => {
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

    const unpaidTotal = receivables
      .filter((r) => r.paymentStatus !== "PAID")
      .reduce((sum, r) => sum + r.finalAmount, 0);

    const receivableSheetContent: any[] = [
      ["CHICHA MOBILE - DAFTAR PIUTANG & NOTA PELANGGAN"],
      [`Waktu Penarikan Data: ${printTimeStr}`],
      [],
      [
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
      ],
      ...receivableRows,
      [],
      ["", "TOTAL PIUTANG BELUM LUNAS", "", "", "", "", "", unpaidTotal, "", "", "", ""],
    ];

    const wsReceivables = XLSX.utils.aoa_to_sheet(receivableSheetContent);
    wsReceivables["!cols"] = [
      { wch: 6 },
      { wch: 16 },
      { wch: 18 },
      { wch: 22 },
      { wch: 16 },
      { wch: 14 },
      { wch: 14 },
      { wch: 18 },
      { wch: 16 },
      { wch: 14 },
      { wch: 16 },
      { wch: 25 },
    ];
    XLSX.utils.book_append_sheet(wb, wsReceivables, "Piutang & Nota");

    // ==========================================
    // SHEET 7: INVENTARIS STOK VOUCHER (38 STANDAR)
    // ==========================================
    let totalStockPcs = 0;
    let totalAssetValue = 0;

    const voucherCatalogRows: any[] = vouchers.map((v, i) => {
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

    const voucherCatalogSheetContent: any[] = [
      ["CHICHA MOBILE - KATALOG & INVENTARIS STOK VOUCHER FISIK"],
      [`Posisi Stok Per: ${printTimeStr}`],
      [],
      [
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
      ],
      ...voucherCatalogRows,
      [],
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
    ];

    const wsCatalog = XLSX.utils.aoa_to_sheet(voucherCatalogSheetContent);
    wsCatalog["!cols"] = [
      { wch: 6 },
      { wch: 16 },
      { wch: 12 },
      { wch: 30 },
      { wch: 14 },
      { wch: 14 },
      { wch: 18 },
      { wch: 16 },
      { wch: 16 },
      { wch: 24 },
    ];
    XLSX.utils.book_append_sheet(wb, wsCatalog, "Stok Voucher Fisik");

    // Generate binary buffer
    const excelBuffer = XLSX.write(wb, {
      bookType: "xlsx",
      type: "buffer",
    });

    const filename = `Laporan_ChiCha_Mobile_${startDateParam || "Bulan_Ini"}_sd_${endDateParam || "Sekarang"}.xlsx`.replace(/\s+/g, "_");

    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": excelBuffer.length.toString(),
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

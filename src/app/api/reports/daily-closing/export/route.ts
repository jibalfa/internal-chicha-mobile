import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";
import { getWIBDayRange, getWIBDateString } from "@/lib/wibTime";
import { classifySaleItem } from "@/lib/itemClassification";

const C = {
  navyHeader: "FF1E3A8A",
  royalBlueHeader: "FF2563EB",
  subtotalBg: "FFEFF6FF",
  grandTotalBg: "FFFEF3C7",
  pinkBg: "FFFEE2E2",
  greenBg: "FFDCFCE7",
  blueCashBg: "FFE0F2FE",
  white: "FFFFFFFF",
  slateText: "FF1E293B",
  borderLight: "FFE2E8F0",
  borderDark: "FF94A3B8",
};

const NUM_FMT_RP = '"Rp "#,##0;[Red]-"Rp "#,##0;"Rp "0';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    let dateParam = searchParams.get("date");
    if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      dateParam = getWIBDateString();
    }
    const { startOfDay, endOfDay } = getWIBDayRange(dateParam);

    // 0. Fetch All Active Technicians from Master Data
    const allActiveTechs = await (prisma as any).technician.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });

    // 1. Fetch Sales
    const sales = await prisma.sale.findMany({
      where: {
        paymentStatus: { not: "CANCELLED" },
        OR: [
          { createdAt: { gte: startOfDay, lte: endOfDay } },
          {
            paymentMethod: "CREDIT",
            paymentStatus: "PAID",
            paidAt: { gte: startOfDay, lte: endOfDay },
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
      },
      orderBy: { createdAt: "asc" },
    });

    let voucherAquaTisuRevenue = 0;
    let aksesorisRevenue = 0;

    for (const sale of sales) {
      if (sale.createdAt >= startOfDay && sale.createdAt <= endOfDay) {
        for (const item of sale.items) {
          const group = classifySaleItem({
            itemType: item.itemType,
            itemName: item.itemName,
            productType: item.product?.type,
            categoryName: item.product?.category?.name,
          });
          if (group === "VOUCHER_AQUA_TISU") {
            voucherAquaTisuRevenue += item.subtotal;
          } else {
            aksesorisRevenue += item.subtotal;
          }
        }
      }
    }

    // 2. Fetch Digital Transactions (PPOB / Pulsa)
    const digitalTransactions = await prisma.digitalTransaction.findMany({
      where: {
        status: "SUCCESS",
        createdAt: { gte: startOfDay, lte: endOfDay },
      },
    });
    const pulsaRevenue = digitalTransactions.reduce((sum, d) => sum + d.sellingPrice, 0);

    // 3. Fetch Service Records
    const services = await (prisma as any).serviceRecord.findMany({
      where: {
        status: "COMPLETED",
        paymentStatus: "PAID",
        OR: [
          { completedAt: { gte: startOfDay, lte: endOfDay } },
          { completedAt: null, createdAt: { gte: startOfDay, lte: endOfDay } },
        ],
      },
      include: { technician: true },
      orderBy: { completedAt: "asc" },
    });

    let serviceHpRevenue = 0;
    const techMap = new Map<
      string,
      {
        technicianId: string;
        technicianName: string;
        defaultPercentage: number;
        services: Array<{
          no: number;
          deviceAndIssue: string;
          serviceFee: number;
          notes: string;
        }>;
        totalServiceFee: number;
        totalTechnicianFee: number;
        totalStoreProfit: number;
      }
    >();

    for (const tech of allActiveTechs) {
      techMap.set(tech.id, {
        technicianId: tech.id,
        technicianName: tech.name,
        defaultPercentage: tech.defaultPercentage ?? 50,
        services: [],
        totalServiceFee: 0,
        totalTechnicianFee: 0,
        totalStoreProfit: 0,
      });
    }

    for (const s of services) {
      serviceHpRevenue += s.serviceFee || 0;
      const tId = s.technician?.id || "unknown";
      const tName = s.technician?.name || "Teknisi";
      const tDefaultPercentage = s.technician?.defaultPercentage ?? 50;

      if (!techMap.has(tId)) {
        techMap.set(tId, {
          technicianId: tId,
          technicianName: tName,
          defaultPercentage: tDefaultPercentage,
          services: [],
          totalServiceFee: 0,
          totalTechnicianFee: 0,
          totalStoreProfit: 0,
        });
      }

      const tGroup = techMap.get(tId)!;
      tGroup.services.push({
        no: tGroup.services.length + 1,
        deviceAndIssue: `${s.deviceType || ""} - ${s.issue || ""}`.trim().replace(/^-|-$/, ""),
        serviceFee: s.serviceFee || 0,
        notes: s.notes || s.serviceNumber || "",
      });
      tGroup.totalServiceFee += s.serviceFee || 0;
      tGroup.totalTechnicianFee += s.technicianFee || 0;
      tGroup.totalStoreProfit += s.storeProfit || 0;
    }

    const techList = Array.from(techMap.values());
    const totalHakKomisiTeknisi = techList.reduce((sum, t) => sum + t.totalTechnicianFee, 0);
    const totalBagianTokoServis = techList.reduce((sum, t) => sum + t.totalStoreProfit, 0);

    // 4. Fetch Expenses
    const expenses = await prisma.expense.findMany({
      where: { date: { gte: startOfDay, lte: endOfDay } },
      orderBy: { date: "asc" },
    });
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    // Subtotals & Totals
    const subtotalPulsaVoucherAquaTisu = pulsaRevenue + voucherAquaTisuRevenue;
    const subtotalAksesoris = aksesorisRevenue;
    const subtotalServiceHp = serviceHpRevenue;
    const totalOmzetHarian = subtotalPulsaVoucherAquaTisu + subtotalAksesoris + subtotalServiceHp;
    const sisaUangBersihToko = totalOmzetHarian - totalHakKomisiTeknisi - totalExpenses;

    // Build Excel Workbook
    const wb = new ExcelJS.Workbook();
    wb.creator = "ChiCha Mobile System";
    wb.lastModifiedBy = session.name || "Owner";
    wb.created = new Date();

    const ws = wb.addWorksheet("Rekap Harian & Setoran", {
      views: [{ showGridLines: true }],
    });

    // Column Widths
    ws.columns = [
      { width: 8 },  // Col A: No
      { width: 38 }, // Col B: Deskripsi / Sumber / Komponen
      { width: 24 }, // Col C: Jumlah Masuk / Hak Komisi / Nominal
      { width: 24 }, // Col D: TOTAL / Bagian Toko / Catatan
    ];

    let r = 2;

    // Helper: Style Title Section
    const addSectionBanner = (title: string, endCol = 4) => {
      ws.mergeCells(r, 1, r, endCol);
      const cell = ws.getCell(r, 1);
      cell.value = title;
      cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: C.white } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.navyHeader } };
      cell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
      ws.getRow(r).height = 24;
      r++;
    };

    // Helper: Table Header Row
    const addColHeaders = (headers: string[], bgColor = C.royalBlueHeader) => {
      const row = ws.getRow(r);
      row.height = 22;
      headers.forEach((h, idx) => {
        const cell = row.getCell(idx + 1);
        cell.value = h;
        cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: C.white } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
        cell.alignment = {
          horizontal: idx === 0 ? "center" : idx === 1 ? "left" : "right",
          vertical: "middle",
        };
        cell.border = {
          top: { style: "thin", color: { argb: C.borderDark } },
          bottom: { style: "thin", color: { argb: C.borderDark } },
        };
      });
      r++;
    };

    // ==========================================
    // BAGIAN 1: REKAP PENJUALAN & SERVICE HARIAN
    // ==========================================
    addSectionBanner("BAGIAN 1: REKAP PENJUALAN & SERVICE HARIAN");
    addColHeaders(["No", "Sumber Pemasukan", "Jumlah Masuk (Rp)", "TOTAL"]);

    // Row 1: Pulsa
    let row = ws.getRow(r++);
    row.getCell(1).value = 1;
    row.getCell(1).alignment = { horizontal: "center" };
    row.getCell(2).value = "Penjualan Pulsa";
    row.getCell(3).value = pulsaRevenue;
    row.getCell(3).numFmt = NUM_FMT_RP;

    // Row 2: Voucher / Aqua / Tisu
    row = ws.getRow(r++);
    row.getCell(1).value = 2;
    row.getCell(1).alignment = { horizontal: "center" };
    row.getCell(2).value = "Penjualan Voucher / Aqua / Tisu";
    row.getCell(3).value = voucherAquaTisuRevenue;
    row.getCell(3).numFmt = NUM_FMT_RP;

    // Subtotal 1
    row = ws.getRow(r++);
    row.getCell(1).value = "-";
    row.getCell(1).alignment = { horizontal: "center" };
    row.getCell(2).value = "Subtotal Pulsa & Voucher / Aqua / Tisu";
    row.getCell(2).font = { name: "Calibri", bold: true };
    row.getCell(4).value = subtotalPulsaVoucherAquaTisu;
    row.getCell(4).numFmt = NUM_FMT_RP;
    row.getCell(4).font = { name: "Calibri", bold: true };
    [1, 2, 3, 4].forEach((c) => {
      row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.subtotalBg } };
    });

    // Row 3: Aksesoris (Acc)
    row = ws.getRow(r++);
    row.getCell(1).value = 3;
    row.getCell(1).alignment = { horizontal: "center" };
    row.getCell(2).value = "Penjualan Aksesoris (Acc)";
    row.getCell(3).value = aksesorisRevenue;
    row.getCell(3).numFmt = NUM_FMT_RP;

    // Subtotal 2
    row = ws.getRow(r++);
    row.getCell(1).value = "-";
    row.getCell(1).alignment = { horizontal: "center" };
    row.getCell(2).value = "Subtotal Penjualan Aksesoris (Acc)";
    row.getCell(2).font = { name: "Calibri", bold: true };
    row.getCell(4).value = subtotalAksesoris;
    row.getCell(4).numFmt = NUM_FMT_RP;
    row.getCell(4).font = { name: "Calibri", bold: true };
    [1, 2, 3, 4].forEach((c) => {
      row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.subtotalBg } };
    });

    // Row 4: Service HP
    row = ws.getRow(r++);
    row.getCell(1).value = 4;
    row.getCell(1).alignment = { horizontal: "center" };
    row.getCell(2).value = "Service HP";
    row.getCell(3).value = serviceHpRevenue;
    row.getCell(3).numFmt = NUM_FMT_RP;

    // Subtotal 3
    row = ws.getRow(r++);
    row.getCell(1).value = "-";
    row.getCell(1).alignment = { horizontal: "center" };
    row.getCell(2).value = "Subtotal Service HP (Cash + TF/QRIS)";
    row.getCell(2).font = { name: "Calibri", bold: true };
    row.getCell(4).value = subtotalServiceHp;
    row.getCell(4).numFmt = NUM_FMT_RP;
    row.getCell(4).font = { name: "Calibri", bold: true };
    [1, 2, 3, 4].forEach((c) => {
      row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.subtotalBg } };
    });

    // Grand Total Omzet
    row = ws.getRow(r++);
    row.height = 24;
    row.getCell(1).value = "★";
    row.getCell(1).alignment = { horizontal: "center" };
    row.getCell(2).value = "TOTAL OMZET MASUK HARIAN";
    row.getCell(2).font = { name: "Calibri", bold: true };
    row.getCell(4).value = totalOmzetHarian;
    row.getCell(4).numFmt = NUM_FMT_RP;
    row.getCell(4).font = { name: "Calibri", bold: true, size: 11 };
    [1, 2, 3, 4].forEach((c) => {
      row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.grandTotalBg } };
    });

    r += 2; // Spacing

    // ==========================================
    // BAGIAN 2A: PENGATURAN PERSENTASE KOMISI TEKNISI
    // ==========================================
    addSectionBanner("BAGIAN 2A: PENGATURAN PERSENTASE KOMISI TEKNISI");
    addColHeaders(["No", "Nama Teknisi", "Persentase Komisi Teknisi", "Porsi Toko"]);

    techList.forEach((tech, idx) => {
      const commPct = tech.totalServiceFee > 0 ? (tech.totalTechnicianFee / tech.totalServiceFee) : (tech.defaultPercentage / 100);
      const storePct = 1 - commPct;
      row = ws.getRow(r++);
      row.getCell(1).value = idx + 1;
      row.getCell(1).alignment = { horizontal: "center" };
      row.getCell(2).value = tech.technicianName;
      row.getCell(3).value = commPct;
      row.getCell(3).numFmt = "0%";
      row.getCell(3).alignment = { horizontal: "right" };
      row.getCell(4).value = storePct;
      row.getCell(4).numFmt = "0%";
      row.getCell(4).alignment = { horizontal: "right" };
    });

    const avgComm = serviceHpRevenue > 0 ? totalHakKomisiTeknisi / serviceHpRevenue : 0.5;
    row = ws.getRow(r++);
    row.getCell(1).value = "•";
    row.getCell(1).alignment = { horizontal: "center" };
    row.getCell(2).value = "Rata-rata Bagi Hasil Komisi";
    row.getCell(2).font = { name: "Calibri", bold: true };
    row.getCell(3).value = avgComm;
    row.getCell(3).numFmt = "0%";
    row.getCell(3).font = { name: "Calibri", bold: true };
    row.getCell(4).value = 1 - avgComm;
    row.getCell(4).numFmt = "0%";
    row.getCell(4).font = { name: "Calibri", bold: true };

    r += 2; // Spacing

    // ==========================================
    // BAGIAN 2B: REKAP KOMISI & BAGI HASIL TEKNISI
    // ==========================================
    addSectionBanner("BAGIAN 2B: REKAP KOMISI & BAGI HASIL TEKNISI");
    addColHeaders(["No", "Nama Teknisi", "Hak Komisi Teknisi (Rp)", "Bagian Toko (Rp)"]);

    techList.forEach((tech, idx) => {
      row = ws.getRow(r++);
      row.getCell(1).value = idx + 1;
      row.getCell(1).alignment = { horizontal: "center" };
      row.getCell(2).value = tech.technicianName;
      row.getCell(3).value = tech.totalTechnicianFee;
      row.getCell(3).numFmt = NUM_FMT_RP;
      row.getCell(4).value = tech.totalStoreProfit;
      row.getCell(4).numFmt = NUM_FMT_RP;
    });

    row = ws.getRow(r++);
    row.height = 22;
    row.getCell(1).value = "TOTAL";
    row.getCell(1).alignment = { horizontal: "center" };
    row.getCell(2).value = "TOTAL KOMISI & BAGI HASIL SERVIS";
    row.getCell(2).font = { name: "Calibri", bold: true };
    row.getCell(3).value = totalHakKomisiTeknisi;
    row.getCell(3).numFmt = NUM_FMT_RP;
    row.getCell(3).font = { name: "Calibri", bold: true };
    row.getCell(4).value = totalBagianTokoServis;
    row.getCell(4).numFmt = NUM_FMT_RP;
    row.getCell(4).font = { name: "Calibri", bold: true };
    [1, 2, 3, 4].forEach((c) => {
      row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.subtotalBg } };
    });

    r += 2; // Spacing

    // ==========================================
    // BAGIAN 2C: RINCIAN SERVIS HARIAN MASING-MASING TEKNISI
    // ==========================================
    addSectionBanner("BAGIAN 2C: RINCIAN SERVIS HARIAN MASING-MASING TEKNISI");

    const techsWithServices = techList.filter((t) => t.services.length > 0);
    if (techsWithServices.length === 0) {
      row = ws.getRow(r++);
      ws.mergeCells(r - 1, 1, r - 1, 4);
      const emptyCell = ws.getCell(r - 1, 1);
      emptyCell.value = "Tidak ada rincian pengerjaan servis pada tanggal ini";
      emptyCell.font = { name: "Calibri", italic: true, color: { argb: "FF64748B" } };
      emptyCell.alignment = { horizontal: "center" };
    } else {
      techsWithServices.forEach((tech, tIdx) => {
        // Subheader Teknisi
        ws.mergeCells(r, 1, r, 4);
        const subCell = ws.getCell(r, 1);
        subCell.value = `${tIdx + 1}. RINCIAN SERVIS - ${tech.technicianName.toUpperCase()}`;
        subCell.font = { name: "Calibri", size: 10, bold: true, color: { argb: C.navyHeader } };
        subCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.subtotalBg } };
        r++;

        addColHeaders(["No", "Tipe HP & Kerusakan", "Biaya Jasa Servis (Rp)", "Catatan / Nota"]);

        tech.services.forEach((item) => {
          row = ws.getRow(r++);
          row.getCell(1).value = item.no;
          row.getCell(1).alignment = { horizontal: "center" };
          row.getCell(2).value = item.deviceAndIssue;
          row.getCell(3).value = item.serviceFee;
          row.getCell(3).numFmt = NUM_FMT_RP;
          row.getCell(4).value = item.notes;
        });

        row = ws.getRow(r++);
        row.getCell(1).value = "";
        row.getCell(2).value = "TOTAL";
        row.getCell(2).font = { name: "Calibri", bold: true };
        row.getCell(2).alignment = { horizontal: "right" };
        row.getCell(3).value = tech.totalServiceFee;
        row.getCell(3).numFmt = NUM_FMT_RP;
        row.getCell(3).font = { name: "Calibri", bold: true };
        r++;
      });
    }

    r++; // Spacing

    // ==========================================
    // BAGIAN 3: UANG KELUAR (PENGELUARAN HARIAN)
    // ==========================================
    addSectionBanner("BAGIAN 3: UANG KELUAR (PENGELUARAN HARIAN)");
    addColHeaders(["No", "Keterangan Pengeluaran", "Nominal (Rp)", "Kategori"]);

    expenses.forEach((exp, idx) => {
      row = ws.getRow(r++);
      row.getCell(1).value = idx + 1;
      row.getCell(1).alignment = { horizontal: "center" };
      row.getCell(2).value = exp.description.toUpperCase();
      row.getCell(3).value = exp.amount;
      row.getCell(3).numFmt = NUM_FMT_RP;
      row.getCell(4).value = exp.category;
    });

    row = ws.getRow(r++);
    row.height = 22;
    row.getCell(1).value = "";
    row.getCell(2).value = "TOTAL";
    row.getCell(2).font = { name: "Calibri", bold: true };
    row.getCell(2).alignment = { horizontal: "right" };
    row.getCell(3).value = totalExpenses;
    row.getCell(3).numFmt = NUM_FMT_RP;
    row.getCell(3).font = { name: "Calibri", bold: true };
    [1, 2, 3, 4].forEach((c) => {
      row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.pinkBg } };
    });

    r += 2; // Spacing

    // ==========================================
    // BAGIAN 4: RINGKASAN AKHIR KAS HARIAN (SETORAN HARI INI)
    // ==========================================
    addSectionBanner("BAGIAN 4: RINGKASAN AKHIR KAS HARIAN (SETORAN HARI INI)");
    addColHeaders(["No", "Komponen Rekapitulasi Kas", "Jumlah (Rp)", "Keterangan"]);

    // Row 1
    row = ws.getRow(r++);
    row.getCell(1).value = 1;
    row.getCell(1).alignment = { horizontal: "center" };
    row.getCell(2).value = "Total Pemasukan";
    row.getCell(3).value = totalOmzetHarian;
    row.getCell(3).numFmt = NUM_FMT_RP;

    // Row 3
    row = ws.getRow(r++);
    row.getCell(1).value = 3;
    row.getCell(1).alignment = { horizontal: "center" };
    row.getCell(2).value = "TOTAL SEMUA PEMASUKAN KOTOR (OMZET)";
    row.getCell(2).font = { name: "Calibri", bold: true };
    row.getCell(3).value = totalOmzetHarian;
    row.getCell(3).numFmt = NUM_FMT_RP;
    row.getCell(3).font = { name: "Calibri", bold: true };

    // Row 4
    row = ws.getRow(r++);
    row.getCell(1).value = 4;
    row.getCell(1).alignment = { horizontal: "center" };
    row.getCell(2).value = "Dikurangi: Total Hak Komisi Teknisi";
    row.getCell(3).value = -totalHakKomisiTeknisi;
    row.getCell(3).numFmt = NUM_FMT_RP;

    // Row 5
    row = ws.getRow(r++);
    row.getCell(1).value = 5;
    row.getCell(1).alignment = { horizontal: "center" };
    row.getCell(2).value = "Dikurangi: Total Uang Keluar (Operasional)";
    row.getCell(3).value = -totalExpenses;
    row.getCell(3).numFmt = NUM_FMT_RP;

    // Row Star: Sisa Bersih Toko
    row = ws.getRow(r++);
    row.height = 24;
    row.getCell(1).value = "★";
    row.getCell(1).alignment = { horizontal: "center" };
    row.getCell(2).value = "SISA UANG BERSIH HARIAN TOKO";
    row.getCell(2).font = { name: "Calibri", bold: true, size: 11 };
    row.getCell(3).value = sisaUangBersihToko;
    row.getCell(3).numFmt = NUM_FMT_RP;
    row.getCell(3).font = { name: "Calibri", bold: true, size: 11 };
    [1, 2, 3, 4].forEach((c) => {
      row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.greenBg } };
    });

    // Row Diamond: Estimasi Fisik Kas Laci (Setoran)
    row = ws.getRow(r++);
    row.height = 26;
    row.getCell(1).value = "◆";
    row.getCell(1).alignment = { horizontal: "center" };
    row.getCell(2).value = "ESTIMASI FISIK KAS TUNAI DI LACI (SETORAN)";
    row.getCell(2).font = { name: "Calibri", bold: true, size: 11 };
    row.getCell(3).value = sisaUangBersihToko;
    row.getCell(3).numFmt = NUM_FMT_RP;
    row.getCell(3).font = { name: "Calibri", bold: true, size: 11 };
    [1, 2, 3, 4].forEach((c) => {
      row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.blueCashBg } };
    });

    const buffer = await wb.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Rekap_Harian_ChiCha_Mobile_${dateParam}.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error("GET Daily Closing Excel Export Error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal mengekspor file Excel" },
      { status: 500 }
    );
  }
}


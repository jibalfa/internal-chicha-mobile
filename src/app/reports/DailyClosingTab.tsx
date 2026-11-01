"use client";

import React, { useState, useEffect } from "react";
import {
  Printer,
  Download,
  Calendar,
  RefreshCw,
  Coins,
  Wrench,
  Receipt,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Banknote,
  Smartphone,
  Tag,
  Layers,
  ChevronRight,
} from "lucide-react";
import { formatRupiah } from "@/lib/calculations";

interface DailyClosingData {
  date: string;
  formattedDate: string;
  bagian1: {
    pulsaRevenue: number;
    voucherAquaTisuRevenue: number;
    subtotalPulsaVoucherAquaTisu: number;
    aksesorisRevenue: number;
    subtotalAksesoris: number;
    serviceHpRevenue: number;
    subtotalServiceHp: number;
    totalOmzetHarian: number;
  };
  bagian2A: {
    technicians: Array<{
      no: number;
      technicianId: string;
      technicianName: string;
      commissionPercentage: number;
      storePercentage: number;
    }>;
    averageCommissionPercentage: number;
    averageStorePercentage: number;
  };
  bagian2B: {
    technicians: Array<{
      no: number;
      technicianId: string;
      technicianName: string;
      commissionFee: number;
      storeProfit: number;
    }>;
    totalHakKomisiTeknisi: number;
    totalBagianToko: number;
  };
  bagian2C: Array<{
    no: number;
    technicianId: string;
    technicianName: string;
    services: Array<{
      no: number;
      deviceAndIssue: string;
      serviceFee: number;
      notes: string;
    }>;
    total: number;
  }>;
  bagian3: {
    expenses: Array<{
      no: number;
      description: string;
      amount: number;
      category: string;
    }>;
    totalExpenses: number;
  };
  bagian4: {
    totalOmzetHarian: number;
    totalHakKomisiTeknisi: number;
    totalExpenses: number;
    sisaUangBersihToko: number;
    estimasiFisikKasLaci: number;
    cashDrawerReconciliation?: {
      totalCashIn: number;
      totalNonCash: number;
      estimasiFisikTunaiLaci: number;
    };
  };
}

export default function DailyClosingTab() {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    // Current WIB Date
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(new Date());
  });

  const [data, setData] = useState<DailyClosingData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [exportLoading, setExportLoading] = useState<boolean>(false);

  const fetchDailyClosing = async (dateStr: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/daily-closing?date=${encodeURIComponent(dateStr)}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal memuat rekap harian");
      }
      setData(json.data);
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan saat memuat data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDailyClosing(selectedDate);
  }, [selectedDate]);

  const handleShortcutDate = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    setSelectedDate(formatter.format(d));
  };

  const handleDownloadExcel = async () => {
    setExportLoading(true);
    try {
      const res = await fetch(`/api/reports/daily-closing/export?date=${encodeURIComponent(selectedDate)}`);
      if (!res.ok) throw new Error("Gagal mengunduh file Excel");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Rekap_Harian_ChiCha_Mobile_${selectedDate}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || "Gagal mengekspor file Excel");
    } finally {
      setExportLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Filter & Action Bar (Hidden in Print) */}
      <div className="print:hidden bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mr-1">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span>Pilih Tanggal Rekap:</span>
          </span>

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <button
            onClick={() => handleShortcutDate(0)}
            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl transition-all border border-blue-200"
          >
            Hari Ini
          </button>
          <button
            onClick={() => handleShortcutDate(-1)}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all"
          >
            Kemarin
          </button>
          <button
            onClick={() => handleShortcutDate(-2)}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all"
          >
            H-2
          </button>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchDailyClosing(selectedDate)}
            disabled={loading}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
            title="Refresh Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Segarkan</span>
          </button>

          <button
            onClick={handleDownloadExcel}
            disabled={exportLoading || loading}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Download className="w-4 h-4" />
            <span>{exportLoading ? "Mengunduh..." : "Download Excel"}</span>
          </button>

          <button
            onClick={handlePrint}
            disabled={loading}
            className="px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Rekap</span>
          </button>
        </div>
      </div>

      {/* Main Report Container */}
      {loading ? (
        <div className="bg-white rounded-3xl p-12 border border-slate-200/80 shadow-sm text-center">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-600">Menyusun rekapitulasi harian toko...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 rounded-3xl p-6 text-center text-rose-700 space-y-2">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
          <p className="font-bold text-base">Gagal Memuat Laporan</p>
          <p className="text-xs text-rose-600">{error}</p>
        </div>
      ) : !data ? null : (
        <div className="bg-white rounded-3xl border border-slate-300 shadow-sm overflow-hidden p-4 sm:p-7 space-y-7 print:p-0 print:border-none print:shadow-none">
          {/* Header Title Banner */}
          <div className="border-b-2 border-blue-900 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-blue-950 uppercase tracking-tight flex items-center gap-2">
                <span>CHICHA MOBILE</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-300">
                  REKAP HARIAN RESMI
                </span>
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Laporan Penjualan, Komisi Teknisi, Pengeluaran & Estimasi Kas Laci (WIB)
              </p>
            </div>
            <div className="text-right">
              <span className="text-sm font-extrabold text-blue-900 block font-mono">
                {data.formattedDate}
              </span>
              <span className="text-[11px] text-slate-400">Periode 00:00:00 - 23:59:59 WIB</span>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* BAGIAN 1: REKAP PENJUALAN & SERVICE HARIAN                                */}
          {/* ========================================================================= */}
          <div className="space-y-2">
            <div className="bg-[#1E3A8A] text-white px-4 py-2.5 rounded-t-xl font-black text-sm tracking-wide flex items-center justify-between">
              <span>BAGIAN 1: REKAP PENJUALAN & SERVICE HARIAN</span>
              <span className="text-xs font-normal opacity-80 font-mono">치차 모바일 (ChiCha Mobile)</span>
            </div>

            <div className="overflow-x-auto border border-blue-200 rounded-b-xl">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-blue-600 text-white font-bold divide-x divide-blue-500">
                    <th className="py-2.5 px-3 text-center w-12">No</th>
                    <th className="py-2.5 px-4 text-left">Sumber Pemasukan</th>
                    <th className="py-2.5 px-4 text-right w-44">Jumlah Masuk (Rp)</th>
                    <th className="py-2.5 px-4 text-right w-44">TOTAL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {/* Row 1: Pulsa */}
                  <tr className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 text-center font-bold text-slate-600">1</td>
                    <td className="py-2.5 px-4 font-semibold text-slate-800">Penjualan Pulsa</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                      {formatRupiah(data.bagian1.pulsaRevenue)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-400">-</td>
                  </tr>

                  {/* Row 2: Voucher / Aqua / Tisu */}
                  <tr className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 text-center font-bold text-slate-600">2</td>
                    <td className="py-2.5 px-4 font-semibold text-slate-800">
                      Penjualan Voucher / Aqua / Tisu
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                      {formatRupiah(data.bagian1.voucherAquaTisuRevenue)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-400">-</td>
                  </tr>

                  {/* Subtotal 1 */}
                  <tr className="bg-blue-50/70 font-bold border-y border-blue-200">
                    <td className="py-2.5 px-3 text-center text-blue-900">-</td>
                    <td className="py-2.5 px-4 text-blue-900">Subtotal Pulsa & Voucher / Aqua / Tisu</td>
                    <td className="py-2.5 px-4 text-right text-blue-400">-</td>
                    <td className="py-2.5 px-4 text-right font-mono text-blue-950 font-black">
                      {formatRupiah(data.bagian1.subtotalPulsaVoucherAquaTisu)}
                    </td>
                  </tr>

                  {/* Row 3: Aksesoris (Acc) */}
                  <tr className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 text-center font-bold text-slate-600">3</td>
                    <td className="py-2.5 px-4 font-semibold text-slate-800">
                      Penjualan Aksesoris (Acc){" "}
                      <span className="text-[10px] text-slate-400 font-normal">
                        (Termasuk Temp, HP, Batt)
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                      {formatRupiah(data.bagian1.aksesorisRevenue)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-400">-</td>
                  </tr>

                  {/* Subtotal 2 */}
                  <tr className="bg-blue-50/70 font-bold border-y border-blue-200">
                    <td className="py-2.5 px-3 text-center text-blue-900">-</td>
                    <td className="py-2.5 px-4 text-blue-900">Subtotal Penjualan Aksesoris (Acc)</td>
                    <td className="py-2.5 px-4 text-right text-blue-400">-</td>
                    <td className="py-2.5 px-4 text-right font-mono text-blue-950 font-black">
                      {formatRupiah(data.bagian1.subtotalAksesoris)}
                    </td>
                  </tr>

                  {/* Row 4: Service HP */}
                  <tr className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 text-center font-bold text-slate-600">4</td>
                    <td className="py-2.5 px-4 font-semibold text-slate-800">Service HP</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                      {formatRupiah(data.bagian1.serviceHpRevenue)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-400">-</td>
                  </tr>

                  {/* Subtotal 3 */}
                  <tr className="bg-blue-50/70 font-bold border-y border-blue-200">
                    <td className="py-2.5 px-3 text-center text-blue-900">-</td>
                    <td className="py-2.5 px-4 text-blue-900">Subtotal Service HP (Cash + TF/QRIS)</td>
                    <td className="py-2.5 px-4 text-right text-blue-400">-</td>
                    <td className="py-2.5 px-4 text-right font-mono text-blue-950 font-black">
                      {formatRupiah(data.bagian1.subtotalServiceHp)}
                    </td>
                  </tr>

                  {/* TOTAL OMZET MASUK HARIAN */}
                  <tr className="bg-amber-100/80 font-black text-slate-900 border-t-2 border-amber-300">
                    <td className="py-3 px-3 text-center text-amber-700 text-sm">★</td>
                    <td className="py-3 px-4 uppercase tracking-wider text-amber-950 font-extrabold">
                      TOTAL OMZET MASUK HARIAN
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-400">-</td>
                    <td className="py-3 px-4 text-right font-mono text-sm sm:text-base text-amber-950 font-black">
                      {formatRupiah(data.bagian1.totalOmzetHarian)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* BAGIAN 2A & 2B: PENGATURAN PERSENTASE & REKAP KOMISI TEKNISI              */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bagian 2A: Persentase */}
            <div className="space-y-2">
              <div className="bg-[#1E3A8A] text-white px-4 py-2.5 rounded-t-xl font-black text-xs sm:text-sm tracking-wide">
                BAGIAN 2A: PENGATURAN PERSENTASE KOMISI TEKNISI
              </div>
              <div className="overflow-x-auto border border-blue-200 rounded-b-xl">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-blue-600 text-white font-bold divide-x divide-blue-500">
                      <th className="py-2.5 px-3 text-center w-12">No</th>
                      <th className="py-2.5 px-3 text-left">Nama Teknisi</th>
                      <th className="py-2.5 px-3 text-center w-28">Persentase Komisi</th>
                      <th className="py-2.5 px-3 text-center w-28">Porsi Toko</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {data.bagian2A.technicians.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-slate-400 italic">
                          Tidak ada servis selesai pada tanggal ini
                        </td>
                      </tr>
                    ) : (
                      data.bagian2A.technicians.map((tech) => (
                        <tr key={tech.technicianId} className="hover:bg-slate-50">
                          <td className="py-2 px-3 text-center font-bold text-slate-500">{tech.no}</td>
                          <td className="py-2 px-3 font-semibold text-slate-800">{tech.technicianName}</td>
                          <td className="py-2 px-3 text-center font-bold text-blue-700 font-mono">
                            {tech.commissionPercentage}%
                          </td>
                          <td className="py-2 px-3 text-center font-bold text-emerald-700 font-mono">
                            {tech.storePercentage}%
                          </td>
                        </tr>
                      ))
                    )}
                    <tr className="bg-slate-100 font-bold border-t border-slate-300">
                      <td className="py-2 px-3 text-center text-slate-500">•</td>
                      <td className="py-2 px-3 text-slate-700">Rata-rata Bagi Hasil Komisi</td>
                      <td className="py-2 px-3 text-center font-mono text-blue-900">
                        {data.bagian2A.averageCommissionPercentage}%
                      </td>
                      <td className="py-2 px-3 text-center font-mono text-emerald-900">
                        {data.bagian2A.averageStorePercentage}%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bagian 2B: Rekap Komisi & Bagi Hasil */}
            <div className="space-y-2">
              <div className="bg-[#1E3A8A] text-white px-4 py-2.5 rounded-t-xl font-black text-xs sm:text-sm tracking-wide">
                BAGIAN 2B: REKAP KOMISI & BAGI HASIL TEKNISI
              </div>
              <div className="overflow-x-auto border border-blue-200 rounded-b-xl">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-blue-600 text-white font-bold divide-x divide-blue-500">
                      <th className="py-2.5 px-3 text-center w-12">No</th>
                      <th className="py-2.5 px-3 text-left">Nama Teknisi</th>
                      <th className="py-2.5 px-3 text-right w-32">Hak Komisi Teknisi (Rp)</th>
                      <th className="py-2.5 px-3 text-right w-32">Bagian Toko (Rp)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {data.bagian2B.technicians.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-slate-400 italic">
                          Tidak ada servis selesai pada tanggal ini
                        </td>
                      </tr>
                    ) : (
                      data.bagian2B.technicians.map((tech) => (
                        <tr key={tech.technicianId} className="hover:bg-slate-50">
                          <td className="py-2 px-3 text-center font-bold text-slate-500">{tech.no}</td>
                          <td className="py-2 px-3 font-semibold text-slate-800">{tech.technicianName}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-amber-600">
                            {formatRupiah(tech.commissionFee)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600">
                            {formatRupiah(tech.storeProfit)}
                          </td>
                        </tr>
                      ))
                    )}
                    <tr className="bg-blue-900 text-white font-black border-t-2 border-blue-950">
                      <td className="py-2.5 px-3 text-center text-xs">TOTAL</td>
                      <td className="py-2.5 px-3 text-xs uppercase tracking-wide">
                        TOTAL KOMISI & BAGI HASIL SERVIS
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-amber-300 font-black">
                        {formatRupiah(data.bagian2B.totalHakKomisiTeknisi)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-300 font-black">
                        {formatRupiah(data.bagian2B.totalBagianToko)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* BAGIAN 2C: RINCIAN SERVIS HARIAN MASING-MASING TEKNISI                    */}
          {/* ========================================================================= */}
          <div className="space-y-4">
            <div className="bg-[#1E3A8A] text-white px-4 py-2.5 rounded-t-xl font-black text-sm tracking-wide">
              BAGIAN 2C: RINCIAN SERVIS HARIAN MASING-MASING TEKNISI
            </div>

            {data.bagian2C.length === 0 ? (
              <div className="p-6 text-center text-slate-400 border border-dashed border-slate-300 rounded-2xl italic text-xs">
                Tidak ada rincian pengerjaan servis pada tanggal ini
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {data.bagian2C.map((techSection, idx) => (
                  <div
                    key={techSection.technicianId}
                    className="border border-slate-300 rounded-2xl overflow-hidden shadow-xs flex flex-col justify-between"
                  >
                    <div>
                      <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 font-black text-xs text-blue-900 uppercase tracking-wide flex items-center justify-between">
                        <span>
                          {idx + 1}. RINCIAN SERVIS - {techSection.technicianName}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-200/80 text-blue-900 font-bold font-mono">
                          {techSection.services.length} Nota
                        </span>
                      </div>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-blue-50 text-blue-950 font-bold border-b border-slate-200">
                            <th className="py-2 px-3 text-center w-10">No</th>
                            <th className="py-2 px-3 text-left">Tipe HP & Kerusakan</th>
                            <th className="py-2 px-3 text-right w-28">Biaya Jasa Servis</th>
                            <th className="py-2 px-3 text-left w-24">Catatan / Nota</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {techSection.services.map((item) => (
                            <tr key={item.no} className="hover:bg-slate-50/80">
                              <td className="py-1.5 px-3 text-center font-bold text-slate-400">
                                {item.no}
                              </td>
                              <td className="py-1.5 px-3 font-semibold text-slate-800">
                                {item.deviceAndIssue}
                              </td>
                              <td className="py-1.5 px-3 text-right font-mono font-bold text-slate-900">
                                {formatRupiah(item.serviceFee)}
                              </td>
                              <td className="py-1.5 px-3 text-slate-500 text-[11px] truncate max-w-[120px]">
                                {item.notes || "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="bg-slate-100/90 border-t border-slate-200 px-4 py-2 flex items-center justify-between font-bold text-xs">
                      <span className="text-slate-700 uppercase tracking-wider">TOTAL</span>
                      <span className="font-mono font-black text-slate-900 text-sm">
                        {formatRupiah(techSection.total)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* BAGIAN 3: UANG KELUAR (PENGELUARAN HARIAN)                                 */}
          {/* ========================================================================= */}
          <div className="space-y-2">
            <div className="bg-[#1E3A8A] text-white px-4 py-2.5 rounded-t-xl font-black text-sm tracking-wide flex items-center justify-between">
              <span>BAGIAN 3: UANG KELUAR (PENGELUARAN HARIAN)</span>
              <span className="text-xs font-normal opacity-80">Kas Keluar Operasional</span>
            </div>

            <div className="overflow-x-auto border border-blue-200 rounded-b-xl">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-blue-600 text-white font-bold divide-x divide-blue-500">
                    <th className="py-2.5 px-3 text-center w-12">No</th>
                    <th className="py-2.5 px-4 text-left">Keterangan Pengeluaran</th>
                    <th className="py-2.5 px-4 text-right w-52">Nominal (Rp)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {data.bagian3.expenses.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-4 text-center text-slate-400 italic">
                        Tidak ada pengeluaran kas tercatat pada tanggal ini (Rp 0)
                      </td>
                    </tr>
                  ) : (
                    data.bagian3.expenses.map((exp) => (
                      <tr key={exp.no} className="hover:bg-slate-50">
                        <td className="py-2 px-3 text-center font-bold text-slate-500">{exp.no}</td>
                        <td className="py-2 px-4 font-semibold text-slate-800 uppercase tracking-wide">
                          {exp.description}
                        </td>
                        <td className="py-2 px-4 text-right font-mono font-bold text-rose-600">
                          {formatRupiah(exp.amount)}
                        </td>
                      </tr>
                    ))
                  )}
                  <tr className="bg-rose-50 text-rose-950 font-black border-t-2 border-rose-200">
                    <td colSpan={2} className="py-3 px-4 uppercase tracking-wider text-right">
                      TOTAL UANG KELUAR (OPERASIONAL)
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-sm text-rose-700 font-black">
                      {formatRupiah(data.bagian3.totalExpenses)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* BAGIAN 4: RINGKASAN AKHIR KAS HARIAN (SETORAN HARI INI)                   */}
          {/* ========================================================================= */}
          <div className="space-y-3">
            <div className="bg-[#1E3A8A] text-white px-4 py-2.5 rounded-t-xl font-black text-sm tracking-wide flex items-center justify-between">
              <span>BAGIAN 4: RINGKASAN AKHIR KAS HARIAN (SETORAN HARI INI)</span>
              <span className="text-xs font-normal opacity-90 font-mono">Closing Kasir</span>
            </div>

            <div className="overflow-x-auto border border-blue-200 rounded-b-xl">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-blue-600 text-white font-bold divide-x divide-blue-500">
                    <th className="py-2.5 px-3 text-center w-12">No</th>
                    <th className="py-2.5 px-4 text-left">Komponen Rekapitulasi Kas</th>
                    <th className="py-2.5 px-4 text-right w-64">Jumlah (Rp)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-semibold">
                  {/* Row 1: Total Pemasukan */}
                  <tr className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 text-center text-slate-500 font-bold">1</td>
                    <td className="py-2.5 px-4 text-slate-800">Total Pemasukan</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                      {formatRupiah(data.bagian4.totalOmzetHarian)}
                    </td>
                  </tr>

                  {/* Row 3: Total Omzet */}
                  <tr className="bg-blue-50/60 font-bold">
                    <td className="py-2.5 px-3 text-center text-blue-900">3</td>
                    <td className="py-2.5 px-4 text-blue-950 uppercase tracking-wide">
                      TOTAL SEMUA PEMASUKAN KOTOR (OMZET)
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-blue-950 font-black">
                      {formatRupiah(data.bagian4.totalOmzetHarian)}
                    </td>
                  </tr>

                  {/* Row 4: Dikurangi Hak Komisi Teknisi */}
                  <tr className="hover:bg-slate-50 text-amber-900">
                    <td className="py-2.5 px-3 text-center text-amber-700 font-bold">4</td>
                    <td className="py-2.5 px-4 text-slate-800">Dikurangi: Total Hak Komisi Teknisi</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-amber-600">
                      -{formatRupiah(data.bagian4.totalHakKomisiTeknisi)}
                    </td>
                  </tr>

                  {/* Row 5: Dikurangi Uang Keluar */}
                  <tr className="hover:bg-slate-50 text-rose-900">
                    <td className="py-2.5 px-3 text-center text-rose-700 font-bold">5</td>
                    <td className="py-2.5 px-4 text-slate-800">
                      Dikurangi: Total Uang Keluar (Operasional)
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-rose-600">
                      -{formatRupiah(data.bagian4.totalExpenses)}
                    </td>
                  </tr>

                  {/* Row Star: Sisa Uang Bersih Harian Toko */}
                  <tr className="bg-emerald-100/90 border-t-2 border-emerald-400 font-black text-emerald-950">
                    <td className="py-3 px-3 text-center text-emerald-700 text-sm">★</td>
                    <td className="py-3 px-4 uppercase tracking-wider text-emerald-950 text-xs sm:text-sm">
                      SISA UANG BERSIH HARIAN TOKO
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-sm sm:text-base text-emerald-950">
                      {formatRupiah(data.bagian4.sisaUangBersihToko)}
                    </td>
                  </tr>

                  {/* Row Diamond: Estimasi Fisik Kas Tunai di Laci */}
                  <tr className="bg-blue-100/90 border-t border-blue-300 font-black text-blue-950">
                    <td className="py-3.5 px-3 text-center text-blue-700 text-sm">◆</td>
                    <td className="py-3.5 px-4 uppercase tracking-wider text-blue-950 text-xs sm:text-sm">
                      ESTIMASI FISIK KAS TUNAI DI LACI (SETORAN)
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-base sm:text-lg text-blue-950 font-black">
                      {formatRupiah(data.bagian4.estimasiFisikKasLaci)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Non-Cash Note & Physical Drawer Info Box */}
            {data.bagian4.cashDrawerReconciliation &&
              data.bagian4.cashDrawerReconciliation.totalNonCash > 0 && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 text-xs text-indigo-900 space-y-2 mt-4 print:hidden">
                  <div className="flex items-center gap-2 font-bold text-indigo-950">
                    <Banknote className="w-4 h-4 text-indigo-600" />
                    <span>Catatan Uang Masuk Bank / QRIS (Non-Tunai):</span>
                  </div>
                  <p className="text-[11px] text-indigo-800 leading-relaxed">
                    Terdapat penerimaan non-tunai sebesar{" "}
                    <strong className="font-mono font-bold">
                      {formatRupiah(data.bagian4.cashDrawerReconciliation.totalNonCash)}
                    </strong>{" "}
                    yang masuk langsung ke rekening bank / e-wallet toko (bukan uang fisik di laci).
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-indigo-200/60 font-mono text-xs">
                    <div>
                      <span className="text-[11px] text-indigo-600 font-sans block">
                        Uang Tunai Masuk Laci:
                      </span>
                      <span className="font-bold">
                        +{formatRupiah(data.bagian4.cashDrawerReconciliation.totalCashIn)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-indigo-600 font-sans block">
                        Fisik Kas Tunai Bersih di Laci:
                      </span>
                      <span className="font-bold text-emerald-700">
                        {formatRupiah(data.bagian4.cashDrawerReconciliation.estimasiFisikTunaiLaci)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
          </div>
        </div>
      )}
    </div>
  );
}


"use client";

import React, { useState, useEffect } from "react";
import {
  BarChart3,
  Calendar,
  TrendingUp,
  Receipt,
  ShoppingCart,
  SmartphoneNfc,
  Ticket,
  Plus,
  Coins,
  ArrowUpRight,
  Printer,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Sparkles,
  Search,
  FileText,
  User,
  UserCheck,
  RefreshCw,
  X,
  CreditCard,
  Banknote,
  QrCode,
  Clock,
} from "lucide-react";
import { formatRupiah } from "@/lib/calculations";

export default function ReportsClient() {
  const [periodPreset, setPeriodPreset] = useState<
    "TODAY" | "7DAYS" | "THIS_MONTH" | "LAST_MONTH" | "CUSTOM"
  >("THIS_MONTH");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [reportData, setReportData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "PNL" | "POS_RETAIL" | "VOUCHER" | "DIGITAL" | "EXPENSES" | "RECEIVABLES"
  >("PNL");

  // Receivables (Laporan Piutang & Pelanggan) State
  const [receivablesData, setReceivablesData] = useState<any | null>(null);
  const [receivablesLoading, setReceivablesLoading] = useState<boolean>(false);
  const [receivablesStatusFilter, setReceivablesStatusFilter] = useState<"ALL" | "UNPAID" | "PAID">("UNPAID");
  const [receivablesSearch, setReceivablesSearch] = useState<string>("");
  const [selectedCustomerFilter, setSelectedCustomerFilter] = useState<string>("");

  // Pelunasan Piutang Modal State
  const [isSettleModalOpen, setIsSettleModalOpen] = useState<boolean>(false);
  const [selectedSettleSale, setSelectedSettleSale] = useState<any | null>(null);
  const [settlePaidMethod, setSettlePaidMethod] = useState<"CASH" | "TRANSFER" | "QRIS">("CASH");
  const [settleNotes, setSettleNotes] = useState<string>("");
  const [settleLoading, setSettleLoading] = useState<boolean>(false);

  // Expense Modal
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    category: "OPERATIONAL" as any,
    description: "",
    amount: 0,
    notes: "",
  });
  const [expenseLoading, setExpenseLoading] = useState(false);

  const fetchReceivables = async (
    status = receivablesStatusFilter,
    search = receivablesSearch,
    custId = selectedCustomerFilter
  ) => {
    setReceivablesLoading(true);
    try {
      const res = await fetch(
        `/api/reports/receivables?status=${status}&search=${encodeURIComponent(
          search
        )}&customerId=${encodeURIComponent(custId)}`
      );
      const data = await res.json();
      if (res.ok) {
        setReceivablesData(data);
      }
    } catch (e) {
      console.error("Receivables fetch error:", e);
    } finally {
      setReceivablesLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "RECEIVABLES") {
      fetchReceivables(receivablesStatusFilter, receivablesSearch, selectedCustomerFilter);
    }
  }, [activeTab, receivablesStatusFilter, receivablesSearch, selectedCustomerFilter]);

  const handleSettleSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSettleSale) return;

    setSettleLoading(true);
    try {
      const res = await fetch(`/api/sales/${selectedSettleSale.id}/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paidMethod: settlePaidMethod,
          notes: settleNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mencatat pelunasan piutang");

      setIsSettleModalOpen(false);
      setSelectedSettleSale(null);
      setSettleNotes("");
      fetchReceivables(receivablesStatusFilter, receivablesSearch, selectedCustomerFilter);
      fetchReports(periodPreset);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSettleLoading(false);
    }
  };

  const fetchReports = async (preset: string) => {
    setLoading(true);
    let startDate = "";
    let endDate = "";
    const now = new Date();

    if (preset === "TODAY") {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      startDate = todayStart.toISOString();
      endDate = todayEnd.toISOString();
    } else if (preset === "7DAYS") {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 7);
      sevenDaysAgo.setHours(0, 0, 0, 0);
      startDate = sevenDaysAgo.toISOString();
      endDate = now.toISOString();
    } else if (preset === "THIS_MONTH") {
      const startMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      startDate = startMonth.toISOString();
      endDate = endMonth.toISOString();
    } else if (preset === "LAST_MONTH") {
      const startLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      const endLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      startDate = startLastMonth.toISOString();
      endDate = endLastMonth.toISOString();
    } else if (preset === "CUSTOM" && customStartDate && customEndDate) {
      const startCustom = new Date(`${customStartDate}T00:00:00.000`);
      const endCustom = new Date(`${customEndDate}T23:59:59.999`);
      startDate = startCustom.toISOString();
      endDate = endCustom.toISOString();
    }

    try {
      const query = startDate && endDate ? `?startDate=${startDate}&endDate=${endDate}` : "";
      const res = await fetch(`/api/reports/summary${query}`);
      const data = await res.json();
      if (res.ok) {
        setReportData(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (periodPreset !== "CUSTOM") {
      fetchReports(periodPreset);
    }
  }, [periodPreset]);

  const handleApplyCustomDate = (e: React.FormEvent) => {
    e.preventDefault();
    if (customStartDate && customEndDate) {
      fetchReports("CUSTOM");
    }
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setExpenseLoading(true);

    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...expenseForm,
          amount: Number(expenseForm.amount),
        }),
      });

      if (!res.ok) throw new Error("Gagal menyimpan pengeluaran");

      setIsExpenseModalOpen(false);
      setExpenseForm({ category: "OPERATIONAL", description: "", amount: 0, notes: "" });
      fetchReports(periodPreset);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setExpenseLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = async () => {
    setExportLoading(true);
    try {
      let startDate = "";
      let endDate = "";
      const now = new Date();

      if (periodPreset === "TODAY") {
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        startDate = todayStart.toISOString();
        endDate = todayEnd.toISOString();
      } else if (periodPreset === "7DAYS") {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(now.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);
        startDate = sevenDaysAgo.toISOString();
        endDate = now.toISOString();
      } else if (periodPreset === "THIS_MONTH") {
        const startMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        startDate = startMonth.toISOString();
        endDate = endMonth.toISOString();
      } else if (periodPreset === "LAST_MONTH") {
        const startLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
        const endLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        startDate = startLastMonth.toISOString();
        endDate = endLastMonth.toISOString();
      } else if (periodPreset === "CUSTOM" && customStartDate && customEndDate) {
        const startCustom = new Date(`${customStartDate}T00:00:00.000`);
        const endCustom = new Date(`${customEndDate}T23:59:59.999`);
        startDate = startCustom.toISOString();
        endDate = endCustom.toISOString();
      }

      const query = startDate && endDate ? `?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}` : "";
      const res = await fetch(`/api/reports/export${query}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Gagal mengunduh file Excel laporan");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      const disposition = res.headers.get("Content-Disposition");
      let filename = `Laporan_ChiCha_Mobile_${new Date().toISOString().slice(0, 10)}.xlsx`;
      if (disposition && disposition.indexOf("filename=") !== -1) {
        const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
        if (matches != null && matches[1]) {
          filename = matches[1].replace(/['"]/g, "");
        }
      }
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error("Export error:", err);
      alert(err.message || "Gagal mengekspor laporan ke Excel");
    } finally {
      setExportLoading(false);
    }
  };

  const formatPeriodLabel = () => {
    if (!reportData?.period) return "";
    const s = new Date(reportData.period.startDate).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const e = new Date(reportData.period.endDate).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    return s === e ? s : `${s} — ${e}`;
  };

  const EXPENSE_CATEGORY_NAMES: Record<string, string> = {
    ELECTRICITY: "Listrik & Air (Utilitas)",
    INTERNET: "Internet & WiFi Toko",
    RENT: "Sewa Tempat / Kios",
    OPERATIONAL: "Operasional Toko & Konsumsi",
    TRANSPORT: "Transportasi & Logistik",
    SALARY: "Gaji / Upah Karyawan",
    OTHER: "Pengeluaran Lain-lain",
  };

  return (
    <div className="space-y-6">
      {/* Header & Date Preset Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <BarChart3 className="w-6 h-6 text-indigo-600" />
            <span>Laporan Keuangan & Laba Rugi</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Rekap omzet, HPP modal, laba kotor per channel (POS, Voucher, Digital), beban operasional, dan laba bersih
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Date Filter Pills */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-slate-200/80 shadow-sm">
            <button
              onClick={() => setPeriodPreset("TODAY")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                periodPreset === "TODAY"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Hari Ini
            </button>
            <button
              onClick={() => setPeriodPreset("7DAYS")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                periodPreset === "7DAYS"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              7 Hari
            </button>
            <button
              onClick={() => setPeriodPreset("THIS_MONTH")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                periodPreset === "THIS_MONTH"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Bulan Ini
            </button>
            <button
              onClick={() => setPeriodPreset("LAST_MONTH")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                periodPreset === "LAST_MONTH"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Bulan Lalu
            </button>
            <button
              onClick={() => setPeriodPreset("CUSTOM")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                periodPreset === "CUSTOM"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Kustom
            </button>
          </div>

          <button
            onClick={handleExportExcel}
            disabled={exportLoading}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all active:scale-95 disabled:opacity-60"
            title="Download Laporan Lengkap Multi-Sheet (Excel .xlsx)"
          >
            {exportLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-4 h-4" />
            )}
            <span>{exportLoading ? "Mengekspor..." : "Export Excel (.xlsx)"}</span>
          </button>

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200/80 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold shadow-sm transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak / PDF</span>
          </button>

          <button
            onClick={() => setIsExpenseModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/20 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Catat Beban</span>
          </button>
        </div>
      </div>

      {/* Custom Date Range Picker bar */}
      {periodPreset === "CUSTOM" && (
        <form
          onSubmit={handleApplyCustomDate}
          className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-3 text-xs print:hidden"
        >
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-600">Mulai:</span>
            <input
              type="date"
              required
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-semibold focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-600">Sampai:</span>
            <input
              type="date"
              required
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-semibold focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-1.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-sm"
          >
            Terapkan Filter
          </button>
        </form>
      )}

      {/* Print Document Header */}
      <div className="hidden print:block mb-6 border-b pb-4">
        <h1 className="text-2xl font-bold text-slate-900">ChiCha Mobile — Laporan Keuangan</h1>
        <p className="text-sm text-slate-600">Periode: {formatPeriodLabel()}</p>
      </div>

      {loading || !reportData ? (
        <div className="py-20 text-center text-slate-400">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs">Menyusun ringkasan laporan keuangan...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Main Financial KPI Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Total Omzet */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider">Total Pendapatan (Omzet)</span>
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-extrabold text-slate-900 mt-2">
                {formatRupiah(reportData.summary.totalGrossRevenue)}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">POS + Voucher + Digital</p>
            </div>

            {/* Total HPP / Modal */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider">Total Modal (HPP)</span>
                <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold">
                  <Layers className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-extrabold text-slate-700 mt-2">
                {formatRupiah(reportData.summary.totalCOGS)}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Harga pokok barang & pulsa</p>
            </div>

            {/* Total Laba Kotor */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider">Total Laba Kotor</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <Coins className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-extrabold text-emerald-600 mt-2">
                +{formatRupiah(reportData.summary.totalGrossProfit)}
              </p>
              <p className="text-[11px] text-emerald-700 font-semibold mt-1">
                Margin Kotor: {reportData.summary.grossMarginPercent}%
              </p>
            </div>

            {/* Total Beban Pengeluaran */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider">Beban Operasional</span>
                <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                  <Receipt className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-extrabold text-rose-600 mt-2">
                {formatRupiah(reportData.summary.totalExpenses)}
              </p>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[11px] text-slate-400">Listrik, sewa, gaji, toko</span>
              </div>
            </div>

            {/* Laba Bersih */}
            <div
              className={`p-5 rounded-3xl border shadow-sm flex flex-col justify-between ${
                reportData.summary.netProfit >= 0
                  ? "bg-gradient-to-br from-indigo-900 to-slate-900 text-white"
                  : "bg-rose-950 text-white"
              }`}
            >
              <div className="flex items-center justify-between text-indigo-200">
                <span className="text-xs font-bold uppercase tracking-wider">Laba Bersih Toko</span>
                <div className="w-8 h-8 rounded-xl bg-white/10 text-white flex items-center justify-center font-bold">
                  <Sparkles className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-extrabold text-white mt-2">
                {formatRupiah(reportData.summary.netProfit)}
              </p>
              <p className="text-[11px] text-indigo-200 font-semibold mt-1">
                Net Margin: {reportData.summary.netMarginPercent}%
              </p>
            </div>
          </div>

          {/* Report Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto print:hidden">
            <button
              onClick={() => setActiveTab("PNL")}
              className={`pb-3 px-4 text-sm font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-all ${
                activeTab === "PNL"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Coins className="w-4 h-4" />
              <span>Laporan Laba Rugi (P&L)</span>
            </button>

            <button
              onClick={() => setActiveTab("POS_RETAIL")}
              className={`pb-3 px-4 text-sm font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-all ${
                activeTab === "POS_RETAIL"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Penjualan Aksesoris POS</span>
            </button>

            <button
              onClick={() => setActiveTab("VOUCHER")}
              className={`pb-3 px-4 text-sm font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-all ${
                activeTab === "VOUCHER"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Ticket className="w-4 h-4" />
              <span>Penjualan Voucher Fisik</span>
            </button>

            <button
              onClick={() => setActiveTab("DIGITAL")}
              className={`pb-3 px-4 text-sm font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-all ${
                activeTab === "DIGITAL"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <SmartphoneNfc className="w-4 h-4" />
              <span>Transaksi Digital (PPOB)</span>
            </button>

            <button
              onClick={() => setActiveTab("EXPENSES")}
              className={`pb-3 px-4 text-sm font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-all ${
                activeTab === "EXPENSES"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>Beban Operasional ({formatRupiah(reportData.expenses.total)})</span>
            </button>

            <button
              onClick={() => setActiveTab("RECEIVABLES")}
              className={`pb-3 px-4 text-sm font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-all ${
                activeTab === "RECEIVABLES"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Laporan Piutang & Pelanggan</span>
              {receivablesData?.summary?.unpaidInvoicesCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-extrabold animate-pulse">
                  {receivablesData.summary.unpaidInvoicesCount}
                </span>
              )}
            </button>
          </div>

          {/* TAB 1: FORMAL P&L STATEMENT */}
          {activeTab === "PNL" && (
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-2">
                <div>
                  <h3 className="text-xl font-extrabold text-slate-900">
                    Laporan Laba Rugi Komprehensif
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Periode: <strong className="text-indigo-600">{formatPeriodLabel()}</strong>
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Status: {reportData.summary.netProfit >= 0 ? "Laba Bersih Positif" : "Defisit"}
                  </span>
                </div>
              </div>

              <div className="space-y-6 text-sm">
                {/* SECTION 1: REVENUE */}
                <div className="space-y-2">
                  <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-400 flex items-center justify-between border-b pb-1">
                    <span>I. PENDAPATAN USAHA (REVENUE)</span>
                    <span>NOMINAL (RP)</span>
                  </h4>
                  <div className="space-y-1.5 pl-2 text-xs">
                    <div className="flex justify-between py-1 text-slate-700">
                      <span>1. Penjualan Produk & Aksesoris Fisik (POS)</span>
                      <span className="font-semibold font-mono">
                        {formatRupiah(reportData.channels.posRetail.revenue)}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 text-slate-700">
                      <span>2. Penjualan Voucher Fisik (Kasir & Rekap Harian)</span>
                      <span className="font-semibold font-mono">
                        {formatRupiah(reportData.channels.voucher.revenue)}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 text-slate-700">
                      <span>3. Penjualan Produk Digital / PPOB (Pulsa, PLN, Data)</span>
                      <span className="font-semibold font-mono">
                        {formatRupiah(reportData.channels.digital.revenue)}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-t border-slate-200 font-extrabold text-slate-900 text-xs bg-slate-50/70 px-2 rounded-lg">
                      <span>TOTAL PENDAPATAN KOTOR (A)</span>
                      <span className="font-mono">{formatRupiah(reportData.summary.totalGrossRevenue)}</span>
                    </div>
                  </div>
                </div>

                {/* SECTION 2: COGS / HPP */}
                <div className="space-y-2">
                  <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-400 flex items-center justify-between border-b pb-1">
                    <span>II. HARGA POKOK PENJUALAN (HPP / MODAL)</span>
                    <span>NOMINAL (RP)</span>
                  </h4>
                  <div className="space-y-1.5 pl-2 text-xs">
                    <div className="flex justify-between py-1 text-slate-700">
                      <span>1. Modal Produk & Aksesoris Fisik Terjual</span>
                      <span className="font-semibold font-mono text-slate-600">
                        {formatRupiah(reportData.channels.posRetail.cost)}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 text-slate-700">
                      <span>2. Modal Voucher Fisik Terjual</span>
                      <span className="font-semibold font-mono text-slate-600">
                        {formatRupiah(reportData.channels.voucher.cost)}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 text-slate-700">
                      <span>3. Modal Produk Digital / Saldo Terpakai</span>
                      <span className="font-semibold font-mono text-slate-600">
                        {formatRupiah(reportData.channels.digital.cost)}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-t border-slate-200 font-extrabold text-slate-800 text-xs bg-slate-50/70 px-2 rounded-lg">
                      <span>TOTAL HARGA POKOK PENJUALAN (B)</span>
                      <span className="font-mono">{formatRupiah(reportData.summary.totalCOGS)}</span>
                    </div>
                  </div>
                </div>

                {/* SECTION 3: GROSS PROFIT */}
                <div className="space-y-2">
                  <h4 className="font-extrabold text-xs uppercase tracking-wider text-emerald-700 flex items-center justify-between border-b border-emerald-200 pb-1">
                    <span>III. LABA KOTOR USAHA (GROSS PROFIT = A - B)</span>
                    <span>NOMINAL & MARGIN</span>
                  </h4>
                  <div className="space-y-1.5 pl-2 text-xs">
                    <div className="flex justify-between py-1 text-slate-700">
                      <span>1. Laba Kotor POS Aksesoris</span>
                      <span className="font-semibold font-mono text-emerald-600">
                        +{formatRupiah(reportData.channels.posRetail.profit)}{" "}
                        <span className="text-[10px] text-slate-400">
                          ({reportData.channels.posRetail.marginPercent}%)
                        </span>
                      </span>
                    </div>
                    <div className="flex justify-between py-1 text-slate-700">
                      <span>2. Laba Kotor Voucher Fisik</span>
                      <span className="font-semibold font-mono text-emerald-600">
                        +{formatRupiah(reportData.channels.voucher.profit)}{" "}
                        <span className="text-[10px] text-slate-400">
                          ({reportData.channels.voucher.marginPercent}%)
                        </span>
                      </span>
                    </div>
                    <div className="flex justify-between py-1 text-slate-700">
                      <span>3. Laba Transaksi Digital</span>
                      <span className="font-semibold font-mono text-emerald-600">
                        +{formatRupiah(reportData.channels.digital.profit)}{" "}
                        <span className="text-[10px] text-slate-400">
                          ({reportData.channels.digital.marginPercent}%)
                        </span>
                      </span>
                    </div>
                    <div className="flex justify-between py-2.5 border-t border-emerald-300 font-extrabold text-emerald-800 text-sm bg-emerald-50 px-3 rounded-xl">
                      <span>TOTAL LABA KOTOR USAHA (C)</span>
                      <span className="font-mono">
                        +{formatRupiah(reportData.summary.totalGrossProfit)}{" "}
                        <span className="text-xs">({reportData.summary.grossMarginPercent}%)</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* SECTION 4: OPERATING EXPENSES */}
                <div className="space-y-2">
                  <h4 className="font-extrabold text-xs uppercase tracking-wider text-rose-700 flex items-center justify-between border-b border-rose-200 pb-1">
                    <span>IV. BEBAN OPERASIONAL TOKO (EXPENSES)</span>
                    <span>NOMINAL (RP)</span>
                  </h4>
                  <div className="space-y-1.5 pl-2 text-xs">
                    {Object.entries(reportData.expenses.categoryBreakdown).map(([cat, amt]: any) => (
                      <div key={cat} className="flex justify-between py-1 text-slate-700">
                        <span>{EXPENSE_CATEGORY_NAMES[cat] || cat}</span>
                        <span className="font-semibold font-mono text-rose-600">
                          {formatRupiah(amt)}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between py-2.5 border-t border-rose-300 font-extrabold text-rose-800 text-sm bg-rose-50 px-3 rounded-xl">
                      <span>TOTAL BEBAN OPERASIONAL (D)</span>
                      <span className="font-mono">-{formatRupiah(reportData.summary.totalExpenses)}</span>
                    </div>
                  </div>
                </div>

                {/* SECTION 5: NET PROFIT */}
                <div className="pt-4 border-t-2 border-dashed border-slate-300">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950 text-white shadow-lg">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-indigo-300">
                        V. LABA BERSIH USAHA (NET PROFIT = C - D)
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Keuntungan bersih akhir setelah seluruh biaya dan modal tertutup
                      </p>
                    </div>
                    <div className="text-right mt-3 sm:mt-0">
                      <span
                        className={`text-2xl sm:text-3xl font-extrabold ${
                          reportData.summary.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {formatRupiah(reportData.summary.netProfit)}
                      </span>
                      <span className="block text-xs text-indigo-200 font-semibold mt-0.5">
                        Net Profit Margin: {reportData.summary.netMarginPercent}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: POS RETAIL ACCESSORIES */}
          {activeTab === "POS_RETAIL" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                  <span className="text-xs font-bold text-slate-500 uppercase">Omzet POS Aksesoris</span>
                  <p className="text-2xl font-bold text-slate-900 mt-1">
                    {formatRupiah(reportData.channels.posRetail.revenue)}
                  </p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                  <span className="text-xs font-bold text-slate-500 uppercase">Modal HPP</span>
                  <p className="text-2xl font-bold text-slate-700 mt-1">
                    {formatRupiah(reportData.channels.posRetail.cost)}
                  </p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                  <span className="text-xs font-bold text-emerald-600 uppercase">Laba Bersih POS</span>
                  <p className="text-2xl font-bold text-emerald-600 mt-1">
                    +{formatRupiah(reportData.channels.posRetail.profit)}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Margin: {reportData.channels.posRetail.marginPercent}%
                  </p>
                </div>
              </div>

              {/* Top Products Table */}
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-4">
                <h3 className="font-extrabold text-slate-900 text-base">
                  Top 10 Produk Aksesoris Paling Laris & Menguntungkan
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3">Nama Produk Aksesoris</th>
                        <th className="px-4 py-3 text-center">Unit Terjual</th>
                        <th className="px-4 py-3 text-right">Total Omzet</th>
                        <th className="px-4 py-3 text-right">Total Profit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reportData.channels.posRetail.topProducts?.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-slate-400">
                            Belum ada penjualan aksesoris di periode ini
                          </td>
                        </tr>
                      ) : (
                        reportData.channels.posRetail.topProducts.map((p: any, i: number) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-bold text-slate-900">{p.name}</td>
                            <td className="px-4 py-3 text-center font-semibold text-slate-800">
                              {p.qty} unit
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-900">
                              {formatRupiah(p.revenue)}
                            </td>
                            <td className="px-4 py-3 text-right font-extrabold text-emerald-600">
                              +{formatRupiah(p.profit)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PHYSICAL VOUCHERS */}
          {activeTab === "VOUCHER" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                  <span className="text-xs font-bold text-slate-500 uppercase">Omzet Voucher</span>
                  <p className="text-2xl font-bold text-slate-900 mt-1">
                    {formatRupiah(reportData.channels.voucher.revenue)}
                  </p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                  <span className="text-xs font-bold text-slate-500 uppercase">Modal Voucher</span>
                  <p className="text-2xl font-bold text-slate-700 mt-1">
                    {formatRupiah(reportData.channels.voucher.cost)}
                  </p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                  <span className="text-xs font-bold text-emerald-600 uppercase">Laba Voucher</span>
                  <p className="text-2xl font-bold text-emerald-600 mt-1">
                    +{formatRupiah(reportData.channels.voucher.profit)}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Margin: {reportData.channels.voucher.marginPercent}%
                  </p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                  <span className="text-xs font-bold text-indigo-600 uppercase">Total Terjual</span>
                  <p className="text-2xl font-bold text-indigo-600 mt-1">
                    {reportData.channels.voucher.soldPcs} pcs
                  </p>
                </div>
              </div>

              {/* Operator Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-4">
                  <h3 className="font-extrabold text-slate-900 text-base">
                    Penjualan per Operator Provider
                  </h3>
                  <div className="space-y-3">
                    {reportData.channels.voucher.operatorBreakdown?.map((op: any, i: number) => (
                      <div
                        key={i}
                        className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between"
                      >
                        <div>
                          <span className="font-bold text-slate-900 text-sm">{op.operator}</span>
                          <p className="text-xs text-slate-400">{op.qty} pcs terjual</p>
                        </div>
                        <div className="text-right">
                          <span className="font-extrabold text-slate-900 text-sm block">
                            {formatRupiah(op.revenue)}
                          </span>
                          <span className="text-emerald-600 font-bold text-xs">
                            +{formatRupiah(op.profit)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-4">
                  <h3 className="font-extrabold text-slate-900 text-base">Top 10 Voucher Fisik Terlaris</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-600">
                      <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="px-3 py-2.5">Voucher</th>
                          <th className="px-3 py-2.5 text-center">Qty</th>
                          <th className="px-3 py-2.5 text-right">Laba</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {reportData.channels.voucher.topVouchers?.map((v: any, i: number) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="px-3 py-2.5 font-bold text-slate-900">{v.name}</td>
                            <td className="px-3 py-2.5 text-center font-semibold">{v.qty} pcs</td>
                            <td className="px-3 py-2.5 text-right font-extrabold text-emerald-600">
                              +{formatRupiah(v.profit)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: DIGITAL TRANSACTIONS */}
          {activeTab === "DIGITAL" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                  <span className="text-xs font-bold text-slate-500 uppercase">Omzet Digital</span>
                  <p className="text-2xl font-bold text-slate-900 mt-1">
                    {formatRupiah(reportData.channels.digital.revenue)}
                  </p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                  <span className="text-xs font-bold text-slate-500 uppercase">Modal Saldo</span>
                  <p className="text-2xl font-bold text-slate-700 mt-1">
                    {formatRupiah(reportData.channels.digital.cost)}
                  </p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                  <span className="text-xs font-bold text-emerald-600 uppercase">Laba Transaksi</span>
                  <p className="text-2xl font-bold text-emerald-600 mt-1">
                    +{formatRupiah(reportData.channels.digital.profit)}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Margin: {reportData.channels.digital.marginPercent}%
                  </p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                  <span className="text-xs font-bold text-indigo-600 uppercase">Transaksi Sukses</span>
                  <p className="text-2xl font-bold text-indigo-600 mt-1">
                    {reportData.channels.digital.successCount} trx
                  </p>
                </div>
              </div>

              {/* Digital Category Breakdown */}
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-4">
                <h3 className="font-extrabold text-slate-900 text-base">
                  Breakdown Kategori Digital (Pulsa, PLN, Paket Data, Game, E-Money)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {reportData.channels.digital.categoryBreakdown?.map((cat: any, i: number) => (
                    <div
                      key={i}
                      className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-slate-900 text-sm">{cat.category}</span>
                        <span className="text-xs font-bold text-slate-500">{cat.count} trx</span>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-xs">
                        <span className="text-slate-500">Omzet: {formatRupiah(cat.revenue)}</span>
                        <span className="font-bold text-emerald-600">+{formatRupiah(cat.profit)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: EXPENSES */}
          {activeTab === "EXPENSES" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Buku Pengeluaran & Beban Operasional Toko
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Total pengeluaran tercatat:{" "}
                    <strong className="text-rose-600">
                      {formatRupiah(reportData.expenses.total)}
                    </strong>
                  </p>
                </div>
                <button
                  onClick={() => setIsExpenseModalOpen(true)}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                >
                  + Tambah Pengeluaran
                </button>
              </div>

              {/* Expense Breakdown Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Object.entries(reportData.expenses.categoryBreakdown).map(([cat, amt]: any) => (
                  <div key={cat} className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
                    <p className="text-[10px] font-bold text-slate-400 uppercase truncate">
                      {EXPENSE_CATEGORY_NAMES[cat] || cat}
                    </p>
                    <p className="text-lg font-extrabold text-slate-900 mt-1">{formatRupiah(amt)}</p>
                  </div>
                ))}
              </div>

              {/* Recent Expenses List */}
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-4">
                <h4 className="font-extrabold text-slate-900 text-sm">Riwayat Transaksi Pengeluaran</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3">Tanggal</th>
                        <th className="px-4 py-3">Kategori</th>
                        <th className="px-4 py-3">Deskripsi</th>
                        <th className="px-4 py-3">Dicatat Oleh</th>
                        <th className="px-4 py-3 text-right">Nominal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reportData.expenses.recentExpenses?.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400">
                            Belum ada catatan pengeluaran di periode ini
                          </td>
                        </tr>
                      ) : (
                        reportData.expenses.recentExpenses.map((e: any) => (
                          <tr key={e.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-mono text-slate-500">
                              {new Date(e.date).toLocaleDateString("id-ID")}
                            </td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700">
                                {EXPENSE_CATEGORY_NAMES[e.category] || e.category}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-800">{e.description}</td>
                            <td className="px-4 py-3 text-slate-500">{e.createdBy?.name || "-"}</td>
                            <td className="px-4 py-3 text-right font-extrabold text-rose-600">
                              {formatRupiah(e.amount)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: LAPORAN PIUTANG & PELANGGAN */}
          {activeTab === "RECEIVABLES" && (
            <div className="space-y-6 animate-in fade-in">
              {/* 4 KPI Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Total Piutang Belum Lunas */}
                <div className="bg-white p-5 rounded-3xl border border-rose-200/80 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-xs font-bold uppercase tracking-wider text-rose-600">
                      Total Piutang Belum Lunas
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="text-2xl font-black text-rose-600 mt-2">
                    {formatRupiah(receivablesData?.summary?.totalUnpaidDebt || 0)}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {receivablesData?.summary?.unpaidInvoicesCount || 0} nota bon belum lunas
                  </p>
                </div>

                {/* 2. Total Piutang Sudah Dilunasi */}
                <div className="bg-white p-5 rounded-3xl border border-emerald-200/80 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                      Piutang Tertagih (Lunas)
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="text-2xl font-black text-emerald-600 mt-2">
                    {formatRupiah(receivablesData?.summary?.totalPaidDebt || 0)}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Dana piutang yang sudah masuk kas
                  </p>
                </div>

                {/* 3. Pelanggan Berpiutang */}
                <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      Pelanggan Berhutang
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                      <User className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="text-2xl font-black text-indigo-700 mt-2">
                    {receivablesData?.summary?.indebtedCustomerCount || 0}{" "}
                    <span className="text-sm font-semibold text-slate-500">orang</span>
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Memiliki saldo piutang aktif
                  </p>
                </div>

                {/* 4. Piutang Jatuh Tempo */}
                <div className="bg-white p-5 rounded-3xl border border-amber-200/80 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
                      Lewat Jatuh Tempo
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                      <Clock className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="text-2xl font-black text-amber-700 mt-2">
                    {receivablesData?.summary?.overdueCount || 0}{" "}
                    <span className="text-sm font-semibold text-slate-500">nota</span>
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Perlu penagihan segera
                  </p>
                </div>
              </div>

              {/* SECTION: REKAP SALDO PIUTANG PER PELANGGAN */}
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden space-y-3">
                <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-gradient-to-r from-slate-50 to-indigo-50/30">
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                      <UserCheck className="w-5 h-5 text-indigo-600" />
                      <span>Rekap Saldo Piutang per Pelanggan</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Daftar pelanggan yang memiliki catatan nota kredit / bon belum lunas
                    </p>
                  </div>
                  {selectedCustomerFilter && (
                    <button
                      type="button"
                      onClick={() => setSelectedCustomerFilter("")}
                      className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-all"
                    >
                      ✕ Tampilkan Semua Pelanggan
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto px-5 pb-5">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="py-3 px-3">Nama Pelanggan</th>
                        <th className="py-3 px-3">Nomor WhatsApp / HP</th>
                        <th className="py-3 px-3">Alamat / Lokasi</th>
                        <th className="py-3 px-3 text-center">Nota Belum Lunas</th>
                        <th className="py-3 px-3 text-right">Total Sisa Piutang</th>
                        <th className="py-3 px-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {receivablesLoading ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
                            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-1 text-indigo-600" />
                            <span>Memuat data pelanggan piutang...</span>
                          </td>
                        </tr>
                      ) : !receivablesData?.customers || receivablesData.customers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
                            Semua pelanggan tertib! Tidak ada saldo piutang aktif saat ini.
                          </td>
                        </tr>
                      ) : (
                        receivablesData.customers.map((c: any) => (
                          <tr
                            key={c.id}
                            className={`hover:bg-slate-50 transition-colors ${
                              selectedCustomerFilter === c.id ? "bg-indigo-50/70" : ""
                            }`}
                          >
                            <td className="py-3.5 px-3 font-extrabold text-slate-900">
                              {c.name}
                            </td>
                            <td className="py-3.5 px-3 font-mono text-slate-600">
                              {c.phone || "-"}
                            </td>
                            <td className="py-3.5 px-3 text-slate-500">
                              {c.address || "-"}
                            </td>
                            <td className="py-3.5 px-3 text-center font-bold text-rose-600">
                              <span className="px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700">
                                {c.unpaidCount} nota
                              </span>
                            </td>
                            <td className="py-3.5 px-3 text-right font-black text-rose-600 text-sm">
                              {formatRupiah(c.totalDebt)}
                            </td>
                            <td className="py-3.5 px-3 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedCustomerFilter(
                                    selectedCustomerFilter === c.id ? "" : c.id
                                  )
                                }
                                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-all"
                              >
                                {selectedCustomerFilter === c.id
                                  ? "✕ Lepas Filter"
                                  : "Filter Nota"}
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SECTION: DAFTAR RINCIAN NOTA PIUTANG / KREDIT */}
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden space-y-4">
                <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                      <FileText className="w-5 h-5 text-indigo-600" />
                      <span>Rincian Transaksi Nota Kredit & Bon Piutang</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Catatan transaksi penjualan dengan metode pembayaran Kredit / Nota
                    </p>
                  </div>

                  {/* Filter & Search */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Status Pill Toggle */}
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
                      <button
                        type="button"
                        onClick={() => setReceivablesStatusFilter("UNPAID")}
                        className={`px-3 py-1 rounded-lg font-bold transition-all ${
                          receivablesStatusFilter === "UNPAID"
                            ? "bg-white text-rose-700 shadow-sm"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        Belum Lunas
                      </button>
                      <button
                        type="button"
                        onClick={() => setReceivablesStatusFilter("ALL")}
                        className={`px-3 py-1 rounded-lg font-bold transition-all ${
                          receivablesStatusFilter === "ALL"
                            ? "bg-white text-indigo-700 shadow-sm"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        Semua Status
                      </button>
                      <button
                        type="button"
                        onClick={() => setReceivablesStatusFilter("PAID")}
                        className={`px-3 py-1 rounded-lg font-bold transition-all ${
                          receivablesStatusFilter === "PAID"
                            ? "bg-white text-emerald-700 shadow-sm"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        Lunas
                      </button>
                    </div>

                    {/* Search */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={receivablesSearch}
                        onChange={(e) => setReceivablesSearch(e.target.value)}
                        placeholder="Cari faktur / pelanggan..."
                        className="bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto px-5 pb-5">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="py-3 px-3">No. Faktur</th>
                        <th className="py-3 px-3">Waktu</th>
                        <th className="py-3 px-3">Pelanggan</th>
                        <th className="py-3 px-3 text-right">Total Tagihan</th>
                        <th className="py-3 px-3 text-right">Uang Muka (DP)</th>
                        <th className="py-3 px-3 text-right">Sisa Piutang</th>
                        <th className="py-3 px-3 text-center">Jatuh Tempo</th>
                        <th className="py-3 px-3 text-center">Status</th>
                        <th className="py-3 px-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {receivablesLoading ? (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-slate-400">
                            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-1 text-indigo-600" />
                            <span>Memuat daftar nota...</span>
                          </td>
                        </tr>
                      ) : !receivablesData?.invoices || receivablesData.invoices.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-slate-400">
                            Tidak ada nota kredit yang cocok dengan filter.
                          </td>
                        </tr>
                      ) : (
                        receivablesData.invoices.map((inv: any) => {
                          const isPaid = inv.paymentStatus === "PAID";
                          const isOverdue =
                            !isPaid && inv.dueDate && new Date(inv.dueDate) < new Date();

                          return (
                            <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                              <td className="py-3.5 px-3 font-mono font-bold text-slate-900">
                                {inv.invoiceNumber}
                              </td>
                              <td className="py-3.5 px-3 font-mono text-[11px] text-slate-500">
                                {new Date(inv.createdAt).toLocaleDateString("id-ID", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </td>
                              <td className="py-3.5 px-3">
                                <p className="font-extrabold text-slate-900">{inv.customerName}</p>
                                {inv.customerPhone && (
                                  <p className="text-[10px] text-slate-500 font-mono">
                                    {inv.customerPhone}
                                  </p>
                                )}
                              </td>
                              <td className="py-3.5 px-3 text-right font-bold text-slate-800">
                                {formatRupiah(inv.finalAmount)}
                              </td>
                              <td className="py-3.5 px-3 text-right text-slate-600 font-mono">
                                {formatRupiah(inv.cashGiven)}
                              </td>
                              <td className="py-3.5 px-3 text-right font-black text-rose-600 text-sm">
                                {formatRupiah(inv.remainingDebt)}
                              </td>
                              <td className="py-3.5 px-3 text-center">
                                {inv.dueDate ? (
                                  <span
                                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                                      isOverdue
                                        ? "bg-rose-100 text-rose-700 border border-rose-200"
                                        : "bg-slate-100 text-slate-700"
                                    }`}
                                  >
                                    {new Date(inv.dueDate).toLocaleDateString("id-ID", {
                                      day: "numeric",
                                      month: "short",
                                    })}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )}
                              </td>
                              <td className="py-3.5 px-3 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                    isPaid
                                      ? "bg-emerald-100 text-emerald-800"
                                      : inv.paymentStatus === "PARTIAL"
                                      ? "bg-amber-100 text-amber-800"
                                      : "bg-rose-100 text-rose-800"
                                  }`}
                                >
                                  {isPaid
                                    ? "LUNAS"
                                    : inv.paymentStatus === "PARTIAL"
                                    ? "SEBAGIAN"
                                    : "BELUM LUNAS"}
                                </span>
                              </td>
                              <td className="py-3.5 px-3 text-right">
                                {!isPaid ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedSettleSale(inv);
                                      setIsSettleModalOpen(true);
                                    }}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                                  >
                                    Pelunasan
                                  </button>
                                ) : (
                                  <span className="text-emerald-600 font-bold text-xs flex items-center justify-end gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Lunas
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL CATAT PENGELUARAN */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Catat Beban Pengeluaran Baru</h3>
                <p className="text-xs text-slate-400 mt-0.5">Biaya operasional kasir atau toko</p>
              </div>
              <button
                onClick={() => setIsExpenseModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kategori Pengeluaran
                </label>
                <select
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="OPERATIONAL">Operasional Toko & Konsumsi</option>
                  <option value="ELECTRICITY">Listrik & Air (Utilitas)</option>
                  <option value="INTERNET">Internet & WiFi</option>
                  <option value="RENT">Sewa Tempat / Kios</option>
                  <option value="TRANSPORT">Transportasi & Pengambilan Barang</option>
                  <option value="SALARY">Gaji & Upah</option>
                  <option value="OTHER">Lain-lain</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Deskripsi / Keperluan
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Beli token listrik toko 100k"
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Jumlah Biaya (Rp)
                </label>
                <input
                  type="number"
                  required
                  min={100}
                  placeholder="0"
                  value={expenseForm.amount || ""}
                  onChange={(e) =>
                    setExpenseForm({ ...expenseForm, amount: Number(e.target.value) })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-extrabold focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Catatan Tambahan (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Keterangan pendukung..."
                  value={expenseForm.notes}
                  onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={expenseLoading}
                  className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow disabled:opacity-50"
                >
                  {expenseLoading ? "Menyimpan..." : "Simpan Pengeluaran"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PELUNASAN PIUTANG */}
      {isSettleModalOpen && selectedSettleSale && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">Pelunasan Piutang Nota</h3>
                  <p className="text-xs text-slate-400 font-mono">{selectedSettleSale.invoiceNumber}</p>
                </div>
              </div>
              <button
                onClick={() => setIsSettleModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSettleSale} className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Nama Pelanggan:</span>
                  <span className="font-extrabold text-slate-900">{selectedSettleSale.customerName}</span>
                </div>
                {selectedSettleSale.customerPhone && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">No. WhatsApp/HP:</span>
                    <span className="font-mono text-slate-700">{selectedSettleSale.customerPhone}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-1.5 font-bold">
                  <span className="text-slate-700">Total Tagihan:</span>
                  <span>{formatRupiah(selectedSettleSale.finalAmount)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Sudah Dibayar (DP):</span>
                  <span>{formatRupiah(selectedSettleSale.cashGiven)}</span>
                </div>
                <div className="flex justify-between text-rose-600 font-black text-sm border-t border-dashed border-rose-200 pt-1.5">
                  <span>Sisa Wajib Dibayar:</span>
                  <span>{formatRupiah(selectedSettleSale.remainingDebt)}</span>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Metode Pembayaran Pelunasan
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSettlePaidMethod("CASH")}
                    className={`py-2 px-1 rounded-xl text-xs font-bold border flex flex-col items-center gap-1 transition-all ${
                      settlePaidMethod === "CASH"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-800 shadow-sm"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Banknote className="w-4 h-4" />
                    <span>Tunai</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSettlePaidMethod("TRANSFER")}
                    className={`py-2 px-1 rounded-xl text-xs font-bold border flex flex-col items-center gap-1 transition-all ${
                      settlePaidMethod === "TRANSFER"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-800 shadow-sm"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Transfer</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSettlePaidMethod("QRIS")}
                    className={`py-2 px-1 rounded-xl text-xs font-bold border flex flex-col items-center gap-1 transition-all ${
                      settlePaidMethod === "QRIS"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-800 shadow-sm"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <QrCode className="w-4 h-4" />
                    <span>QRIS</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Catatan Pelunasan (Opsional)
                </label>
                <input
                  type="text"
                  value={settleNotes}
                  onChange={(e) => setSettleNotes(e.target.value)}
                  placeholder="Contoh: Diterima lunas di konter"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsSettleModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={settleLoading}
                  className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow disabled:opacity-50 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{settleLoading ? "Memproses..." : "Konfirmasi Pelunasan"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

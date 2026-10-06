"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  History,
  Search,
  Calendar,
  CreditCard,
  Banknote,
  QrCode,
  Printer,
  Eye,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Receipt,
  CheckCircle2,
  AlertCircle,
  X,
  Layers,
  Filter,
  ArrowUpDown,
  SmartphoneNfc,
  ShoppingCart,
  Phone,
  Cable,
  Bluetooth,
} from "lucide-react";
import { formatRupiah } from "@/lib/calculations";
import {
  printerManager,
  buildSaleReceiptBuffer,
  PrintSaleData,
} from "@/lib/bluetoothPrinter";
import { AuthSession } from "@/types";

interface TransactionItem {
  id: string;
  itemType?: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  costPrice?: number;
  profit?: number;
}

interface TransactionRecord {
  id: string;
  trxType: "POS" | "DIGITAL";
  invoiceNumber: string;
  createdAt: string | Date;
  destinationNumber?: string | null;
  productName?: string | null;
  totalAmount: number;
  discount: number;
  finalAmount: number;
  paymentMethod: string;
  cashGiven?: number;
  changeGiven?: number;
  notes?: string | null;
  status?: string;
  itemsCount?: number;
  cashier?: {
    id: string;
    name: string;
    username: string;
  } | null;
  rawItems: TransactionItem[];
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface SummaryMeta {
  totalCount: number;
  totalRevenue: number;
  totalDiscount: number;
  cashAmount: number;
  transferAmount: number;
  qrisAmount: number;
}

interface TransactionsClientProps {
  user: AuthSession;
  storeSetting: {
    id?: string;
    name: string;
    tagline?: string | null;
    address?: string | null;
    phone?: string | null;
    receiptFooter?: string | null;
    printCopies: number;
    paperWidth: "58mm" | "80mm" | string;
    autoPrint: boolean;
  };
}

// Helper to format Date to YYYY-MM-DD
function formatDateToInput(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function TransactionsClient({ user, storeSetting }: TransactionsClientProps) {
  // Query Filters State
  const [trxType, setTrxType] = useState<"POS" | "DIGITAL">("POS");
  const [paymentMethod, setPaymentMethod] = useState<string>("ALL");
  const [search, setSearch] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");

  // Date Range Presets: today, yesterday, 7days, 30days, thisMonth, all, custom
  const [datePreset, setDatePreset] = useState<string>("today");
  const [startDate, setStartDate] = useState<string>(formatDateToInput(new Date()));
  const [endDate, setEndDate] = useState<string>(formatDateToInput(new Date()));

  // Pagination State
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);

  // Data & Summary State
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  });
  const [summary, setSummary] = useState<SummaryMeta>({
    totalCount: 0,
    totalRevenue: 0,
    totalDiscount: 0,
    cashAmount: 0,
    transferAmount: 0,
    qrisAmount: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Detail Modal & Thermal Reprint State
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionRecord | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [isPrinterModalOpen, setIsPrinterModalOpen] = useState<boolean>(false);
  const [printing, setPrinting] = useState<boolean>(false);
  const [printFeedback, setPrintFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [printerConnected, setPrinterConnected] = useState<boolean>(false);
  const [paperWidth, setPaperWidth] = useState<"58mm" | "80mm">(
    (storeSetting.paperWidth as any) === "80mm" ? "80mm" : "58mm"
  );

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to page 1 on search change
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Check printer auto connection on mount
  useEffect(() => {
    printerManager.tryAutoConnect().then((res) => {
      if (res.success) {
        setPrinterConnected(true);
      }
    });
  }, []);

  // Handle Date Preset Changes
  const applyDatePreset = (preset: string) => {
    setDatePreset(preset);
    setPage(1);
    const now = new Date();

    if (preset === "today") {
      const todayStr = formatDateToInput(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === "yesterday") {
      const y = new Date();
      y.setDate(now.getDate() - 1);
      const yStr = formatDateToInput(y);
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (preset === "7days") {
      const past = new Date();
      past.setDate(now.getDate() - 6);
      setStartDate(formatDateToInput(past));
      setEndDate(formatDateToInput(now));
    } else if (preset === "30days") {
      const past = new Date();
      past.setDate(now.getDate() - 29);
      setStartDate(formatDateToInput(past));
      setEndDate(formatDateToInput(now));
    } else if (preset === "thisMonth") {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(formatDateToInput(firstDay));
      setEndDate(formatDateToInput(now));
    } else if (preset === "all") {
      setStartDate("");
      setEndDate("");
    }
  };

  // Fetch Transactions API
  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      params.set("type", trxType);

      if (paymentMethod !== "ALL") {
        params.set("paymentMethod", paymentMethod);
      }

      if (debouncedSearch.trim()) {
        params.set("search", debouncedSearch.trim());
      }

      if (startDate) {
        params.set("startDate", startDate);
      }

      if (endDate) {
        params.set("endDate", endDate);
      }

      const res = await fetch(`/api/transactions?${params.toString()}`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Gagal memuat riwayat transaksi");
      }

      setTransactions(json.data || []);
      setPagination(
        json.pagination || {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        }
      );
      setSummary(
        json.summary || {
          totalCount: 0,
          totalRevenue: 0,
          totalDiscount: 0,
          cashAmount: 0,
          transferAmount: 0,
          qrisAmount: 0,
        }
      );
    } catch (err: any) {
      console.error("fetchTransactions error:", err);
      setError(err.message || "Gagal memuat data transaksi.");
    } finally {
      setLoading(false);
    }
  }, [page, limit, trxType, paymentMethod, debouncedSearch, startDate, endDate]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Handle 1-Click Thermal Receipt Reprint
  const handleReprintThermal = async (trx: TransactionRecord) => {
    if (!trx) return;

    if (!printerManager.isConnected()) {
      setIsPrinterModalOpen(true);
      return;
    }

    setPrinting(true);
    setPrintFeedback(null);

    try {
      const printData: PrintSaleData = {
        invoiceNumber: trx.invoiceNumber,
        createdAt: trx.createdAt,
        cashierName: trx.cashier?.name || user.name,
        paymentMethod: trx.paymentMethod || "CASH",
        totalAmount: trx.totalAmount,
        discount: trx.discount || 0,
        finalAmount: trx.finalAmount,
        cashGiven: trx.cashGiven || trx.finalAmount,
        changeGiven: trx.changeGiven || 0,
        items: (trx.rawItems || []).map((it) => ({
          itemName: it.itemName,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          subtotal: it.subtotal,
        })),
      };

      const buffer = buildSaleReceiptBuffer(printData, paperWidth, storeSetting);
      const copies = storeSetting.printCopies || 1;

      for (let i = 0; i < copies; i++) {
        const res = await printerManager.print(buffer);
        if (!res.success) {
          throw new Error(res.error || "Gagal mengirim data cetak ke printer.");
        }
      }

      setPrinterConnected(true);
      setPrintFeedback({
        type: "success",
        text: `Struk #${trx.invoiceNumber} (${copies}x rangkap) berhasil dicetak ulang!`,
      });
      setTimeout(() => setPrintFeedback(null), 4000);
    } catch (err: any) {
      setPrintFeedback({ type: "error", text: err.message || "Gagal mencetak ulang struk." });
    } finally {
      setPrinting(false);
    }
  };

  const openDetailModal = (trx: TransactionRecord) => {
    setSelectedTransaction(trx);
    setIsDetailModalOpen(true);
    setPrintFeedback(null);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 mb-1">
            <History className="w-6 h-6" />
            <span className="text-xs font-bold uppercase tracking-wider bg-indigo-50 px-2.5 py-0.5 rounded-full">
              Audit & Penjualan
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Riwayat Transaksi
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Pencatatan faktur penjualan kasir & transaksi digital dengan filter tanggal, metode bayar, dan cetak ulang struk.
          </p>
        </div>

        {/* Refresh button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchTransactions()}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 rounded-2xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-600" : ""}`} />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {/* Top Quick Tabs: POS vs Digital */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          onClick={() => {
            setTrxType("POS");
            setPage(1);
          }}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
            trxType === "POS"
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>Penjualan Kasir (POS)</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] ${
              trxType === "POS" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            {trxType === "POS" ? summary.totalCount : "POS"}
          </span>
        </button>

        <button
          onClick={() => {
            setTrxType("DIGITAL");
            setPage(1);
          }}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
            trxType === "DIGITAL"
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <SmartphoneNfc className="w-4 h-4" />
          <span>Transaksi Produk Digital</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] ${
              trxType === "DIGITAL" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            {trxType === "DIGITAL" ? summary.totalCount : "Digital"}
          </span>
        </button>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Transaksi */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Transaksi
            </span>
            <div className="w-9 h-9 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-slate-900">
              {summary.totalCount.toLocaleString("id-ID")}
            </span>
            <span className="text-xs text-slate-400 ml-1 font-semibold">Nota/Trx</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Sesuai rentang filter aktif</p>
        </div>

        {/* Card 2: Total Nilai / Omzet */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Omzet / Nilai
            </span>
            <div className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xl sm:text-2xl font-black text-emerald-700">
              {formatRupiah(summary.totalRevenue)}
            </span>
          </div>
          {summary.totalDiscount > 0 && (
            <p className="text-[11px] text-rose-500 font-medium mt-1">
              Diskon Diberikan: {formatRupiah(summary.totalDiscount)}
            </p>
          )}
        </div>

        {/* Card 3: Tunai (CASH) */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Pembayaran Tunai (CASH)
            </span>
            <div className="w-9 h-9 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center">
              <Banknote className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xl sm:text-2xl font-black text-slate-900">
              {formatRupiah(summary.cashAmount)}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Uang fisik di laci kasir</p>
        </div>

        {/* Card 4: Non-Tunai (QRIS & Transfer) */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Non-Tunai (QRIS/Bank)
            </span>
            <div className="w-9 h-9 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center">
              <QrCode className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xl sm:text-2xl font-black text-purple-900">
              {formatRupiah(summary.transferAmount + summary.qrisAmount)}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            QRIS: {formatRupiah(summary.qrisAmount)} | Transfer: {formatRupiah(summary.transferAmount)}
          </p>
        </div>
      </div>

      {/* Filter Control Box */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
        {/* Row 1: Search & Payment Method Filter */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search Bar */}
          <div className="md:col-span-7 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari no. faktur, nama pelanggan, kasir, atau produk..."
              className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-1"
              >
                ✕
              </button>
            )}
          </div>

          {/* Payment Method Selector (For POS) */}
          <div className="md:col-span-5">
            {trxType === "POS" ? (
              <div className="flex items-center gap-1.5 bg-slate-50 p-1 border border-slate-200 rounded-2xl text-xs">
                <span className="text-[11px] text-slate-400 pl-2 font-bold flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Metode:</span>
                </span>
                <button
                  onClick={() => {
                    setPaymentMethod("ALL");
                    setPage(1);
                  }}
                  className={`flex-1 py-1.5 rounded-xl font-bold transition-all text-center ${
                    paymentMethod === "ALL"
                      ? "bg-white text-slate-900 shadow-sm border border-slate-200/60"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  Semua
                </button>
                <button
                  onClick={() => {
                    setPaymentMethod("CASH");
                    setPage(1);
                  }}
                  className={`flex-1 py-1.5 rounded-xl font-bold transition-all text-center ${
                    paymentMethod === "CASH"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  Tunai
                </button>
                <button
                  onClick={() => {
                    setPaymentMethod("QRIS");
                    setPage(1);
                  }}
                  className={`flex-1 py-1.5 rounded-xl font-bold transition-all text-center ${
                    paymentMethod === "QRIS"
                      ? "bg-purple-600 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  QRIS
                </button>
                <button
                  onClick={() => {
                    setPaymentMethod("TRANSFER");
                    setPage(1);
                  }}
                  className={`flex-1 py-1.5 rounded-xl font-bold transition-all text-center ${
                    paymentMethod === "TRANSFER"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  Transfer
                </button>
              </div>
            ) : (
              <div className="p-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-500 flex items-center gap-2">
                <SmartphoneNfc className="w-4 h-4 text-indigo-600" />
                <span>Transaksi digital tercatat secara otomatis</span>
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Date Filter Presets & Custom Date Range */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          {/* Quick Date Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-400 mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>Periode:</span>
            </span>

            {[
              { key: "today", label: "Hari Ini" },
              { key: "yesterday", label: "Kemarin" },
              { key: "7days", label: "7 Hari" },
              { key: "30days", label: "30 Hari" },
              { key: "thisMonth", label: "Bulan Ini" },
              { key: "all", label: "Semua Waktu" },
            ].map((p) => (
              <button
                key={p.key}
                onClick={() => applyDatePreset(p.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  datePreset === p.key
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom Date Pickers */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Dari:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDatePreset("custom");
                  setPage(1);
                }}
                className="bg-transparent border-none text-slate-800 text-xs font-semibold focus:outline-none cursor-pointer"
              />
            </div>
            <span className="text-slate-300 text-xs font-bold">-</span>
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Sampai:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDatePreset("custom");
                  setPage(1);
                }}
                className="bg-transparent border-none text-slate-800 text-xs font-semibold focus:outline-none cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Global Feedback Banner */}
      {printFeedback && (
        <div
          className={`p-4 rounded-2xl border text-xs flex items-center justify-between ${
            printFeedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {printFeedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-semibold">{printFeedback.text}</span>
          </div>
          <button
            onClick={() => setPrintFeedback(null)}
            className="text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Transactions Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        {error && (
          <div className="p-4 bg-rose-50 border-b border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-4">No. Faktur / Trx</th>
                <th className="py-3.5 px-4">Waktu Transaksi</th>
                <th className="py-3.5 px-4">Kasir</th>
                <th className="py-3.5 px-4">Kategori / Tujuan</th>
                <th className="py-3.5 px-4">Rincian Item</th>
                <th className="py-3.5 px-4">Metode Bayar</th>
                <th className="py-3.5 px-4 text-right">Total Tagihan</th>
                <th className="py-3.5 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin" />
                      <span className="font-semibold">Memuat riwayat transaksi...</span>
                    </div>
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Receipt className="w-10 h-10 text-slate-300" />
                      <p className="font-bold text-slate-700">Tidak ada transaksi ditemukan</p>
                      <p className="text-xs text-slate-400 max-w-sm">
                        Coba ubah rentang tanggal, filter metode pembayaran, atau kata kunci pencarian Anda.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                transactions.map((trx) => {
                  const date = new Date(trx.createdAt);
                  const dateStr = date.toLocaleDateString("id-ID", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  });
                  const timeStr = date.toLocaleTimeString("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <tr
                      key={trx.id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* Faktur Number */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="text-indigo-600">#</span>
                          <span>{trx.invoiceNumber}</span>
                        </div>
                      </td>

                      {/* Date & Time */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-medium text-slate-900">{dateStr}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{timeStr} WIB</div>
                      </td>

                      {/* Cashier */}
                      <td className="py-3.5 px-4 font-medium text-slate-700 whitespace-nowrap">
                        {trx.cashier?.name || "Kasir"}
                      </td>

                      {/* Category / Destination */}
                      <td className="py-3.5 px-4">
                        {trx.destinationNumber ? (
                          <div className="text-xs text-indigo-700 font-mono font-bold flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            <span>{trx.destinationNumber}</span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-600 font-semibold bg-slate-100 px-2 py-0.5 rounded-md">
                            Kasir POS
                          </span>
                        )}
                      </td>

                      {/* Items Summary */}
                      <td className="py-3.5 px-4">
                        {trx.rawItems && trx.rawItems.length > 0 ? (
                          <div className="max-w-[200px] truncate text-slate-600" title={trx.rawItems.map(i => `${i.itemName} (x${i.quantity})`).join(", ")}>
                            <span className="font-medium text-slate-800">
                              {trx.rawItems[0]?.itemName}
                            </span>
                            {trx.rawItems.length > 1 && (
                              <span className="text-[10px] text-slate-400 ml-1 font-bold">
                                +{trx.rawItems.length - 1} item lain
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Payment Method Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {trx.paymentMethod === "CASH" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold">
                            <Banknote className="w-3 h-3" />
                            <span>TUNAI</span>
                          </span>
                        ) : trx.paymentMethod === "QRIS" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-extrabold">
                            <QrCode className="w-3 h-3" />
                            <span>QRIS</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-extrabold">
                            <CreditCard className="w-3 h-3" />
                            <span>TRANSFER</span>
                          </span>
                        )}
                      </td>

                      {/* Total Amount */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap font-extrabold text-slate-900">
                        {formatRupiah(trx.finalAmount)}
                        {trx.discount > 0 && (
                          <div className="text-[10px] text-rose-500 font-semibold">
                            Hemat {formatRupiah(trx.discount)}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Detail Button */}
                          <button
                            type="button"
                            onClick={() => openDetailModal(trx)}
                            title="Lihat Nota & Rincian"
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 rounded-xl transition-all cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Reprint Thermal Receipt Button */}
                          <button
                            type="button"
                            onClick={() => handleReprintThermal(trx)}
                            disabled={printing}
                            title="Cetak Ulang Struk Thermal (1-Klik)"
                            className="p-1.5 bg-indigo-50 hover:bg-indigo-100 active:scale-95 text-indigo-700 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-slate-100 bg-slate-50/50">
          {/* Info: Showing X to Y of Z */}
          <div className="text-xs text-slate-500 font-medium">
            Menampilkan{" "}
            <span className="font-bold text-slate-800">
              {pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1}
            </span>{" "}
            -{" "}
            <span className="font-bold text-slate-800">
              {Math.min(pagination.page * pagination.limit, pagination.total)}
            </span>{" "}
            dari <span className="font-bold text-slate-800">{pagination.total}</span> transaksi
          </div>

          {/* Limit and Page navigation */}
          <div className="flex items-center gap-3">
            {/* Limit Selector */}
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <span>Per Halaman:</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-white border border-slate-200 rounded-xl px-2 py-1 font-bold text-slate-700 text-xs focus:outline-none cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>

            {/* Prev & Next Buttons */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={!pagination.hasPrev || loading}
                className="p-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-3 py-1 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 shadow-sm">
                Halaman {pagination.page} / {pagination.totalPages || 1}
              </span>

              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={!pagination.hasNext || loading}
                className="p-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* DETAIL TRANSAKSI & STRUK MODAL */}
      {isDetailModalOpen && selectedTransaction && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            {/* Modal Top Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Rincian Transaksi</h3>
                <p className="text-xs text-slate-400 font-mono">#{selectedTransaction.invoiceNumber}</p>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 font-bold transition-all"
              >
                ✕
              </button>
            </div>

            {/* Print Feedback inside modal */}
            {printFeedback && (
              <div
                className={`p-3 rounded-2xl text-xs flex items-center gap-2 ${
                  printFeedback.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-rose-50 text-rose-800 border border-rose-200"
                }`}
              >
                {printFeedback.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{printFeedback.text}</span>
              </div>
            )}

            {/* Visual Thermal Receipt Preview */}
            <div
              id="printable-receipt"
              className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs font-mono space-y-2 text-slate-700"
            >
              {/* Receipt Store Header */}
              <div className="text-center pb-2 border-b border-dashed border-slate-300">
                <p className="font-bold text-sm text-slate-900">{storeSetting.name}</p>
                {storeSetting.tagline && (
                  <p className="text-[10px] text-slate-600 font-semibold">{storeSetting.tagline}</p>
                )}
                {storeSetting.address && (
                  <p className="text-[10px] text-slate-500">{storeSetting.address}</p>
                )}
                {storeSetting.phone && (
                  <p className="text-[10px] text-slate-500">Telp/WA: {storeSetting.phone}</p>
                )}
                <p className="text-[10px] text-slate-500 font-bold mt-1">
                  {selectedTransaction.invoiceNumber}
                </p>
              </div>

              {/* Transaction Metadata */}
              <div className="flex justify-between text-[11px]">
                <span>Kasir: {selectedTransaction.cashier?.name || user.name}</span>
                <span>
                  {new Date(selectedTransaction.createdAt).toLocaleDateString("id-ID", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}{" "}
                  {new Date(selectedTransaction.createdAt).toLocaleTimeString("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>

              {/* Items List */}
              <div className="py-2 border-y border-dashed border-slate-300 space-y-1.5">
                {selectedTransaction.rawItems?.map((item, idx) => (
                  <div key={idx} className="space-y-0.5">
                    <div className="font-bold text-slate-800">{item.itemName}</div>
                    <div className="flex justify-between text-[11px] text-slate-600">
                      <span>
                        {item.quantity} x {formatRupiah(item.unitPrice)}
                      </span>
                      <span className="font-bold text-slate-900">{formatRupiah(item.subtotal)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals Calculation */}
              <div className="space-y-1 pt-1 text-[11px]">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{formatRupiah(selectedTransaction.totalAmount)}</span>
                </div>
                {selectedTransaction.discount > 0 && (
                  <div className="flex justify-between text-rose-600 font-semibold">
                    <span>Diskon:</span>
                    <span>-{formatRupiah(selectedTransaction.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-xs text-slate-900 pt-1 border-t border-slate-200">
                  <span>TOTAL BAYAR:</span>
                  <span>{formatRupiah(selectedTransaction.finalAmount)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Metode: {selectedTransaction.paymentMethod}</span>
                  <span>
                    Bayar: {formatRupiah(selectedTransaction.cashGiven || selectedTransaction.finalAmount)}
                  </span>
                </div>
                {selectedTransaction.paymentMethod === "CASH" && (
                  <div className="flex justify-between font-bold text-emerald-700">
                    <span>Kembalian:</span>
                    <span>{formatRupiah(selectedTransaction.changeGiven || 0)}</span>
                  </div>
                )}
              </div>

              {/* Footer Note */}
              <div className="text-center pt-2 text-[10px] text-slate-500 border-t border-dashed border-slate-300 whitespace-pre-line leading-tight">
                {storeSetting.receiptFooter || "Terima kasih atas kunjungan Anda!\nBarang yang dibeli tidak dapat ditukar/dikembalikan."}
              </div>
            </div>

            {/* Paper Width & Printer Status Selector */}
            <div className="flex items-center justify-between px-1 text-xs">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <span
                  className={`w-2 h-2 rounded-full ${
                    printerConnected ? "bg-emerald-500" : "bg-slate-300"
                  }`}
                ></span>
                <span className="truncate max-w-[160px] font-semibold">
                  {printerConnected ? "Printer Siap Cetak" : "Printer Belum Terhubung"}
                </span>
              </div>
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setPaperWidth("58mm")}
                  className={`px-1.5 py-0.5 rounded ${
                    paperWidth === "58mm" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                  }`}
                >
                  58mm
                </button>
                <button
                  type="button"
                  onClick={() => setPaperWidth("80mm")}
                  className={`px-1.5 py-0.5 rounded ${
                    paperWidth === "80mm" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                  }`}
                >
                  80mm
                </button>
              </div>
            </div>

            {/* Print Action Buttons */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => handleReprintThermal(selectedTransaction)}
                disabled={printing}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white rounded-2xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 transition-all cursor-pointer disabled:opacity-50"
              >
                <Printer className={`w-4 h-4 ${printing ? "animate-pulse" : ""}`} />
                <span>
                  {printing
                    ? "Mengirim ke Printer..."
                    : `Cetak Ulang Struk Thermal (${storeSetting.printCopies}x Rangkap)`}
                </span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Dialog Browser</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsDetailModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TransactionsClient;

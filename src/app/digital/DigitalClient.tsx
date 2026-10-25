"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  SmartphoneNfc,
  Plus,
  Trash2,
  Search,
  CheckCircle2,
  Calendar,
  Sparkles,
  ArrowRight,
  Receipt,
  X,
  Megaphone,
  Edit3,
  AlertTriangle,
  RefreshCw,
  Clock,
  FileSpreadsheet,
} from "lucide-react";

export interface DigitalTransaction {
  id: string;
  trxNumber: string;
  digitalProductId: string;
  destinationNumber: string;
  costPrice: number;
  sellingPrice: number;
  profit: number;
  paymentMethod: string;
  status: string;
  notes?: string | null;
  createdAt: string;
  digitalProduct: {
    id: string;
    category: string;
    provider: string;
    name: string;
  };
  cashier?: {
    id: string;
    name: string;
  } | null;
}

interface DigitalClientProps {
  initialTypes: string[];
  initialTransactions: DigitalTransaction[];
  cashierName?: string;
  userRole?: string;
}

function formatRupiah(amount: number): string {
  return "Rp " + (amount || 0).toLocaleString("id-ID");
}

const getTodayString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getYesterdayString = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatIndoDate = (dateStr: string) => {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    return d.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }
  return dateStr;
};

const DEFAULT_TYPES = ["TOP-UP", "PULSA", "TAGIHAN"];
const NOMINAL_QUICK_CHIPS = [10000, 20000, 50000, 100000, 200000, 500000];
const ADMIN_QUICK_CHIPS = [1000, 2000, 2500, 3000, 5000];

export default function DigitalClient({
  initialTypes,
  initialTransactions,
  cashierName,
  userRole = "CASHIER",
}: DigitalClientProps) {
  // Types state
  const [types, setTypes] = useState<string[]>(initialTypes);
  const [selectedType, setSelectedType] = useState<string>(initialTypes[0] || "TOP-UP");

  // Date selection state (Mode Rekap Mundur / Tanggal Lampau)
  const [selectedRecordDate, setSelectedRecordDate] = useState<string>(getTodayString);
  const [viewMode, setViewMode] = useState<"DATE" | "ALL">("DATE");
  const [fetching, setFetching] = useState<boolean>(false);

  // Form state
  const [nominal, setNominal] = useState<string>("");
  const [adminFee, setAdminFee] = useState<string>("2000");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "QRIS">("CASH");
  const [notes, setNotes] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Transactions state
  const [transactions, setTransactions] = useState<DigitalTransaction[]>(initialTransactions);
  const [activeTab, setActiveTab] = useState<"SUMMARY" | "DETAILS">("SUMMARY");
  const [summaryPaymentFilter, setSummaryPaymentFilter] = useState<"ALL" | "CASH" | "QRIS">("ALL");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("ALL");
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>("ALL");

  // Modal tambah jenis transaksi
  const [isAddTypeOpen, setIsAddTypeOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [typeLoading, setTypeLoading] = useState(false);

  // Modal Koreksi Transaksi Digital
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [selectedCorrectionTrx, setSelectedCorrectionTrx] = useState<DigitalTransaction | null>(null);
  const [correctionForm, setCorrectionForm] = useState({
    category: "TOP-UP",
    nominal: "",
    adminFee: "2000",
    paymentMethod: "CASH" as "CASH" | "QRIS",
    destinationNumber: "",
    notes: "",
    date: getTodayString(),
    time: "12:00",
    status: "SUCCESS",
  });
  const [correctionLoading, setCorrectionLoading] = useState(false);

  // Modal Pembatalan / Hapus Transaksi Digital
  const [trxToDelete, setTrxToDelete] = useState<DigitalTransaction | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Export Excel State & Handler
  const [exportLoading, setExportLoading] = useState(false);

  const handleExportExcel = async () => {
    setExportLoading(true);
    try {
      let query = "";
      if (viewMode === "DATE") {
        query = `?startDate=${selectedRecordDate}&endDate=${selectedRecordDate}`;
      }
      const res = await fetch(`/api/reports/export${query}`);
      if (!res.ok) throw new Error("Gagal mengunduh laporan Excel");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Laporan_Digital_${viewMode === "DATE" ? selectedRecordDate : "Semua_Data"}.xlsx`;
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

  // Function to refresh transactions from backend
  const refreshTransactionsData = async (dateParam = selectedRecordDate, mode = viewMode) => {
    try {
      setFetching(true);
      let url = "/api/digital/transactions";
      if (mode === "ALL") {
        url += "?limit=300";
      } else {
        url += `?date=${dateParam}&limit=500`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (data.transactions) {
        setTransactions(data.transactions);
      }
    } catch (err) {
      console.error("Gagal mengambil data transaksi digital:", err);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    refreshTransactionsData(selectedRecordDate, viewMode);
  }, [selectedRecordDate, viewMode]);

  // Calculate numbers for active form
  const numNominal = parseFloat(nominal.replace(/[^0-9]/g, "")) || 0;
  const numAdminFee = parseFloat(adminFee.replace(/[^0-9]/g, "")) || 0;
  const totalCustomerPay = numNominal + numAdminFee;

  // Filter transactions based on date selection
  const dateFilteredTransactions = useMemo(() => {
    if (viewMode === "ALL") return transactions;

    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    return transactions.filter((t) => {
      const trxDateStr = formatter.format(new Date(t.createdAt));
      return trxDateStr === selectedRecordDate;
    });
  }, [transactions, viewMode, selectedRecordDate]);

  // Aggregate breakdown per Jenis Transaksi for the Rekap table
  const summaryByType = useMemo(() => {
    const map: Record<
      string,
      {
        count: number;
        totalNominal: number;
        totalAdmin: number;
        cashCount: number;
        cashTotal: number;
        qrisCount: number;
        qrisTotal: number;
      }
    > = {};

    // Initialize all active types
    types.forEach((t) => {
      map[t.toUpperCase()] = {
        count: 0,
        totalNominal: 0,
        totalAdmin: 0,
        cashCount: 0,
        cashTotal: 0,
        qrisCount: 0,
        qrisTotal: 0,
      };
    });

    dateFilteredTransactions.forEach((trx) => {
      // Only include successful or non-refunded in revenue/profit
      const isCountable = trx.status !== "FAILED" && trx.status !== "REFUNDED";
      const cat = (trx.digitalProduct?.category || "LAINNYA").toUpperCase();
      const method = (trx.paymentMethod || "CASH").toUpperCase();

      if (!map[cat]) {
        map[cat] = {
          count: 0,
          totalNominal: 0,
          totalAdmin: 0,
          cashCount: 0,
          cashTotal: 0,
          qrisCount: 0,
          qrisTotal: 0,
        };
      }

      const nominalVal = trx.costPrice > 0 ? trx.costPrice : Math.max(0, (trx.sellingPrice || 0) - (trx.profit || 0));
      const adminVal = trx.profit || 0;
      const customerPayVal = trx.sellingPrice || (nominalVal + adminVal);

      if (summaryPaymentFilter === "ALL" || summaryPaymentFilter === method) {
        map[cat].count += 1;
        if (isCountable) {
          map[cat].totalNominal += nominalVal;
          map[cat].totalAdmin += adminVal;
          if (method === "QRIS") {
            map[cat].qrisCount += 1;
            map[cat].qrisTotal += customerPayVal;
          } else {
            map[cat].cashCount += 1;
            map[cat].cashTotal += customerPayVal;
          }
        }
      }
    });

    return map;
  }, [types, dateFilteredTransactions, summaryPaymentFilter]);

  // Overall totals
  const overallTotals = useMemo(() => {
    let count = 0;
    let totalNominal = 0;
    let totalAdmin = 0;
    let cashCount = 0;
    let cashTotal = 0;
    let qrisCount = 0;
    let qrisTotal = 0;

    dateFilteredTransactions.forEach((trx) => {
      const isCountable = trx.status !== "FAILED" && trx.status !== "REFUNDED";
      const nominalVal = trx.costPrice > 0 ? trx.costPrice : Math.max(0, (trx.sellingPrice || 0) - (trx.profit || 0));
      const adminVal = trx.profit || 0;
      const customerPayVal = trx.sellingPrice || (nominalVal + adminVal);
      const method = (trx.paymentMethod || "CASH").toUpperCase();

      if (summaryPaymentFilter === "ALL" || summaryPaymentFilter === method) {
        count += 1;
        if (isCountable) {
          totalNominal += nominalVal;
          totalAdmin += adminVal;
        }
      }

      if (isCountable) {
        if (method === "QRIS") {
          qrisCount += 1;
          qrisTotal += customerPayVal;
        } else {
          cashCount += 1;
          cashTotal += customerPayVal;
        }
      }
    });

    return {
      count,
      totalNominal,
      totalAdmin,
      cashCount,
      cashTotal,
      qrisCount,
      qrisTotal,
    };
  }, [dateFilteredTransactions, summaryPaymentFilter]);

  // Filtered list for "Detail Transaksi" tab
  const filteredDetails = useMemo(() => {
    return dateFilteredTransactions.filter((t) => {
      const catMatch =
        filterType === "ALL" ||
        t.digitalProduct?.category?.toUpperCase() === filterType.toUpperCase();

      if (!catMatch) return false;

      const methodMatch =
        filterPaymentMethod === "ALL" ||
        (t.paymentMethod || "CASH").toUpperCase() === filterPaymentMethod.toUpperCase();

      if (!methodMatch) return false;

      if (!search.trim()) return true;

      const q = search.toLowerCase();
      return (
        t.trxNumber.toLowerCase().includes(q) ||
        (t.destinationNumber && t.destinationNumber.toLowerCase().includes(q)) ||
        (t.notes && t.notes.toLowerCase().includes(q)) ||
        (t.digitalProduct?.category && t.digitalProduct.category.toLowerCase().includes(q)) ||
        (t.cashier?.name && t.cashier.name.toLowerCase().includes(q))
      );
    });
  }, [dateFilteredTransactions, filterType, filterPaymentMethod, search]);

  // Handle create transaction (with support for past date recording)
  const handleSubmitTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numNominal <= 0) {
      setErrorMessage("Nominal transaksi wajib diisi lebih dari 0");
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch("/api/digital/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: selectedType,
          nominal: numNominal,
          adminFee: numAdminFee,
          paymentMethod: paymentMethod,
          notes: notes.trim() || undefined,
          status: "SUCCESS",
          date: viewMode === "DATE" ? selectedRecordDate : getTodayString(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal memproses transaksi digital");
      }

      const dateLabel = viewMode === "DATE" && selectedRecordDate !== getTodayString()
        ? ` untuk tanggal ${formatIndoDate(selectedRecordDate)}`
        : "";

      setSuccessMessage(
        `Transaksi ${selectedType} (${paymentMethod}) berhasil dicatat${dateLabel}! (${data.transaction.trxNumber} — Total Bayar: ${formatRupiah(
          totalCustomerPay
        )})`
      );

      // Reset form
      setNominal("");
      setNotes("");

      // Refresh list
      await refreshTransactionsData(selectedRecordDate, viewMode);

      setTimeout(() => setSuccessMessage(null), 6000);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Open correction modal for a transaction
  const openCorrectionModal = (trx: DigitalTransaction) => {
    setSelectedCorrectionTrx(trx);

    const formatterDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const dateStr = formatterDate.format(new Date(trx.createdAt));

    const formatterTime = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const timeStr = formatterTime.format(new Date(trx.createdAt));

    const baseNominal = trx.costPrice > 0 ? trx.costPrice : Math.max(0, (trx.sellingPrice || 0) - (trx.profit || 0));
    const baseAdmin = trx.profit || 0;

    setCorrectionForm({
      category: trx.digitalProduct?.category || "TOP-UP",
      nominal: baseNominal.toLocaleString("id-ID"),
      adminFee: baseAdmin.toLocaleString("id-ID"),
      paymentMethod: ((trx.paymentMethod || "CASH").toUpperCase() === "QRIS" ? "QRIS" : "CASH") as "CASH" | "QRIS",
      destinationNumber: trx.destinationNumber !== "-" ? trx.destinationNumber : "",
      notes: trx.notes || "",
      date: dateStr,
      time: timeStr,
      status: trx.status || "SUCCESS",
    });
    setErrorMessage(null);
    setIsCorrectionModalOpen(true);
  };

  // Handle save correction
  const handleSaveCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCorrectionTrx) return;

    const rawNominal = parseFloat(correctionForm.nominal.replace(/[^0-9]/g, "")) || 0;
    const rawAdminFee = parseFloat(correctionForm.adminFee.replace(/[^0-9]/g, "")) || 0;

    if (rawNominal <= 0) {
      setErrorMessage("Nominal transaksi harus lebih dari 0");
      return;
    }

    setCorrectionLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/digital/transactions/${selectedCorrectionTrx.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: correctionForm.category,
          nominal: rawNominal,
          adminFee: rawAdminFee,
          paymentMethod: correctionForm.paymentMethod,
          destinationNumber: correctionForm.destinationNumber,
          notes: correctionForm.notes,
          date: correctionForm.date,
          time: correctionForm.time,
          status: correctionForm.status,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengoreksi transaksi digital");

      setSuccessMessage(`Koreksi transaksi ${selectedCorrectionTrx.trxNumber} berhasil disimpan!`);
      setIsCorrectionModalOpen(false);
      setSelectedCorrectionTrx(null);

      await refreshTransactionsData(selectedRecordDate, viewMode);

      setTimeout(() => setSuccessMessage(null), 6000);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setCorrectionLoading(false);
    }
  };

  // Handle delete / cancellation
  const handleDeleteTransaction = async () => {
    if (!trxToDelete) return;

    setDeleteLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/digital/transactions/${trxToDelete.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membatalkan transaksi");

      setSuccessMessage(data.message || `Transaksi ${trxToDelete.trxNumber} berhasil dibatalkan!`);
      setTrxToDelete(null);

      await refreshTransactionsData(selectedRecordDate, viewMode);

      setTimeout(() => setSuccessMessage(null), 6000);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  // Handle add custom type
  const handleAddCustomType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTypeName.trim()) return;

    setTypeLoading(true);
    try {
      const res = await fetch("/api/digital/types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTypeName.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menambahkan jenis transaksi");
      }

      const added = data.type.toUpperCase();
      if (!types.includes(added)) {
        setTypes([...types, added]);
      }
      setSelectedType(added);
      setNewTypeName("");
      setIsAddTypeOpen(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setTypeLoading(false);
    }
  };

  // Handle delete custom type
  const handleDeleteCustomType = async (typeName: string) => {
    if (!confirm(`Hapus jenis transaksi "${typeName}"?`)) return;

    try {
      const res = await fetch(`/api/digital/types?name=${encodeURIComponent(typeName)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapus jenis transaksi");

      const remaining = types.filter((t) => t !== typeName);
      setTypes(remaining);
      if (selectedType === typeName) {
        setSelectedType(remaining[0] || "TOP-UP");
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Helper badge color per type
  const getTypeBadge = (type: string) => {
    const t = type.toUpperCase();
    if (t === "TOP-UP") {
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
          Top-Up
        </span>
      );
    }
    if (t === "TARIK TUNAI") {
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
          Tarik Tunai
        </span>
      );
    }
    if (t === "PULSA") {
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          Pulsa
        </span>
      );
    }
    if (t === "TAGIHAN") {
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
          Tagihan
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
        {type}
      </span>
    );
  };

  // Helper status badge
  const getStatusBadge = (status: string) => {
    if (status === "SUCCESS") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
          SUKSES
        </span>
      );
    }
    if (status === "PENDING") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
          PENDING
        </span>
      );
    }
    if (status === "FAILED") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
          GAGAL
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
        {status}
      </span>
    );
  };

  // Helper payment method badge
  const getPaymentMethodBadge = (method?: string | null) => {
    const m = (method || "CASH").toUpperCase();
    if (m === "QRIS") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
          📱 QRIS
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
        💵 Tunai
      </span>
    );
  };

  return (
    <div className="space-y-6 pb-16 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-gradient-to-r from-indigo-50/90 via-purple-50/70 to-slate-50 border border-indigo-100/80 rounded-2xl px-5 py-3 shadow-sm">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-600/20">
            <Megaphone className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-indigo-600 text-white text-[10px] font-extrabold uppercase tracking-wide">
                PENGUMUMAN
              </span>
              <span className="text-xs font-bold text-slate-800">Fitur Koreksi Transaksi Digital Aktif</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Pencatatan cepat & koreksi transaksi masa lampau dengan rekapitulasi laba otomatis per tanggal.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto text-xs font-bold text-indigo-700">
          <Clock className="w-4 h-4 text-indigo-500" />
          <span>{formatIndoDate(getTodayString())}</span>
        </div>
      </div>

      {/* BAR KONTROL PEMILIHAN TANGGAL REKAPAN (SEPERTI DI REKAP VOUCHER) */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mr-1">
            <Calendar className="w-4 h-4 text-indigo-600" />
            Pilih Tanggal Transaksi:
          </span>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl">
            <button
              type="button"
              onClick={() => {
                setViewMode("DATE");
                setSelectedRecordDate(getTodayString());
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                viewMode === "DATE" && selectedRecordDate === getTodayString()
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Hari Ini
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode("DATE");
                setSelectedRecordDate(getYesterdayString());
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                viewMode === "DATE" && selectedRecordDate === getYesterdayString()
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Kemarin
            </button>
            <button
              type="button"
              onClick={() => setViewMode("ALL")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                viewMode === "ALL"
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Semua Data
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <input
              type="date"
              value={selectedRecordDate}
              onChange={(e) => {
                setSelectedRecordDate(e.target.value);
                setViewMode("DATE");
              }}
              className="bg-transparent border-none text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
            />
          </div>

          {viewMode === "DATE" && (
            <span className="text-xs font-bold text-indigo-900 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-xl hidden sm:inline-block">
              {formatIndoDate(selectedRecordDate)}
            </span>
          )}

          <button
            type="button"
            onClick={() => refreshTransactionsData(selectedRecordDate, viewMode)}
            title="Segarkan data transaksi"
            disabled={fetching}
            className="p-2 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 rounded-xl transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${fetching ? "animate-spin text-indigo-600" : ""}`} />
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={exportLoading}
            title="Ekspor laporan Excel untuk periode tanggal ini"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{exportLoading ? "Mengekspor..." : "Export Excel"}</span>
          </button>
        </div>
      </div>

      {/* BANNER PERINGATAN REKAP MUNDUR / KOREKSI TANGGAL LAMPAU */}
      {viewMode === "DATE" && selectedRecordDate !== getTodayString() && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-3xl text-amber-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-sm">
                Mode Rekap Mundur / Koreksi Tanggal: {formatIndoDate(selectedRecordDate)}
              </p>
              <p className="text-[11px] text-amber-800 mt-0.5">
                Transaksi digital yang Anda simpan pada form di bawah akan tercatat resmi pada tanggal <strong>{selectedRecordDate}</strong>. Anda juga dapat mengoreksi atau membatalkan transaksi yang keliru di tabel rekap sebelah kanan.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedRecordDate(getTodayString());
              setViewMode("DATE");
            }}
            className="shrink-0 px-3.5 py-2 bg-white border border-amber-300 hover:bg-amber-100 font-bold text-amber-900 rounded-2xl text-xs transition-all shadow-sm cursor-pointer"
          >
            Kembali ke Hari Ini
          </button>
        </div>
      )}

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT CARD: OPERASIONAL - Transaksi Digital & PPOB */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 lg:p-7 border border-slate-200/80 shadow-sm space-y-6">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold tracking-widest text-indigo-600 uppercase block mb-1">
                OPERASIONAL
              </span>
              {viewMode === "DATE" && selectedRecordDate !== getTodayString() && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  Rekap Tanggal Lampau
                </span>
              )}
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Transaksi Digital & PPOB
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Top-up saldo e-wallet, pulsa, dan tagihan PPOB (Tarik Tunai / Top-Up).
            </p>
          </div>

          {/* Indicator tanggal pencatatan aktif */}
          {viewMode === "DATE" && selectedRecordDate !== getTodayString() && (
            <div className="flex items-center gap-2 p-3 bg-amber-50/80 border border-amber-200 rounded-2xl text-amber-900 text-xs">
              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
              <div>
                <span className="font-semibold">Mencatat untuk tanggal: </span>
                <span className="font-extrabold">{formatIndoDate(selectedRecordDate)}</span>
              </div>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-2.5 text-emerald-800 text-xs animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="font-medium">{successMessage}</div>
            </div>
          )}

          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-rose-700 text-xs animate-in fade-in">
              <X className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="font-medium">{errorMessage}</div>
            </div>
          )}

          <form onSubmit={handleSubmitTransaction} className="space-y-5">
            {/* JENIS TRANSAKSI */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <label className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                  JENIS TRANSAKSI
                </label>
                <button
                  type="button"
                  onClick={() => setIsAddTypeOpen(true)}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Jenis</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {types.map((type) => {
                  const isSelected = selectedType.toUpperCase() === type.toUpperCase();
                  const isDefault = DEFAULT_TYPES.includes(type.toUpperCase());

                  return (
                    <div key={type} className="relative group inline-flex items-center">
                      <button
                        type="button"
                        onClick={() => setSelectedType(type)}
                        className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                          isSelected
                            ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25 ring-2 ring-indigo-600/20"
                            : "bg-white border border-slate-200/90 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        }`}
                      >
                        {type}
                      </button>

                      {!isDefault && userRole === "OWNER" && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCustomType(type);
                          }}
                          title="Hapus jenis transaksi ini"
                          className="opacity-0 group-hover:opacity-100 absolute -top-1.5 -right-1.5 w-4 h-4 bg-rose-500 hover:bg-rose-600 text-white rounded-full flex items-center justify-center text-[10px] shadow transition-opacity"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* METODE PEMBAYARAN */}
            <div>
              <label className="text-[11px] font-bold tracking-wider text-slate-400 uppercase block mb-1.5">
                METODE PEMBAYARAN
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("CASH")}
                  className={`flex items-center justify-center gap-2 py-3 px-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                    paymentMethod === "CASH"
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/25 ring-2 ring-emerald-600/30"
                      : "bg-slate-50 border border-slate-200/90 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <span className="text-sm">💵</span>
                  <span>Tunai (CASH)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("QRIS")}
                  className={`flex items-center justify-center gap-2 py-3 px-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                    paymentMethod === "QRIS"
                      ? "bg-purple-600 text-white shadow-md shadow-purple-600/25 ring-2 ring-purple-600/30"
                      : "bg-slate-50 border border-slate-200/90 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <span className="text-sm">📱</span>
                  <span>QRIS</span>
                </button>
              </div>
            </div>

            {/* NOMINAL */}
            <div>
              <label className="text-[11px] font-bold tracking-wider text-slate-400 uppercase block mb-1.5">
                NOMINAL
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={nominal}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9]/g, "");
                    const num = parseInt(raw, 10);
                    setNominal(isNaN(num) ? "" : num.toLocaleString("id-ID"));
                  }}
                  placeholder="Nominal transaksi..."
                  className="w-full bg-slate-50/90 border border-slate-200/80 rounded-2xl px-4 py-3 text-base font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono"
                />
              </div>

              {/* Quick Nominal Chips */}
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {NOMINAL_QUICK_CHIPS.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setNominal(amt.toLocaleString("id-ID"))}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 rounded-lg text-[11px] font-semibold transition-colors"
                  >
                    {amt >= 1000000 ? `${amt / 1000000} Jt` : `${amt / 1000}rb`}
                  </button>
                ))}
              </div>
            </div>

            {/* BIAYA ADMIN (LABA KONTER) */}
            <div>
              <label className="text-[11px] font-bold tracking-wider text-slate-400 uppercase block mb-1.5">
                BIAYA ADMIN (LABA KONTER)
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={adminFee}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9]/g, "");
                    const num = parseInt(raw, 10);
                    setAdminFee(isNaN(num) ? "" : num.toLocaleString("id-ID"));
                  }}
                  placeholder="2000"
                  className="w-full bg-slate-50/90 border border-slate-200/80 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono"
                />
              </div>

              {/* Quick Admin Chips */}
              <div className="flex items-center gap-1.5 mt-2">
                {ADMIN_QUICK_CHIPS.map((fee) => (
                  <button
                    key={fee}
                    type="button"
                    onClick={() => setAdminFee(fee.toLocaleString("id-ID"))}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                      numAdminFee === fee
                        ? "bg-indigo-100 text-indigo-700 font-bold"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                    }`}
                  >
                    +{fee.toLocaleString("id-ID")}
                  </button>
                ))}
              </div>
            </div>

            {/* CATATAN / NOMOR TUJUAN */}
            <div>
              <label className="text-[11px] font-bold tracking-wider text-slate-400 uppercase block mb-1.5">
                CATATAN / NOMOR TUJUAN (OPSIONAL)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Catatan transaksi (opsional, misal: no rek, no token, catatan pelanggan)..."
                className="w-full bg-slate-50/90 border border-slate-200/80 rounded-2xl px-4 py-3 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
            </div>

            {/* Financial Preview Box */}
            {numNominal > 0 && (
              <div className="p-3.5 bg-indigo-50/60 border border-indigo-100 rounded-2xl space-y-1.5 text-xs text-slate-700">
                <div className="flex justify-between items-center text-slate-600">
                  <span>Nominal Transaksi:</span>
                  <span className="font-mono font-semibold">{formatRupiah(numNominal)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Biaya Admin (Laba):</span>
                  <span className="font-mono font-bold text-emerald-600">
                    +{formatRupiah(numAdminFee)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-indigo-100 font-extrabold text-indigo-900 text-sm">
                  <span>Total Bayar Pelanggan:</span>
                  <span className="font-mono text-base">{formatRupiah(totalCustomerPay)}</span>
                </div>
                <div className="pt-2 border-t border-indigo-100/70 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 font-medium">Aliran Uang:</span>
                  {paymentMethod === "CASH" ? (
                    <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                      💵 Uang Fisik Masuk Laci Kasir
                    </span>
                  ) : (
                    <span className="font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-200">
                      📱 Non-Tunai Masuk Rekening / QRIS
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* BUTTON PROSES & BAYAR */}
            <button
              type="submit"
              disabled={loading || numNominal <= 0}
              className="w-full bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-extrabold text-sm uppercase tracking-wider py-4 rounded-2xl shadow-lg shadow-indigo-600/30 active:scale-[0.99] transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <span>Memproses Transaksi...</span>
              ) : (
                <>
                  <span>
                    {viewMode === "DATE" && selectedRecordDate !== getTodayString()
                      ? `PROSES & CATAT (${selectedRecordDate})`
                      : "PROSES & BAYAR"}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* RIGHT CARD: ARSIP & LAPORAN - Rekap Transaksi */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 lg:p-7 border border-slate-200/80 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-extrabold tracking-widest text-indigo-600 uppercase block mb-1">
                ARSIP & LAPORAN
              </span>
              <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Rekap Transaksi
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {viewMode === "ALL"
                  ? "Rekapitulasi seluruh riwayat transaksi digital."
                  : `Rekapitulasi total transaksi tanggal ${
                      selectedRecordDate === getTodayString()
                        ? "hari ini"
                        : formatIndoDate(selectedRecordDate)
                    } berdasarkan jenis transaksi digital.`}
              </p>
            </div>

            {/* Tabs Pill Switch */}
            <div className="inline-flex p-1 bg-slate-100/90 rounded-2xl self-start sm:self-center">
              <button
                onClick={() => setActiveTab("SUMMARY")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === "SUMMARY"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Ringkasan Tipe
              </button>
              <button
                onClick={() => setActiveTab("DETAILS")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === "DETAILS"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Detail Transaksi ({dateFilteredTransactions.length})
              </button>
            </div>
          </div>

          {/* STATS KARTU ARUS PEMBAYARAN: TOTAL TUNAI (LACI) VS TOTAL QRIS (BANK) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Card 1: Kas Tunai Fisik (Laci Kasir) */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 via-emerald-50/70 to-emerald-100/40 border border-emerald-200/80 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                  💵 Kas Tunai Fisik (Laci Kasir)
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-200/70 text-emerald-800">
                  Laci Kasir
                </span>
              </div>
              <div className="text-xl font-extrabold text-emerald-950 font-mono mt-1.5">
                {formatRupiah(overallTotals.cashTotal)}
              </div>
              <p className="text-[11px] text-emerald-800/90 mt-1">
                <span className="font-bold">{overallTotals.cashCount} transaksi</span> • Uang tunai wajib ada di laci kasir
              </p>
            </div>

            {/* Card 2: Non-Tunai (QRIS Toko) */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-50 via-indigo-50/70 to-purple-100/40 border border-purple-200/80 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">
                  📱 Non-Tunai (QRIS Toko)
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-200/70 text-purple-800">
                  Bank / QRIS
                </span>
              </div>
              <div className="text-xl font-extrabold text-purple-950 font-mono mt-1.5">
                {formatRupiah(overallTotals.qrisTotal)}
              </div>
              <p className="text-[11px] text-purple-800/90 mt-1">
                <span className="font-bold">{overallTotals.qrisCount} transaksi</span> • Uang langsung masuk rekening bank/QRIS
              </p>
            </div>
          </div>

          {/* TAB 1: RINGKASAN TIPE */}
          {activeTab === "SUMMARY" && (
            <div className="space-y-3">
              {/* Filter Metode Bayar untuk Ringkasan */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-2xl border border-slate-200/70">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">
                    Metode:
                  </span>
                  <button
                    type="button"
                    onClick={() => setSummaryPaymentFilter("ALL")}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      summaryPaymentFilter === "ALL"
                        ? "bg-slate-900 text-white shadow-xs"
                        : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80"
                    }`}
                  >
                    Semua ({overallTotals.count})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSummaryPaymentFilter("CASH")}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      summaryPaymentFilter === "CASH"
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-200/80"
                    }`}
                  >
                    💵 Tunai ({overallTotals.cashCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSummaryPaymentFilter("QRIS")}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      summaryPaymentFilter === "QRIS"
                        ? "bg-purple-600 text-white shadow-xs"
                        : "bg-white text-purple-700 hover:bg-purple-50 border border-purple-200/80"
                    }`}
                  >
                    📱 QRIS ({overallTotals.qrisCount})
                  </button>
                </div>

                <div className="text-xs text-slate-500 font-medium">
                  {summaryPaymentFilter === "ALL" ? (
                    <span>Menampilkan seluruh transaksi (Tunai + QRIS)</span>
                  ) : summaryPaymentFilter === "CASH" ? (
                    <span className="font-semibold text-emerald-700">Khusus pembayaran Tunai (Laci Kasir)</span>
                  ) : (
                    <span className="font-semibold text-purple-700">Khusus pembayaran QRIS (Rekening Bank)</span>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-[11px] uppercase font-bold text-slate-400 border-b border-slate-200">
                    <tr>
                      <th className="px-5 py-3.5">JENIS TRANSAKSI</th>
                      <th className="px-5 py-3.5 text-center">JUMLAH TRANSAKSI</th>
                      <th className="px-5 py-3.5 text-right">TOTAL NOMINAL</th>
                      <th className="px-5 py-3.5 text-right">
                        {userRole === "OWNER" ? "LABA ADMIN" : "BIAYA ADMIN"}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {types.map((type) => {
                      const data = summaryByType[type.toUpperCase()] || {
                        count: 0,
                        totalNominal: 0,
                        totalAdmin: 0,
                        cashCount: 0,
                        cashTotal: 0,
                        qrisCount: 0,
                        qrisTotal: 0,
                      };

                      return (
                        <tr key={type} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-5 py-3.5 font-medium text-slate-800">
                            {getTypeBadge(type)}
                          </td>
                          <td className="px-5 py-3.5 text-center font-bold text-slate-800 font-mono">
                            {data.count}x
                          </td>
                          <td className="px-5 py-3.5 text-right font-semibold text-slate-700 font-mono">
                            {formatRupiah(data.totalNominal)}
                          </td>
                          <td className="px-5 py-3.5 text-right font-bold text-emerald-600 font-mono">
                            +{formatRupiah(data.totalAdmin)}
                          </td>
                        </tr>
                      );
                    })}

                    {/* Summary / Total Keseluruhan Row */}
                    <tr className="bg-slate-50/80 font-extrabold text-xs text-slate-900 border-t-2 border-slate-200">
                      <td className="px-5 py-4 text-sm font-extrabold text-slate-900">
                        Total {summaryPaymentFilter === "ALL" ? "Keseluruhan" : summaryPaymentFilter === "CASH" ? "Kas Tunai" : "QRIS"}
                      </td>
                      <td className="px-5 py-4 text-center font-mono font-extrabold text-sm text-slate-900">
                        {overallTotals.count}x
                      </td>
                      <td className="px-5 py-4 text-right font-mono font-extrabold text-sm text-slate-900">
                        {formatRupiah(overallTotals.totalNominal)}
                      </td>
                      <td className="px-5 py-4 text-right font-mono font-extrabold text-sm text-emerald-600">
                        +{formatRupiah(overallTotals.totalAdmin)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: DETAIL TRANSAKSI DENGAN AKSI KOREKSI & BATAL */}
          {activeTab === "DETAILS" && (
            <div className="space-y-3">
              {/* Filter & Search Bar */}
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                  {/* Category Filter */}
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                    <button
                      onClick={() => setFilterType("ALL")}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                        filterType === "ALL"
                          ? "bg-white text-slate-900 shadow-xs font-bold"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Semua Tipe
                    </button>
                    {types.map((t) => (
                      <button
                        key={t}
                        onClick={() => setFilterType(t)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                          filterType.toUpperCase() === t.toUpperCase()
                            ? "bg-white text-slate-900 shadow-xs font-bold"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>

                  {/* Payment Method Filter */}
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                    <button
                      onClick={() => setFilterPaymentMethod("ALL")}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                        filterPaymentMethod === "ALL"
                          ? "bg-slate-900 text-white font-bold"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Semua
                    </button>
                    <button
                      onClick={() => setFilterPaymentMethod("CASH")}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                        filterPaymentMethod === "CASH"
                          ? "bg-emerald-600 text-white font-bold"
                          : "text-slate-600 hover:text-emerald-700"
                      }`}
                    >
                      💵 Tunai
                    </button>
                    <button
                      onClick={() => setFilterPaymentMethod("QRIS")}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                        filterPaymentMethod === "QRIS"
                          ? "bg-purple-600 text-white font-bold"
                          : "text-slate-600 hover:text-purple-700"
                      }`}
                    >
                      📱 QRIS
                    </button>
                  </div>
                </div>

                <div className="relative w-full md:w-56">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari trx, catatan, kasir..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Detail Table */}
              <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-[11px] uppercase font-bold text-slate-400 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">WAKTU & NO TRX</th>
                      <th className="px-4 py-3">JENIS</th>
                      <th className="px-3 py-3 text-center">METODE</th>
                      <th className="px-4 py-3 text-right">NOMINAL</th>
                      <th className="px-4 py-3 text-right">BIAYA ADMIN</th>
                      <th className="px-4 py-3 text-right">TOTAL BAYAR</th>
                      <th className="px-4 py-3">CATATAN / TUJUAN</th>
                      <th className="px-4 py-3 text-center">STATUS</th>
                      <th className="px-4 py-3 text-right">AKSI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredDetails.length === 0 ? (
                      <tr>
                        <td
                          colSpan={9}
                          className="px-6 py-10 text-center text-slate-400"
                        >
                          Belum ada transaksi digital pada periode tanggal ini.
                        </td>
                      </tr>
                    ) : (
                      filteredDetails.map((t) => {
                        const trxDate = new Date(t.createdAt);
                        const dateFormatted = trxDate.toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        });
                        const timeFormatted = trxDate.toLocaleTimeString("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                        });

                        const nominalVal = t.costPrice > 0 ? t.costPrice : Math.max(0, (t.sellingPrice || 0) - (t.profit || 0));

                        return (
                          <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="px-4 py-3 font-mono">
                              <span className="text-[10px] text-slate-400 block">
                                {dateFormatted} {timeFormatted}
                              </span>
                              <span className="font-bold text-slate-700">{t.trxNumber}</span>
                              {t.cashier?.name && (
                                <span className="text-[10px] text-slate-400 block">
                                  Kasir: {t.cashier.name}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {getTypeBadge(t.digitalProduct?.category || "TOP-UP")}
                            </td>
                            <td className="px-3 py-3 text-center whitespace-nowrap">
                              {getPaymentMethodBadge(t.paymentMethod)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-semibold text-slate-800">
                              {formatRupiah(nominalVal)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600">
                              +{formatRupiah(t.profit)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-indigo-700">
                              {formatRupiah(t.sellingPrice)}
                            </td>
                            <td className="px-4 py-3 text-slate-700 max-w-[170px] truncate" title={t.notes || t.destinationNumber}>
                              {t.notes || (t.destinationNumber !== "-" ? t.destinationNumber : "-")}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {getStatusBadge(t.status)}
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openCorrectionModal(t)}
                                  title="Koreksi transaksi ini"
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/70 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  <span>Koreksi</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setTrxToDelete(t)}
                                  title="Batalkan / Hapus transaksi ini"
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/70 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Batal</span>
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
            </div>
          )}
        </div>
      </div>

      {/* MODAL KOREKSI TRANSAKSI DIGITAL */}
      {isCorrectionModalOpen && selectedCorrectionTrx && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Koreksi Transaksi Digital</h3>
                  <p className="text-xs text-slate-500">
                    No. Trx: <span className="font-mono font-bold text-slate-700">{selectedCorrectionTrx.trxNumber}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsCorrectionModalOpen(false);
                  setSelectedCorrectionTrx(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-2xl">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleSaveCorrection} className="space-y-4">
              {/* Tanggal & Waktu Koreksi */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Tanggal Transaksi
                  </label>
                  <input
                    type="date"
                    required
                    value={correctionForm.date}
                    onChange={(e) => setCorrectionForm({ ...correctionForm, date: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Jam / Waktu
                  </label>
                  <input
                    type="time"
                    required
                    value={correctionForm.time}
                    onChange={(e) => setCorrectionForm({ ...correctionForm, time: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="col-span-2 p-2.5 bg-indigo-50/70 border border-indigo-100 rounded-xl text-[11px] text-indigo-700 font-medium">
                  💡 Transaksi hasil koreksi akan tetap tercatat pada tanggal transaksi aslinya (<strong>{formatIndoDate(correctionForm.date)}</strong>) di Laporan, Dashboard, dan Excel, bukan tanggal hari ini saat Anda mengoreksi.
                </div>
              </div>

              {/* Jenis Transaksi */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                  Jenis Transaksi
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {types.map((type) => {
                    const isSel = correctionForm.category.toUpperCase() === type.toUpperCase();
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setCorrectionForm({ ...correctionForm, category: type })}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          isSel
                            ? "bg-indigo-600 text-white shadow-sm"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                        }`}
                      >
                        {type}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Nominal Transaksi */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Nominal Transaksi
                </label>
                <input
                  type="text"
                  required
                  value={correctionForm.nominal}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9]/g, "");
                    const num = parseInt(raw, 10);
                    setCorrectionForm({
                      ...correctionForm,
                      nominal: isNaN(num) ? "" : num.toLocaleString("id-ID"),
                    });
                  }}
                  placeholder="Nominal transaksi..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 font-mono"
                />
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {NOMINAL_QUICK_CHIPS.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() =>
                        setCorrectionForm({ ...correctionForm, nominal: amt.toLocaleString("id-ID") })
                      }
                      className="px-2 py-0.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 rounded-lg text-[10px] font-semibold"
                    >
                      {amt >= 1000000 ? `${amt / 1000000} Jt` : `${amt / 1000}rb`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Biaya Admin / Laba Konter */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Biaya Admin (Laba Konter)
                </label>
                <input
                  type="text"
                  required
                  value={correctionForm.adminFee}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9]/g, "");
                    const num = parseInt(raw, 10);
                    setCorrectionForm({
                      ...correctionForm,
                      adminFee: isNaN(num) ? "" : num.toLocaleString("id-ID"),
                    });
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 font-mono"
                />
                <div className="flex gap-1.5 mt-1.5">
                  {ADMIN_QUICK_CHIPS.map((fee) => (
                    <button
                      key={fee}
                      type="button"
                      onClick={() =>
                        setCorrectionForm({ ...correctionForm, adminFee: fee.toLocaleString("id-ID") })
                      }
                      className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-semibold"
                    >
                      +{fee.toLocaleString("id-ID")}
                    </button>
                  ))}
                </div>
              </div>

              {/* Catatan / Nomor Tujuan */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Nomor Tujuan / Catatan
                </label>
                <input
                  type="text"
                  value={correctionForm.notes}
                  onChange={(e) => setCorrectionForm({ ...correctionForm, notes: e.target.value })}
                  placeholder="Catatan / Nomor Pelanggan..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Metode Pembayaran */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                  Metode Pembayaran
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCorrectionForm({ ...correctionForm, paymentMethod: "CASH" })}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      correctionForm.paymentMethod === "CASH"
                        ? "bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-500/20"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                    }`}
                  >
                    <span>💵 Tunai (CASH)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCorrectionForm({ ...correctionForm, paymentMethod: "QRIS" })}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      correctionForm.paymentMethod === "QRIS"
                        ? "bg-purple-600 text-white shadow-sm ring-2 ring-purple-500/20"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                    }`}
                  >
                    <span>📱 QRIS</span>
                  </button>
                </div>
              </div>

              {/* Status Transaksi */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Status Transaksi
                </label>
                <select
                  value={correctionForm.status}
                  onChange={(e) => setCorrectionForm({ ...correctionForm, status: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="SUCCESS">SUCCESS (Berhasil & Dihitung)</option>
                  <option value="PENDING">PENDING (Menunggu)</option>
                  <option value="FAILED">FAILED (Gagal - Tanpa Laba)</option>
                  <option value="REFUNDED">REFUNDED (Dikembalikan - Tanpa Laba)</option>
                </select>
              </div>

              {/* Live Calculation Preview */}
              {(() => {
                const numNom = parseFloat(correctionForm.nominal.replace(/[^0-9]/g, "")) || 0;
                const numFee = parseFloat(correctionForm.adminFee.replace(/[^0-9]/g, "")) || 0;
                const totalPay = numNom + numFee;
                return (
                  <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-2xl space-y-1 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Nominal Baru:</span>
                      <span className="font-mono font-semibold">{formatRupiah(numNom)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Laba Admin Baru:</span>
                      <span className="font-mono font-bold text-emerald-600">+{formatRupiah(numFee)}</span>
                    </div>
                    <div className="flex justify-between pt-1.5 border-t border-indigo-100 font-extrabold text-indigo-900 text-sm">
                      <span>Total Bayar Pelanggan:</span>
                      <span className="font-mono">{formatRupiah(totalPay)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-1 text-[11px]">
                      <span className="text-slate-500">Aliran Uang:</span>
                      {correctionForm.paymentMethod === "CASH" ? (
                        <span className="font-bold text-emerald-700">💵 Masuk Laci Kasir</span>
                      ) : (
                        <span className="font-bold text-purple-700">📱 Masuk QRIS Toko</span>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsCorrectionModalOpen(false);
                    setSelectedCorrectionTrx(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={correctionLoading}
                  className="px-5 py-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow shadow-indigo-600/20 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {correctionLoading ? "Menyimpan..." : "Simpan Koreksi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PEMBATALAN TRANSAKSI DIGITAL */}
      {trxToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Batalkan Transaksi Digital</h3>
                <p className="text-xs text-slate-500">Koreksi & pembatalan transaksi tercatat</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">No. Transaksi:</span>
                <span className="font-mono font-bold text-slate-800">{trxToDelete.trxNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Jenis Transaksi:</span>
                <span className="font-bold text-slate-800">{trxToDelete.digitalProduct?.category || "TOP-UP"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Nominal:</span>
                <span className="font-mono font-bold text-slate-800">
                  {formatRupiah(trxToDelete.costPrice > 0 ? trxToDelete.costPrice : Math.max(0, (trxToDelete.sellingPrice || 0) - (trxToDelete.profit || 0)))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Biaya Admin:</span>
                <span className="font-mono font-bold text-emerald-600">+{formatRupiah(trxToDelete.profit)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200 font-bold text-indigo-700">
                <span>Total Bayar:</span>
                <span className="font-mono">{formatRupiah(trxToDelete.sellingPrice)}</span>
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-[11px] text-amber-800 space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-amber-900">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Penyesuaian Laporan Otomatis</span>
              </p>
              <p>
                Jika dibatalkan, transaksi ini akan dihapus dari sistem, dan rekapan omset serta laba admin pada tanggal terkait akan otomatis disesuaikan.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={deleteLoading}
                onClick={() => setTrxToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="button"
                disabled={deleteLoading}
                onClick={handleDeleteTransaction}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-md shadow-rose-600/20 disabled:opacity-50 cursor-pointer"
              >
                {deleteLoading ? "Membatalkan..." : "Ya, Batalkan Transaksi Ini"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH JENIS TRANSAKSI BARU */}
      {isAddTypeOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Tambah Jenis Transaksi</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Misal: Transfer Bank, Token PLN, DANA, dll.
                </p>
              </div>
              <button
                onClick={() => setIsAddTypeOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddCustomType} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Jenis Transaksi
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  placeholder="Contoh: TRANSFER BANK / TOKEN PLN"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold uppercase text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddTypeOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={typeLoading || !newTypeName.trim()}
                  className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow shadow-indigo-600/20 disabled:opacity-50 cursor-pointer"
                >
                  {typeLoading ? "Menyimpan..." : "Simpan Jenis"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

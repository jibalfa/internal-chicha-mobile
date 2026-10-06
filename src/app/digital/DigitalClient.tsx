"use client";

import React, { useState, useMemo } from "react";
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
} from "lucide-react";

interface DigitalTransaction {
  id: string;
  trxNumber: string;
  digitalProductId: string;
  destinationNumber: string;
  costPrice: number;
  sellingPrice: number;
  profit: number;
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

const DEFAULT_TYPES = ["TOP-UP", "TARIK TUNAI", "PULSA", "TAGIHAN"];

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

  // Form state
  const [nominal, setNominal] = useState<string>("");
  const [adminFee, setAdminFee] = useState<string>("2000");
  const [notes, setNotes] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Transactions state
  const [transactions, setTransactions] = useState<DigitalTransaction[]>(initialTransactions);
  const [activeTab, setActiveTab] = useState<"SUMMARY" | "DETAILS">("SUMMARY");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("ALL");
  const [dateRange, setDateRange] = useState<"TODAY" | "ALL">("TODAY");

  // Modal tambah jenis transaksi
  const [isAddTypeOpen, setIsAddTypeOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [typeLoading, setTypeLoading] = useState(false);

  // Calculate numbers for active form
  const numNominal = parseFloat(nominal.replace(/[^0-9]/g, "")) || 0;
  const numAdminFee = parseFloat(adminFee.replace(/[^0-9]/g, "")) || 0;
  const totalCustomerPay = numNominal + numAdminFee;

  // Filter transactions based on dateRange (Today vs All)
  const dateFilteredTransactions = useMemo(() => {
    if (dateRange === "ALL") return transactions;

    const todayStr = new Date().toISOString().slice(0, 10);
    return transactions.filter((t) => {
      const trxDateStr = new Date(t.createdAt).toISOString().slice(0, 10);
      return trxDateStr === todayStr;
    });
  }, [transactions, dateRange]);

  // Aggregate breakdown per Jenis Transaksi for the Rekap table
  const summaryByType = useMemo(() => {
    const map: Record<string, { count: number; totalNominal: number; totalAdmin: number }> = {};

    // Initialize all active types
    types.forEach((t) => {
      map[t.toUpperCase()] = { count: 0, totalNominal: 0, totalAdmin: 0 };
    });

    dateFilteredTransactions.forEach((trx) => {
      const cat = (trx.digitalProduct?.category || "LAINNYA").toUpperCase();
      if (!map[cat]) {
        map[cat] = { count: 0, totalNominal: 0, totalAdmin: 0 };
      }
      map[cat].count += 1;
      map[cat].totalNominal += trx.costPrice; // The base nominal
      map[cat].totalAdmin += trx.profit; // The admin fee profit
    });

    return map;
  }, [types, dateFilteredTransactions]);

  // Overall totals
  const overallTotals = useMemo(() => {
    let count = 0;
    let totalNominal = 0;
    let totalAdmin = 0;

    dateFilteredTransactions.forEach((trx) => {
      count += 1;
      totalNominal += trx.costPrice;
      totalAdmin += trx.profit;
    });

    return { count, totalNominal, totalAdmin };
  }, [dateFilteredTransactions]);

  // Filtered list for "Detail Transaksi" tab
  const filteredDetails = useMemo(() => {
    return dateFilteredTransactions.filter((t) => {
      const catMatch =
        filterType === "ALL" ||
        t.digitalProduct?.category?.toUpperCase() === filterType.toUpperCase();

      if (!catMatch) return false;
      if (!search.trim()) return true;

      const q = search.toLowerCase();
      return (
        t.trxNumber.toLowerCase().includes(q) ||
        (t.destinationNumber && t.destinationNumber.toLowerCase().includes(q)) ||
        (t.notes && t.notes.toLowerCase().includes(q)) ||
        (t.digitalProduct?.category && t.digitalProduct.category.toLowerCase().includes(q))
      );
    });
  }, [dateFilteredTransactions, filterType, search]);

  // Handle create transaction
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
          notes: notes.trim() || undefined,
          status: "SUCCESS",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal memproses transaksi digital");
      }

      // Prepend newly created transaction
      setTransactions([data.transaction, ...transactions]);
      setSuccessMessage(
        `Transaksi ${selectedType} berhasil dicatat! (${data.transaction.trxNumber} — Total Bayar: ${formatRupiah(
          totalCustomerPay
        )})`
      );

      // Reset form (keep admin fee as default 2000)
      setNominal("");
      setNotes("");

      setTimeout(() => setSuccessMessage(null), 6000);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle add new custom transaction type
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

  // Handle delete custom transaction type
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

  // Handle delete transaction
  const handleDeleteTransaction = async (id: string, trxNumber: string) => {
    if (!confirm(`Hapus catatan transaksi ${trxNumber}?`)) return;

    try {
      const res = await fetch(`/api/digital/transactions/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapus transaksi");

      setTransactions(transactions.filter((t) => t.id !== id));
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
              <span className="text-xs font-bold text-slate-800">Update Sistem Transaksi Digital</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Pencatatan cepat top-up, tarik tunai, pulsa & tagihan dengan rekapitulasi laba otomatis.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={() => setDateRange(dateRange === "TODAY" ? "ALL" : "TODAY")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold shadow-sm transition-all"
          >
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>Periode: {dateRange === "TODAY" ? "Hari Ini" : "Semua Data"}</span>
          </button>
        </div>
      </div>

      {/* Main 2-Column Grid matching Screenshot */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT CARD: OPERASIONAL - Transaksi Digital & PPOB */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 lg:p-7 border border-slate-200/80 shadow-sm space-y-6">
          <div>
            <span className="text-[11px] font-extrabold tracking-widest text-indigo-600 uppercase block mb-1">
              OPERASIONAL
            </span>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Transaksi Digital & PPOB
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Top-up saldo e-wallet, pulsa, dan tagihan PPOB (Tarik Tunai / Top-Up).
            </p>
          </div>

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

            {/* CATATAN (OPSIONAL) */}
            <div>
              <label className="text-[11px] font-bold tracking-wider text-slate-400 uppercase block mb-1.5">
                CATATAN (OPSIONAL)
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
                  <span>PROSES & BAYAR</span>
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
                Rekapitulasi total penjualan hari ini berdasarkan jenis transaksi digital.
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

          {/* TAB 1: RINGKASAN TIPE */}
          {activeTab === "SUMMARY" && (
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
                      Total Keseluruhan
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
          )}

          {/* TAB 2: DETAIL TRANSAKSI */}
          {activeTab === "DETAILS" && (
            <div className="space-y-3">
              {/* Filter & Search Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
                <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                  <button
                    onClick={() => setFilterType("ALL")}
                    className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                      filterType === "ALL"
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Semua
                  </button>
                  {types.map((t) => (
                    <button
                      key={t}
                      onClick={() => setFilterType(t)}
                      className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                        filterType.toUpperCase() === t.toUpperCase()
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                <div className="relative w-full sm:w-60">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari trx, catatan..."
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
                      <th className="px-4 py-3 text-right">NOMINAL</th>
                      <th className="px-4 py-3 text-right">BIAYA ADMIN</th>
                      <th className="px-4 py-3 text-right">TOTAL BAYAR</th>
                      <th className="px-4 py-3">CATATAN</th>
                      {userRole === "OWNER" && <th className="px-4 py-3 text-center">AKSI</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredDetails.length === 0 ? (
                      <tr>
                        <td
                          colSpan={userRole === "OWNER" ? 7 : 6}
                          className="px-6 py-10 text-center text-slate-400"
                        >
                          Belum ada transaksi digital pada periode ini.
                        </td>
                      </tr>
                    ) : (
                      filteredDetails.map((t) => {
                        const dateStr = new Date(t.createdAt).toLocaleString("id-ID", {
                          dateStyle: "short",
                          timeStyle: "short",
                        });

                        return (
                          <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="px-4 py-3 font-mono">
                              <span className="text-[10px] text-slate-400 block">{dateStr}</span>
                              <span className="font-bold text-slate-700">{t.trxNumber}</span>
                            </td>
                            <td className="px-4 py-3">
                              {getTypeBadge(t.digitalProduct?.category || "TOP-UP")}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-semibold text-slate-800">
                              {formatRupiah(t.costPrice)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600">
                              +{formatRupiah(t.profit)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-indigo-700">
                              {formatRupiah(t.sellingPrice)}
                            </td>
                            <td className="px-4 py-3 text-slate-700 max-w-[180px] truncate">
                              {t.notes || t.destinationNumber !== "-" ? t.notes || t.destinationNumber : "-"}
                            </td>
                            {userRole === "OWNER" && (
                              <td className="px-4 py-3 text-center">
                                <button
                                  onClick={() => handleDeleteTransaction(t.id, t.trxNumber)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                  title="Hapus Transaksi"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            )}
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
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
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
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={typeLoading || !newTypeName.trim()}
                  className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow shadow-indigo-600/20 disabled:opacity-50"
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

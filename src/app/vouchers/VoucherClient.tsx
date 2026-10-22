"use client";

import React, { useState, useEffect } from "react";
import {
  Ticket,
  Plus,
  PlusCircle,
  Search,
  AlertTriangle,
  History,
  CheckCircle2,
  TrendingUp,
  Save,
  Edit2,
  Edit3,
  Trash2,
  Calendar,
  FileSpreadsheet,
  Filter,
  BarChart3,
  RefreshCw,
  Lock,
} from "lucide-react";
import { formatRupiah } from "@/lib/calculations";
import { sortVouchers } from "@/lib/voucher-sort";

interface Voucher {
  id: string;
  operator: string;
  nominal: string;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  minStock: number;
  isActive: boolean;
}

interface VoucherMovement {
  id: string;
  voucherId: string;
  type: string;
  quantity: number;
  previousStock: number;
  newStock: number;
  notes: string | null;
  createdAt: string;
  voucher: {
    id: string;
    operator: string;
    nominal: string;
    costPrice: number;
    sellingPrice: number;
  };
}

interface TodaySaleItem {
  id: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  voucherId: string | null;
  voucher?: Voucher | null;
  sale?: {
    id: string;
    invoiceNumber: string;
    createdAt: string;
    paymentMethod: string;
    paymentStatus?: string;
    notes?: string | null;
    cashier?: { id: string; name: string } | null;
  } | null;
}

interface VoucherClientProps {
  initialVouchers: Voucher[];
  initialMovements: VoucherMovement[];
  initialTodaySales?: TodaySaleItem[];
  userRole: string;
}

const POPULAR_OPERATORS = ["Semua", "Telkomsel", "Smartfren", "Tri", "XL", "Indosat", "Axis"];

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

const getTodayString = () => new Date().toISOString().slice(0, 10);
const getYesterdayString = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
};

export default function VoucherClient({
  initialVouchers,
  initialMovements,
  initialTodaySales = [],
  userRole,
}: VoucherClientProps) {
  const [vouchers, setVouchers] = useState<Voucher[]>(() => sortVouchers(initialVouchers));
  const [movements, setMovements] = useState<VoucherMovement[]>(initialMovements);
  const [todaySales, setTodaySales] = useState<TodaySaleItem[]>(initialTodaySales);

  const [activeTab, setActiveTab] = useState<"DAILY_SALES" | "CATALOG" | "RECAP" | "MOVEMENTS">("DAILY_SALES");
  const [selectedOperator, setSelectedOperator] = useState("Semua");
  const [search, setSearch] = useState("");
  const [onlyLowStock, setOnlyLowStock] = useState(false);

  // Tanggal pencatatan & rekapan penjualan voucher (default: hari ini)
  const [selectedRecordDate, setSelectedRecordDate] = useState<string>(getTodayString);

  // Riwayat Rekapan Voucher State
  const [recapRange, setRecapRange] = useState<"DAILY" | "WEEKLY" | "MONTHLY">("DAILY");
  const [recapDate, setRecapDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [recapMonth, setRecapMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [recapData, setRecapData] = useState<any>(null);
  const [recapLoading, setRecapLoading] = useState<boolean>(false);
  const [recapSourceFilter, setRecapSourceFilter] = useState<"ALL" | "POS" | "DAILY_RECORD">("ALL");
  const [recapSearch, setRecapSearch] = useState<string>("");
  const [exportLoading, setExportLoading] = useState<boolean>(false);

  const handleExportExcel = async () => {
    setExportLoading(true);
    try {
      let startDate = "";
      let endDate = "";

      if (activeTab === "RECAP") {
        if (recapRange === "DAILY") {
          startDate = `${recapDate}T00:00:00.000`;
          endDate = `${recapDate}T23:59:59.999`;
        } else if (recapRange === "MONTHLY") {
          const parts = recapMonth.split("-").map(Number);
          if (parts.length === 2) {
            const year = parts[0];
            const month = parts[1];
            const startMonth = new Date(year, month - 1, 1, 0, 0, 0, 0);
            const endMonth = new Date(year, month, 0, 23, 59, 59, 999);
            startDate = startMonth.toISOString();
            endDate = endMonth.toISOString();
          }
        } else if (recapRange === "WEEKLY") {
          const curr = new Date(recapDate);
          const first = curr.getDate() - curr.getDay() + 1; // Monday
          const monday = new Date(curr.setDate(first));
          monday.setHours(0, 0, 0, 0);
          const sunday = new Date(monday);
          sunday.setDate(monday.getDate() + 6);
          sunday.setHours(23, 59, 59, 999);
          startDate = monday.toISOString();
          endDate = sunday.toISOString();
        }
      } else if (activeTab === "DAILY_SALES") {
        startDate = `${selectedRecordDate}T00:00:00.000`;
        endDate = `${selectedRecordDate}T23:59:59.999`;
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

  const fetchRecapData = async (
    range = recapRange,
    date = recapDate,
    month = recapMonth
  ) => {
    setRecapLoading(true);
    try {
      const res = await fetch(
        `/api/vouchers/recap?range=${range}&date=${date}&month=${month}`
      );
      const data = await res.json();
      if (res.ok) {
        setRecapData(data);
      }
    } catch (err) {
      console.error("Recap fetch error:", err);
    } finally {
      setRecapLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "RECAP") {
      fetchRecapData(recapRange, recapDate, recapMonth);
    }
  }, [activeTab, recapRange, recapDate, recapMonth]);

  // Refresh helpers
  const refreshVouchersData = async () => {
    try {
      const [vouchersRes, movementsRes] = await Promise.all([
        fetch("/api/vouchers"),
        fetch("/api/vouchers/movements?limit=60"),
      ]);
      const vData = await vouchersRes.json();
      const mData = await movementsRes.json();
      if (vData.vouchers) setVouchers(sortVouchers(vData.vouchers));
      if (mData.movements) setMovements(mData.movements);
    } catch (e) {
      console.error(e);
    }
  };

  const refreshSalesData = async (date = selectedRecordDate) => {
    try {
      const salesRes = await fetch(`/api/vouchers/daily-sales?date=${date}`);
      const sData = await salesRes.json();
      if (sData.saleItems) setTodaySales(sData.saleItems);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    refreshSalesData(selectedRecordDate);
  }, [selectedRecordDate]);

  // Remaining Stock inputs for daily sales recording (voucherId -> string input)
  // User enters REMAINING stock (SISA), so sold quantity is automatically calculated
  const [remainingStockInputs, setRemainingStockInputs] = useState<Record<string, string>>({});

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isStockInModalOpen, setIsStockInModalOpen] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [editingVoucher, setEditingVoucher] = useState<Voucher | null>(null);
  const [voucherToDelete, setVoucherToDelete] = useState<Voucher | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Correction Modal
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [selectedCorrectionItem, setSelectedCorrectionItem] = useState<TodaySaleItem | null>(null);
  const [correctedQty, setCorrectedQty] = useState<number>(0);
  const [correctedPrice, setCorrectedPrice] = useState<number>(0);

  // Cancellation / Deletion Modal for recorded sales
  const [saleItemToDelete, setSaleItemToDelete] = useState<TodaySaleItem | null>(null);
  const [deleteSaleItemLoading, setDeleteSaleItemLoading] = useState(false);

  // Forms
  const [newVoucherForm, setNewVoucherForm] = useState({
    operator: "Telkomsel",
    nominal: "",
    costPrice: 0,
    sellingPrice: 0,
    stock: 0,
    minStock: 10,
  });

  const [stockInForm, setStockInForm] = useState({
    voucherId: "",
    quantity: 10,
    costPrice: 0,
    notes: "Stok masuk voucher fisik",
  });

  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Metrics
  const totalTypes = vouchers.length;
  const totalStock = vouchers.reduce((sum, v) => sum + v.stock, 0);
  const totalAssetValue = vouchers.reduce((sum, v) => sum + v.stock * v.costPrice, 0);
  const lowStockCount = vouchers.filter((v) => v.stock <= v.minStock).length;

  // Filtered Vouchers
  const filteredVouchers = vouchers.filter((v) => {
    const matchesOperator =
      selectedOperator === "Semua" || v.operator.toLowerCase() === selectedOperator.toLowerCase();
    const matchesSearch =
      v.operator.toLowerCase().includes(search.toLowerCase()) ||
      v.nominal.toLowerCase().includes(search.toLowerCase());
    const matchesLowStock = !onlyLowStock || v.stock <= v.minStock;

    return matchesOperator && matchesSearch && matchesLowStock;
  });

  // Calculate daily sales estimation from SISA inputs
  const calculateItemSales = (voucher: Voucher) => {
    const sisaInput = remainingStockInputs[voucher.id];
    if (sisaInput === undefined || sisaInput === "") {
      return { sisa: voucher.stock, sold: 0, subtotal: 0 };
    }
    const sisa = Math.max(0, parseInt(sisaInput, 10) || 0);
    const sold = Math.max(0, voucher.stock - sisa);
    const subtotal = sold * voucher.sellingPrice;
    return { sisa, sold, subtotal };
  };

  const totalEstimatedSales = vouchers.reduce((sum, v) => {
    const { subtotal } = calculateItemSales(v);
    return sum + subtotal;
  }, 0);

  const handleSisaChange = (voucherId: string, val: string) => {
    setRemainingStockInputs((prev) => ({
      ...prev,
      [voucherId]: val,
    }));
  };

  const handleSaveDailySales = async () => {
    const itemsToSubmit: { voucherId: string; remainingStock: number }[] = [];

    vouchers.forEach((v) => {
      const { sisa, sold } = calculateItemSales(v);
      if (sold > 0) {
        itemsToSubmit.push({
          voucherId: v.id,
          remainingStock: sisa,
        });
      }
    });

    if (itemsToSubmit.length === 0) {
      setErrorMessage("Belum ada perubahan sisa stok (terjual) yang diisi.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch("/api/vouchers/daily-sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: itemsToSubmit,
          date: selectedRecordDate,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan laporan penjualan");

      setSuccessMessage(`Laporan penjualan voucher untuk tanggal ${formatIndoDate(selectedRecordDate)} berhasil disimpan!`);

      // Reset Sisa inputs
      setRemainingStockInputs({});

      // Refresh data
      await Promise.all([
        refreshVouchersData(),
        refreshSalesData(selectedRecordDate),
        activeTab === "RECAP" ? fetchRecapData(recapRange, recapDate, recapMonth) : Promise.resolve(),
      ]);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openCorrectionModal = (item: TodaySaleItem) => {
    setSelectedCorrectionItem(item);
    setCorrectedQty(item.quantity);
    setCorrectedPrice(item.unitPrice || 0);
    setIsCorrectionModalOpen(true);
    setErrorMessage(null);
  };

  const handleSaveCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCorrectionItem) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/vouchers/daily-sales", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleItemId: selectedCorrectionItem.id,
          newQuantity: Number(correctedQty),
          newUnitPrice: Number(correctedPrice),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengoreksi laporan penjualan");

      setSuccessMessage("Koreksi penjualan berhasil disimpan!");
      setIsCorrectionModalOpen(false);

      // Refresh data
      await Promise.all([
        refreshVouchersData(),
        refreshSalesData(selectedRecordDate),
        activeTab === "RECAP" ? fetchRecapData(recapRange, recapDate, recapMonth) : Promise.resolve(),
      ]);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSaleItem = async () => {
    if (!saleItemToDelete) return;

    setDeleteSaleItemLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/vouchers/daily-sales?saleItemId=${saleItemToDelete.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membatalkan pencatatan penjualan");

      setSuccessMessage(data.message || "Pencatatan penjualan voucher berhasil dibatalkan!");
      setSaleItemToDelete(null);

      // Refresh data
      await Promise.all([
        refreshVouchersData(),
        refreshSalesData(selectedRecordDate),
        activeTab === "RECAP" ? fetchRecapData(recapRange, recapDate, recapMonth) : Promise.resolve(),
      ]);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setDeleteSaleItemLoading(false);
    }
  };

  const openStockInFor = (v: Voucher) => {
    setSelectedVoucher(v);
    setStockInForm({
      voucherId: v.id,
      quantity: 10,
      costPrice: v.costPrice,
      notes: "Penerimaan stok voucher fisik",
    });
    setErrorMessage(null);
    setIsStockInModalOpen(true);
  };

  const handleCreateVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newVoucherForm,
          costPrice: Number(newVoucherForm.costPrice),
          sellingPrice: Number(newVoucherForm.sellingPrice),
          stock: Number(newVoucherForm.stock),
          minStock: Number(newVoucherForm.minStock),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membuat voucher");

      setVouchers((prev) => sortVouchers([...prev, data.voucher]));
      setIsAddModalOpen(false);
      setNewVoucherForm({
        operator: "Telkomsel",
        nominal: "",
        costPrice: 0,
        sellingPrice: 0,
        stock: 0,
        minStock: 10,
      });
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStockIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/vouchers/stock-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voucherId: stockInForm.voucherId,
          quantity: Number(stockInForm.quantity),
          costPrice: Number(stockInForm.costPrice),
          notes: stockInForm.notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menambah stok voucher");

      setVouchers((prev) =>
        sortVouchers(prev.map((v) => (v.id === data.voucher.id ? data.voucher : v)))
      );
      setMovements([data.movement, ...movements]);
      setIsStockInModalOpen(false);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getOperatorBadgeClass = (op: string) => {
    const o = op.toLowerCase();
    if (o.includes("telkomsel")) return "bg-red-50 text-red-600 border-red-200";
    if (o.includes("indosat")) return "bg-amber-50 text-amber-700 border-amber-200";
    if (o.includes("xl")) return "bg-blue-50 text-blue-600 border-blue-200";
    if (o.includes("tri") || o.includes("three")) return "bg-orange-50 text-orange-600 border-orange-200";
    if (o.includes("smartfren")) return "bg-rose-50 text-rose-600 border-rose-200";
    if (o.includes("axis")) return "bg-purple-50 text-purple-600 border-purple-200";
    return "bg-slate-100 text-slate-700 border-slate-200";
  };

  const handleDeleteVoucher = async () => {
    if (!voucherToDelete) return;
    setDeleteLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await fetch(`/api/vouchers/${voucherToDelete.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapus voucher");

      setVouchers((prev) => prev.filter((v) => v.id !== voucherToDelete.id));
      setVoucherToDelete(null);
      if (editingVoucher?.id === voucherToDelete.id) {
        setEditingVoucher(null);
      }
      setSuccessMessage(data.message || "Voucher berhasil dihapus");
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleUpdateVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVoucher) return;
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await fetch(`/api/vouchers/${editingVoucher.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          costPrice: Number(editingVoucher.costPrice),
          sellingPrice: Number(editingVoucher.sellingPrice),
          stock: Number(editingVoucher.stock),
          minStock: Number(editingVoucher.minStock),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memperbarui voucher");

      setVouchers((prev) =>
        sortVouchers(
          prev.map((v) => (v.id === editingVoucher.id ? { ...v, ...data.voucher } : v))
        )
      );
      setEditingVoucher(null);
      setSuccessMessage("Data voucher & stok berhasil diperbarui!");
      refreshVouchersData();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Aggregated today sales summary
  const todayTotalQty = todaySales.reduce((sum, item) => sum + item.quantity, 0);
  const todayTotalAmount = todaySales.reduce((sum, item) => sum + item.subtotal, 0);

  // Filtered recap sales list
  const filteredRecapSales = (recapData?.salesList || []).filter((s: any) => {
    const matchesSource =
      recapSourceFilter === "ALL" || s.source === recapSourceFilter;
    const q = recapSearch.toLowerCase().trim();
    const matchesSearch =
      !q ||
      s.invoiceNumber.toLowerCase().includes(q) ||
      s.itemName.toLowerCase().includes(q) ||
      s.operator.toLowerCase().includes(q) ||
      (s.customerName && s.customerName.toLowerCase().includes(q)) ||
      (s.cashierName && s.cashierName.toLowerCase().includes(q));
    return matchesSource && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Ticket className="w-6 h-6 text-indigo-600" />
            <span>Manajemen & Pencatatan Voucher HP</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Pencatatan sisa stok voucher fisik harian, otomatis menghitung jumlah terjual & total pendapatan
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleExportExcel}
            disabled={exportLoading}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all active:scale-[0.98] disabled:opacity-60"
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
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Voucher Baru</span>
          </button>
        </div>
      </div>

      {/* Alert Messages */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-2xl flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-500 hover:text-emerald-700">
            ✕
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-2xl flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-500 hover:text-rose-700">
            ✕
          </button>
        </div>
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <Ticket className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Jenis Voucher</p>
            <p className="text-xl font-bold text-slate-900">{totalTypes} jenis</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Total Stok Fisik</p>
            <p className="text-xl font-bold text-blue-600">{totalStock} pcs</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Terjual Hari Ini</p>
            <p className="text-xl font-bold text-emerald-600">{todayTotalQty} pcs</p>
          </div>
        </div>

        <div
          onClick={() => setOnlyLowStock(!onlyLowStock)}
          className={`p-4 rounded-2xl border shadow-sm flex items-center gap-3 cursor-pointer transition-all ${
            onlyLowStock
              ? "bg-rose-50 border-rose-300 ring-2 ring-rose-400/30"
              : "bg-white border-slate-200/80 hover:border-rose-200"
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-rose-700 font-medium">Stok Menipis</p>
            <p className="text-xl font-bold text-rose-800">{lowStockCount} jenis</p>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("DAILY_SALES")}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 flex items-center gap-2 transition-all ${
            activeTab === "DAILY_SALES"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Pencatatan Penjualan (Input Sisa)</span>
        </button>

        <button
          onClick={() => setActiveTab("CATALOG")}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 flex items-center gap-2 transition-all ${
            activeTab === "CATALOG"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Ticket className="w-4 h-4" />
          <span>Katalog & Persediaan ({vouchers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("RECAP")}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 flex items-center gap-2 transition-all ${
            activeTab === "RECAP"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Riwayat Rekapan Voucher</span>
        </button>

        <button
          onClick={() => setActiveTab("MOVEMENTS")}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 flex items-center gap-2 transition-all ${
            activeTab === "MOVEMENTS"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <History className="w-4 h-4" />
          <span>Buku Mutasi Voucher ({movements.length})</span>
        </button>
      </div>

      {/* TAB 1: PENCATATAN PENJUALAN VOUCHER (INPUT SISA STOK) */}
      {activeTab === "DAILY_SALES" && (
        <div className="space-y-6">

          {/* Bar Kontrol Pemilihan Tanggal Rekapan */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mr-1">
                <Calendar className="w-4 h-4 text-indigo-600" />
                Pilih Tanggal Rekapan:
              </span>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setSelectedRecordDate(getTodayString())}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    selectedRecordDate === getTodayString()
                      ? "bg-white text-indigo-700 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Hari Ini
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRecordDate(getYesterdayString())}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    selectedRecordDate === getYesterdayString()
                      ? "bg-white text-indigo-700 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Kemarin
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2.5 w-full md:w-auto">
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700">
                <Calendar className="w-4 h-4 text-indigo-600" />
                <input
                  type="date"
                  value={selectedRecordDate}
                  onChange={(e) => setSelectedRecordDate(e.target.value)}
                  className="bg-transparent border-none text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                />
              </div>

              <span className="text-xs font-bold text-indigo-900 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-xl hidden sm:inline-block">
                {formatIndoDate(selectedRecordDate)}
              </span>

              <button
                type="button"
                onClick={() => {
                  refreshSalesData(selectedRecordDate);
                  refreshVouchersData();
                }}
                title="Segarkan data tanggal ini"
                className="p-2 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 rounded-xl transition-all"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Banner Peringatan jika merekap tanggal masa lalu */}
          {selectedRecordDate !== getTodayString() && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold">
                    Mode Rekap Mundur / Cross-Cek Tanggal: {formatIndoDate(selectedRecordDate)}
                  </p>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    Data penjualan yang Anda simpan pada form di bawah akan tercatat resmi pada tanggal <strong>{selectedRecordDate}</strong>. Anda juga bisa mengoreksi rekapan yang salah di tabel bawah.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecordDate(getTodayString())}
                className="shrink-0 px-3 py-1.5 bg-white border border-amber-300 hover:bg-amber-100 font-bold text-amber-900 rounded-xl text-xs transition-all shadow-sm"
              >
                Kembali ke Hari Ini
              </button>
            </div>
          )}

          {/* Card 1: Input Form Tabel Penjualan Voucher */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden space-y-4">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gradient-to-r from-slate-50 to-indigo-50/30">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex flex-wrap items-center gap-2">
                  <Calendar className="w-5 h-5 text-indigo-600" />
                  <span>Form Pencatatan Penjualan Voucher</span>
                  <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700">
                    {formatIndoDate(selectedRecordDate)}
                  </span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Input <strong>SISA STOK</strong> voucher fisik saat ini. Sistem akan otomatis menghitung jumlah terjual & subtotal untuk tanggal {formatIndoDate(selectedRecordDate)}.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto px-5">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3.5 px-3">Nama Voucher</th>
                    <th className="py-3.5 px-3 text-center">Stok Awal</th>
                    <th className="py-3.5 px-3 text-center">Terjual (Pcs)</th>
                    <th className="py-3.5 px-3 text-center">Sisa Stok</th>
                    <th className="py-3.5 px-3 text-right">Harga Jual</th>
                    <th className="py-3.5 px-3 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {vouchers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                        Belum ada jenis voucher terdaftar. Silakan tambah voucher terlebih dahulu.
                      </td>
                    </tr>
                  ) : (
                    vouchers.map((v) => {
                      const { sisa, sold, subtotal } = calculateItemSales(v);
                      const sisaInputValue =
                        remainingStockInputs[v.id] !== undefined
                          ? remainingStockInputs[v.id]
                          : v.stock;

                      return (
                        <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-4 px-3">
                            <div>
                              <p className="font-bold text-slate-900 text-xs">
                                Voucher Fisik {v.operator} {v.nominal}
                              </p>
                              <p className="text-[10px] text-slate-400 mt-0.5">{v.operator}</p>
                            </div>
                          </td>
                          <td className="py-4 px-3 text-center font-medium text-slate-600">
                            {v.stock} pcs
                          </td>
                          <td className="py-4 px-3 text-center">
                            <div
                              className={`inline-flex items-center justify-center min-w-16 px-3 py-1.5 rounded-full font-extrabold text-xs transition-all ${
                                sold > 0
                                  ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200"
                                  : "bg-slate-100 text-slate-400"
                              }`}
                            >
                              {sold} pcs
                            </div>
                          </td>
                          <td className="py-4 px-3 text-center">
                            <input
                              type="number"
                              min="0"
                              max={v.stock}
                              value={sisaInputValue}
                              onChange={(e) => handleSisaChange(v.id, e.target.value)}
                              className="w-24 text-center bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl py-1.5 px-3 font-extrabold text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-inner"
                              placeholder={String(v.stock)}
                            />
                          </td>
                          <td className="py-4 px-3 text-right font-semibold text-slate-600">
                            {formatRupiah(v.sellingPrice)}
                          </td>
                          <td className="py-4 px-3 text-right font-extrabold text-emerald-600 text-sm">
                            {formatRupiah(subtotal)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer Form Input */}
            <div className="p-5 bg-slate-50/80 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Estimasi Total Penjualan ({formatIndoDate(selectedRecordDate)})
                </p>
                <p className="text-2xl font-extrabold text-emerald-600 mt-0.5">
                  {formatRupiah(totalEstimatedSales)}
                </p>
              </div>

              <button
                onClick={handleSaveDailySales}
                disabled={loading || totalEstimatedSales === 0}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white rounded-2xl font-bold text-sm shadow-lg shadow-indigo-600/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
              >
                <Save className="w-4 h-4" />
                <span>
                  {loading
                    ? "Menyimpan Laporan..."
                    : `SIMPAN REKAP TANGGAL ${selectedRecordDate === getTodayString() ? "HARI INI" : selectedRecordDate}`}
                </span>
              </button>
            </div>
          </div>

          {/* Card 2: ARSIP & LAPORAN - Rekap Penjualan Voucher Tanggal Terpilih */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
                  Arsip & Laporan
                </span>
                <h3 className="text-xl font-extrabold text-slate-900 tracking-tight mt-2 flex items-center gap-2">
                  <span>
                    Rekap Penjualan Voucher: {selectedRecordDate === getTodayString() ? "Hari Ini" : formatIndoDate(selectedRecordDate)}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Rekapitulasi total voucher fisik yang telah tercatat terjual pada tanggal ini ({todaySales.length} transaksi). Anda dapat mengoreksi jumlah terjual atau membatalkan rekapan jika terdapat kesalahan input.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => refreshSalesData(selectedRecordDate)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Segarkan</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-100">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-50/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200/80">
                    <th className="py-3.5 px-4">Waktu</th>
                    <th className="py-3.5 px-4">Nama Voucher</th>
                    <th className="py-3.5 px-4 text-center">Sumber</th>
                    <th className="py-3.5 px-4 text-right">Harga Satuan</th>
                    <th className="py-3.5 px-4 text-center">Jumlah Terjual</th>
                    <th className="py-3.5 px-4 text-right">Total Uang</th>
                    <th className="py-3.5 px-4 text-center">Kasir</th>
                    <th className="py-3.5 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {todaySales.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-10 text-center text-slate-400">
                        <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="font-bold text-slate-600 text-sm">
                          Belum ada pencatatan penjualan voucher pada tanggal {formatIndoDate(selectedRecordDate)}.
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Input sisa stok pada form di atas lalu klik tombol simpan untuk mencatat penjualan voucher tanggal ini.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    todaySales.map((item) => {
                      const isPOS = item.sale?.invoiceNumber && !item.sale.invoiceNumber.startsWith("VCH-");
                      const itemDate = item.sale?.createdAt ? new Date(item.sale.createdAt) : null;
                      const timeStr = itemDate
                        ? itemDate.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WIB"
                        : "-";

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-4 px-4 whitespace-nowrap">
                            <span className="font-bold text-slate-900 block font-mono text-xs">
                              {timeStr}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              #{item.sale?.invoiceNumber || "-"}
                            </span>
                          </td>
                          <td className="py-4 px-4 font-bold text-slate-900">
                            <div>{item.itemName}</div>
                            {item.voucher && (
                              <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-md text-[10px] font-bold border ${getOperatorBadgeClass(item.voucher.operator)}`}>
                                {item.voucher.operator}
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-center whitespace-nowrap">
                            {isPOS ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200/80 text-[10px] font-extrabold">
                                🛒 Kasir POS
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[10px] font-extrabold">
                                📝 Sisa Stok
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-right font-semibold text-slate-600 whitespace-nowrap">
                            {formatRupiah(item.unitPrice)}
                          </td>
                          <td className="py-4 px-4 text-center font-extrabold text-slate-900 text-sm whitespace-nowrap">
                            <span className="inline-block px-2.5 py-1 rounded-lg bg-slate-100 text-slate-900 font-black">
                              {item.quantity} pcs
                            </span>
                          </td>
                          <td className="py-4 px-4 text-right font-extrabold text-emerald-600 text-sm whitespace-nowrap">
                            {formatRupiah(item.subtotal)}
                          </td>
                          <td className="py-4 px-4 text-center text-slate-600 whitespace-nowrap text-xs">
                            {item.sale?.cashier?.name || "Kasir"}
                          </td>
                          <td className="py-4 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => openCorrectionModal(item)}
                                title="Koreksi kuantitas terjual"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/70 rounded-xl text-xs font-bold transition-all active:scale-95"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Koreksi</span>
                              </button>
                              <button
                                onClick={() => setSaleItemToDelete(item)}
                                title="Batalkan / Hapus rekapan ini (kembalikan stok)"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/70 rounded-xl text-xs font-bold transition-all active:scale-95"
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

                  {/* Summary Row */}
                  {todaySales.length > 0 && (
                    <tr className="bg-slate-50/90 font-bold border-t-2 border-slate-200 text-slate-900">
                      <td colSpan={4} className="py-4 px-4 text-sm font-extrabold text-slate-900">
                        Total Penjualan Tanggal {selectedRecordDate === getTodayString() ? "Hari Ini" : selectedRecordDate}
                      </td>
                      <td className="py-4 px-4 text-center font-extrabold text-slate-900 text-sm">
                        {todayTotalQty} pcs
                      </td>
                      <td className="py-4 px-4 text-right font-extrabold text-emerald-600 text-base">
                        {formatRupiah(todayTotalAmount)}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RIWAYAT REKAPAN VOUCHER HP */}
      {activeTab === "RECAP" && (
        <div className="space-y-5 animate-in fade-in">
          {/* Filter Bar: Per Tanggal, Per Minggu, Per Bulan */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mr-1">
                <Filter className="w-3.5 h-3.5" />
                Filter Rekapan:
              </span>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setRecapRange("DAILY")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    recapRange === "DAILY"
                      ? "bg-white text-indigo-700 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Per Tanggal
                </button>
                <button
                  type="button"
                  onClick={() => setRecapRange("WEEKLY")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    recapRange === "WEEKLY"
                      ? "bg-white text-indigo-700 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Per Minggu (7 Hari)
                </button>
                <button
                  type="button"
                  onClick={() => setRecapRange("MONTHLY")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    recapRange === "MONTHLY"
                      ? "bg-white text-indigo-700 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Per Bulan
                </button>
              </div>
            </div>

            {/* Date Pickers */}
            <div className="flex items-center gap-2.5 w-full md:w-auto">
              {recapRange === "DAILY" && (
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700">
                  <Calendar className="w-4 h-4 text-indigo-600" />
                  <input
                    type="date"
                    value={recapDate}
                    onChange={(e) => setRecapDate(e.target.value)}
                    className="bg-transparent border-none text-xs font-bold text-slate-800 focus:outline-none"
                  />
                </div>
              )}

              {recapRange === "MONTHLY" && (
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700">
                  <Calendar className="w-4 h-4 text-indigo-600" />
                  <input
                    type="month"
                    value={recapMonth}
                    onChange={(e) => setRecapMonth(e.target.value)}
                    className="bg-transparent border-none text-xs font-bold text-slate-800 focus:outline-none"
                  />
                </div>
              )}

              <button
                type="button"
                onClick={() => fetchRecapData(recapRange, recapDate, recapMonth)}
                disabled={recapLoading}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${recapLoading ? "animate-spin" : ""}`} />
                <span>Muat Ulang</span>
              </button>
            </div>
          </div>

          {/* KPI CARDS: Jumlah Terjual, Total Uang, dan Laba */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Card 1: Jumlah yang Terjual */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Jumlah Terjual
                </span>
                <div className="w-9 h-9 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Ticket className="w-5 h-5" />
                </div>
              </div>
              <p className="text-2xl font-black text-slate-900">
                {recapData?.summary?.totalSold || 0}{" "}
                <span className="text-sm font-bold text-slate-400">pcs</span>
              </p>
              <p className="text-[11px] text-slate-500">
                Total fisik voucher berpindah ke pelanggan
              </p>
            </div>

            {/* Card 2: Total Uang (Omset Penjualan) */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Total Uang (Omset)
                </span>
                <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
              <p className="text-2xl font-black text-emerald-600">
                {formatRupiah(recapData?.summary?.totalRevenue || 0)}
              </p>
              <p className="text-[11px] text-slate-500">
                Akumulasi penerimaan kas & penjualan voucher
              </p>
            </div>

            {/* Card 3: Laba (Keuntungan Bersih) - Sesuai RBAC */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Laba (Keuntungan)
                </span>
                <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <BarChart3 className="w-5 h-5" />
                </div>
              </div>

              {userRole === "OWNER" ? (
                <>
                  <p className="text-2xl font-black text-amber-700">
                    {formatRupiah(recapData?.summary?.totalProfit || 0)}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Margin:{" "}
                    <strong className="text-amber-800">
                      {recapData?.summary?.profitMarginPct || 0}%
                    </strong>{" "}
                    dari total omset
                  </p>
                </>
              ) : (
                <div className="pt-1 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1.5 rounded-xl">
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Terproteksi (Khusus Owner)</span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Kerahasiaan margin & harga modal dilindungi RBAC
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* TABEL REKAPAN AGREGASI (BUKAN LIST ITEM VOUCHER) */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden space-y-4">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  Rekapitulasi Penjualan Harian & Periode
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ringkasan agregasi kuantitas terjual, omset, dan laba berdasarkan periode
                </p>
              </div>
              <span className="text-xs font-bold px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200/60 rounded-xl">
                {recapRange === "DAILY"
                  ? "Rekap Harian"
                  : recapRange === "WEEKLY"
                  ? "Rekap Mingguan"
                  : "Rekap Bulanan"}
              </span>
            </div>

            <div className="overflow-x-auto px-5 pb-5">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-3">Periode / Tanggal</th>
                    <th className="py-3 px-3 text-center">Jumlah Terjual (Pcs)</th>
                    <th className="py-3 px-3 text-right">Total Uang (Omset)</th>
                    <th className="py-3 px-3 text-right">
                      {userRole === "OWNER" ? "Laba (Keuntungan)" : "Laba (RBAC)"}
                    </th>
                    <th className="py-3 px-3 text-left">Rincian Per Operator</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {recapLoading ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-1 text-indigo-600" />
                        <span>Memuat data rekapan voucher...</span>
                      </td>
                    </tr>
                  ) : !recapData?.dailyBreakdown || recapData.dailyBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        <Ticket className="w-9 h-9 mx-auto mb-2 text-slate-300 stroke-[1.5]" />
                        <p className="font-bold text-slate-600 text-sm">Belum ada transaksi penjualan voucher pada periode ini</p>
                        <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                          Transaksi voucher fisik akan otomatis terakumulasi di sini saat kasir melakukan penjualan via POS Kasir atau mencatat via tab Penjualan Harian.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    recapData.dailyBreakdown.map((row: any) => (
                      <tr key={row.dateStr} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-3 font-extrabold text-slate-800">
                          {row.label}
                        </td>
                        <td className="py-3.5 px-3 text-center font-black text-indigo-600 text-sm">
                          {row.soldCount} pcs
                        </td>
                        <td className="py-3.5 px-3 text-right font-extrabold text-emerald-600">
                          {formatRupiah(row.revenue)}
                        </td>
                        <td className="py-3.5 px-3 text-right font-extrabold">
                          {userRole === "OWNER" ? (
                            <span className="text-amber-700">{formatRupiah(row.profit)}</span>
                          ) : (
                            <span className="text-slate-400 italic font-mono text-[11px]">
                              Terkunci
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(row.operators || {}).map(([op, qty]: any) => (
                              <span
                                key={op}
                                className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[10px]"
                              >
                                {op}: {qty}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* TABEL REKAPAN PER OPERATOR */}
          {recapData?.operatorBreakdown && recapData.operatorBreakdown.length > 0 && (
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden space-y-4">
              <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                <h3 className="font-extrabold text-slate-900 text-base">
                  Rekapitulasi Penjualan per Operator Provider
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Distribusi penjualan voucher fisik berdasarkan provider telekomunikasi
                </p>
              </div>

              <div className="overflow-x-auto px-5 pb-5">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-3">Provider Operator</th>
                      <th className="py-3 px-3 text-center">Jumlah Terjual (Pcs)</th>
                      <th className="py-3 px-3 text-right">Total Uang (Omset)</th>
                      <th className="py-3 px-3 text-right">
                        {userRole === "OWNER" ? "Total Laba" : "Laba"}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {recapData.operatorBreakdown.map((opRow: any) => (
                      <tr key={opRow.operator} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-3 font-bold text-slate-800 flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-lg text-xs font-bold border ${getOperatorBadgeClass(opRow.operator)}`}>
                            {opRow.operator}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-center font-black text-slate-900">
                          {opRow.soldCount} pcs
                        </td>
                        <td className="py-3.5 px-3 text-right font-extrabold text-emerald-600">
                          {formatRupiah(opRow.revenue)}
                        </td>
                        <td className="py-3.5 px-3 text-right font-extrabold">
                          {userRole === "OWNER" ? (
                            <span className="text-amber-700">{formatRupiah(opRow.profit)}</span>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Terkunci</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TABEL LIST RINCIAN TRANSAKSI PENJUALAN VOUCHER (KASIR POS & PENCATATAN SISA STOK) */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden space-y-4">
            <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
                  <span>Daftar Transaksi Penjualan Voucher</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Daftar transaksi voucher yang terjual baik dari <strong>Kasir POS</strong> maupun <strong>Pencatatan Sisa Stok</strong>
                </p>
              </div>

              {/* Filter Sumber & Search */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Source Filter Pills */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setRecapSourceFilter("ALL")}
                    className={`px-3 py-1.5 rounded-xl transition-all ${
                      recapSourceFilter === "ALL"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    Semua ({recapData?.salesList?.length || 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecapSourceFilter("POS")}
                    className={`px-3 py-1.5 rounded-xl transition-all ${
                      recapSourceFilter === "POS"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    Kasir POS ({recapData?.summary?.posCount || 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecapSourceFilter("DAILY_RECORD")}
                    className={`px-3 py-1.5 rounded-xl transition-all ${
                      recapSourceFilter === "DAILY_RECORD"
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    Sisa Stok ({recapData?.summary?.dailyRecordCount || 0})
                  </button>
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={recapSearch}
                    onChange={(e) => setRecapSearch(e.target.value)}
                    placeholder="Cari no. faktur / voucher / pelanggan..."
                    className="bg-white border border-slate-200 rounded-xl pl-8 pr-7 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {recapSearch && (
                    <button
                      type="button"
                      onClick={() => setRecapSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto px-5 pb-5">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-3">Waktu</th>
                    <th className="py-3 px-3">Sumber</th>
                    <th className="py-3 px-3">No. Faktur</th>
                    <th className="py-3 px-3">Voucher & Nominal</th>
                    <th className="py-3 px-3 text-center">Jumlah (Qty)</th>
                    <th className="py-3 px-3 text-right">Harga Jual</th>
                    <th className="py-3 px-3 text-right">Total Uang</th>
                    <th className="py-3 px-3 text-right">
                      {userRole === "OWNER" ? "Laba" : "Laba"}
                    </th>
                    <th className="py-3 px-3 text-center">Metode & Status</th>
                    <th className="py-3 px-3">Pelanggan / Kasir</th>
                    <th className="py-3 px-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {recapLoading ? (
                    <tr>
                      <td colSpan={11} className="py-8 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-1 text-indigo-600" />
                        <span>Memuat data transaksi...</span>
                      </td>
                    </tr>
                  ) : filteredRecapSales.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-10 text-center text-slate-400">
                        <p className="font-semibold text-slate-600">Tidak ada transaksi voucher ditemukan</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {recapSearch
                            ? "Coba ganti kata kunci pencarian Anda"
                            : "Belum ada transaksi voucher pada periode dan filter sumber yang dipilih"}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredRecapSales.map((item: any) => {
                      const date = new Date(item.createdAt);
                      const dateStr = date.toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      });
                      const timeStr = date.toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                      });

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                          {/* Waktu */}
                          <td className="py-3.5 px-3 whitespace-nowrap">
                            <div className="font-bold text-slate-900">{dateStr}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{timeStr} WIB</div>
                          </td>

                          {/* Sumber */}
                          <td className="py-3.5 px-3 whitespace-nowrap">
                            {item.source === "POS" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200/80 text-[10px] font-extrabold">
                                🛒 Kasir POS
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[10px] font-extrabold">
                                📝 Sisa Stok
                              </span>
                            )}
                          </td>

                          {/* No Faktur */}
                          <td className="py-3.5 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                            #{item.invoiceNumber}
                          </td>

                          {/* Voucher & Nominal */}
                          <td className="py-3.5 px-3">
                            <div className="flex items-center gap-1.5">
                              <span className={`px-2 py-0.5 rounded-lg text-xs font-bold border ${getOperatorBadgeClass(item.operator)}`}>
                                {item.operator}
                              </span>
                              <span className="font-extrabold text-slate-800">{item.itemName}</span>
                            </div>
                          </td>

                          {/* Quantity */}
                          <td className="py-3.5 px-3 text-center font-black text-slate-900 text-sm whitespace-nowrap">
                            {item.quantity} pcs
                          </td>

                          {/* Harga Satuan */}
                          <td className="py-3.5 px-3 text-right font-medium text-slate-600 whitespace-nowrap">
                            {formatRupiah(item.unitPrice)}
                          </td>

                          {/* Total Uang */}
                          <td className="py-3.5 px-3 text-right font-extrabold text-emerald-600 whitespace-nowrap">
                            {formatRupiah(item.subtotal)}
                          </td>

                          {/* Laba */}
                          <td className="py-3.5 px-3 text-right font-extrabold whitespace-nowrap">
                            {userRole === "OWNER" ? (
                              <span className={item.isRealized ? "text-amber-700" : "text-slate-400"}>
                                {item.isRealized ? formatRupiah(item.profit) : "(Tertunda)"}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">Terkunci</span>
                            )}
                          </td>

                          {/* Metode & Status */}
                          <td className="py-3.5 px-3 text-center whitespace-nowrap">
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-700">
                                {item.paymentMethod === "CREDIT" ? "KREDIT / NOTA" : item.paymentMethod}
                              </span>
                              {item.paymentStatus === "PAID" ? (
                                <span className="text-[9px] font-bold text-emerald-600">● Lunas</span>
                              ) : (
                                <span className="text-[9px] font-bold text-rose-600">● Belum Lunas</span>
                              )}
                            </div>
                          </td>

                          {/* Pelanggan / Kasir */}
                          <td className="py-3.5 px-3 whitespace-nowrap">
                            {item.customerName ? (
                              <div>
                                <span className="font-extrabold text-slate-900 text-xs">
                                  {item.customerName}
                                </span>
                                <div className="text-[10px] text-slate-400">
                                  Kasir: {item.cashierName}
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-500 text-xs">
                                Kasir: {item.cashierName}
                              </span>
                            )}
                          </td>

                          {/* Aksi Koreksi & Batal */}
                          <td className="py-3.5 px-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  openCorrectionModal({
                                    id: item.id,
                                    itemName: item.itemName,
                                    quantity: item.quantity,
                                    unitPrice: item.unitPrice,
                                    subtotal: item.subtotal,
                                    voucherId: null,
                                  })
                                }
                                title="Koreksi kuantitas transaksi ini"
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/70 rounded-lg text-xs font-bold transition-all active:scale-95"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span className="hidden xl:inline">Koreksi</span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setSaleItemToDelete({
                                    id: item.id,
                                    itemName: item.itemName,
                                    quantity: item.quantity,
                                    unitPrice: item.unitPrice,
                                    subtotal: item.subtotal,
                                    voucherId: null,
                                    sale: {
                                      id: item.saleId,
                                      invoiceNumber: item.invoiceNumber,
                                      createdAt: item.createdAt,
                                      paymentMethod: item.paymentMethod,
                                    },
                                  })
                                }
                                title="Batalkan transaksi ini & kembalikan stok"
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/70 rounded-lg text-xs font-bold transition-all active:scale-95"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span className="hidden xl:inline">Batal</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}

                  {/* Summary row */}
                  {filteredRecapSales.length > 0 && (
                    <tr className="bg-slate-50/90 font-bold border-t-2 border-slate-200 text-slate-900">
                      <td colSpan={4} className="py-3.5 px-3 text-slate-700 font-extrabold">
                        Total {filteredRecapSales.length} Transaksi Terfilter
                      </td>
                      <td className="py-3.5 px-3 text-center font-black text-slate-900 text-sm">
                        {filteredRecapSales.reduce((sum: number, s: any) => sum + s.quantity, 0)} pcs
                      </td>
                      <td></td>
                      <td className="py-3.5 px-3 text-right font-extrabold text-emerald-600">
                        {formatRupiah(filteredRecapSales.reduce((sum: number, s: any) => sum + s.subtotal, 0))}
                      </td>
                      <td className="py-3.5 px-3 text-right font-extrabold">
                        {userRole === "OWNER" ? (
                          <span className="text-amber-700">
                            {formatRupiah(filteredRecapSales.reduce((sum: number, s: any) => sum + s.profit, 0))}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Terkunci</span>
                        )}
                      </td>
                      <td colSpan={3}></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: KATALOG & PERSEDIAAN */}
      {activeTab === "CATALOG" && (
        <div className="space-y-4">
          {/* Operator Filter Pills & Search */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="flex items-center gap-1.5 overflow-x-auto w-full pb-1 sm:pb-0">
                {POPULAR_OPERATORS.map((op) => (
                  <button
                    key={op}
                    onClick={() => setSelectedOperator(op)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                      selectedOperator === op
                        ? "bg-slate-900 text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {op}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari operator atau nominal..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Vouchers Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-[11px] uppercase font-semibold text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3.5">Operator & Nominal</th>
                    {userRole === "OWNER" && <th className="px-5 py-3.5">Harga Modal</th>}
                    <th className="px-5 py-3.5">Harga Jual</th>
                    {userRole === "OWNER" && <th className="px-5 py-3.5">Margin Laba</th>}
                    <th className="px-5 py-3.5">Stok Fisik Saat Ini</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredVouchers.length === 0 ? (
                    <tr>
                      <td colSpan={userRole === "OWNER" ? 7 : 5} className="px-6 py-8 text-center text-slate-400">
                        Tidak ada voucher yang cocok dengan filter.
                      </td>
                    </tr>
                  ) : (
                    filteredVouchers.map((v) => {
                      const margin = v.sellingPrice - v.costPrice;
                      const isOut = v.stock === 0;
                      const isLow = v.stock > 0 && v.stock <= v.minStock;

                      return (
                        <tr key={v.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <span
                                className={`px-2 py-0.5 rounded-lg text-xs font-bold border ${getOperatorBadgeClass(
                                  v.operator
                                )}`}
                              >
                                {v.operator}
                              </span>
                              <span className="font-extrabold text-slate-900 text-sm">
                                {v.nominal}
                              </span>
                            </div>
                          </td>
                          {userRole === "OWNER" && (
                            <td className="px-5 py-3.5 font-medium text-slate-600">
                              {formatRupiah(v.costPrice)}
                            </td>
                          )}
                          <td className="px-5 py-3.5 font-bold text-slate-900">
                            {formatRupiah(v.sellingPrice)}
                          </td>
                          {userRole === "OWNER" && (
                            <td className="px-5 py-3.5 font-bold text-emerald-600">
                              +{formatRupiah(margin)}
                            </td>
                          )}
                          <td className="px-5 py-3.5">
                            <span className="text-base font-extrabold text-slate-900">{v.stock}</span>
                            <span className="text-[11px] text-slate-400 ml-1">pcs</span>
                            <p className="text-[10px] text-slate-400">Min {v.minStock} pcs</p>
                          </td>
                          <td className="px-5 py-3.5">
                            {isOut ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                                Habis (0)
                              </span>
                            ) : isLow ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                                <AlertTriangle className="w-3 h-3" />
                                Menipis
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                                <CheckCircle2 className="w-3 h-3" />
                                Aman
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => openStockInFor(v)}
                                className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1"
                                title="Tambah Stok Masuk"
                              >
                                <PlusCircle className="w-3.5 h-3.5" />
                                <span>+ Stok</span>
                              </button>
                              <button
                                onClick={() => setEditingVoucher(v)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                title="Edit Voucher"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setVoucherToDelete(v)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                title="Hapus Voucher"
                              >
                                <Trash2 className="w-4 h-4" />
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
        </div>
      )}

      {/* TAB 4: AUDIT LOG MOVEMENTS */}
      {activeTab === "MOVEMENTS" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-[11px] uppercase font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">Waktu Transaksi</th>
                  <th className="px-5 py-3.5">Voucher</th>
                  <th className="px-5 py-3.5">Jenis Mutasi</th>
                  <th className="px-5 py-3.5">Perubahan Unit</th>
                  <th className="px-5 py-3.5">Pergerakan Stok (Sebelum → Sesudah)</th>
                  <th className="px-5 py-3.5">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                      Belum ada mutasi stok voucher tercatat.
                    </td>
                  </tr>
                ) : (
                  movements.map((m) => {
                    const isPositive = m.quantity > 0;
                    const dateStr = new Date(m.createdAt).toLocaleString("id-ID", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    });

                    const badgeClass =
                      m.type === "STOCK_IN"
                        ? "bg-emerald-100 text-emerald-700"
                        : m.type === "SOLD"
                        ? "bg-indigo-100 text-indigo-700"
                        : m.type === "ADJUSTMENT"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-slate-100 text-slate-700";

                    return (
                      <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-3 text-slate-500 font-mono text-[11px]">{dateStr}</td>
                        <td className="px-5 py-3 font-semibold text-slate-800">
                          {m.voucher ? `${m.voucher.operator} ${m.voucher.nominal}` : "Voucher"}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${badgeClass}`}
                          >
                            {m.type}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`font-mono font-bold text-sm ${
                              isPositive ? "text-emerald-600" : "text-rose-600"
                            }`}
                          >
                            {isPositive ? `+${m.quantity}` : `${m.quantity}`}
                          </span>
                        </td>
                        <td className="px-5 py-3 font-mono text-slate-700">
                          {m.previousStock} →{" "}
                          <span className="font-bold text-slate-900">{m.newStock}</span>
                        </td>
                        <td className="px-5 py-3 text-slate-500">{m.notes || "-"}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL KOREKSI PENJUALAN */}
      {isCorrectionModalOpen && selectedCorrectionItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Koreksi Rekap Penjualan</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Ubah kuantitas dan harga satuan untuk transaksi ini
                </p>
              </div>
              <button
                onClick={() => setIsCorrectionModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 text-xs rounded-xl">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleSaveCorrection} className="space-y-3">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                <p className="font-bold text-slate-900 text-sm">
                  {selectedCorrectionItem.itemName}
                </p>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Harga Satuan Tercatat:</span>
                  <span className="font-semibold text-slate-700">
                    {formatRupiah(selectedCorrectionItem.unitPrice)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Kuantitas Terjual Saat Ini:</span>
                  <span className="font-bold text-slate-800">
                    {selectedCorrectionItem.quantity} pcs
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Harga Satuan (Rp)
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    step="any"
                    value={correctedPrice === 0 ? "" : correctedPrice}
                    onChange={(e) =>
                      setCorrectedPrice(e.target.value === "" ? 0 : parseFloat(e.target.value) || 0)
                    }
                    placeholder="Contoh: 15000"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-extrabold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kuantitas Terjual (Pcs)
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    step="any"
                    value={correctedQty}
                    onChange={(e) =>
                      setCorrectedQty(e.target.value === "" ? 0 : parseInt(e.target.value, 10) || 0)
                    }
                    placeholder="Contoh: 3"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-extrabold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100/80 flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">Subtotal Baru:</span>
                <span className="font-extrabold text-indigo-700 text-sm">
                  {formatRupiah((correctedQty || 0) * (correctedPrice || 0))}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCorrectionModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow disabled:opacity-50"
                >
                  {loading ? "Menyimpan..." : "Simpan Koreksi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH VOUCHER */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Tambah Jenis Voucher Baru</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 text-xs rounded-xl">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleCreateVoucher} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Operator
                  </label>
                  <select
                    value={newVoucherForm.operator}
                    onChange={(e) =>
                      setNewVoucherForm({ ...newVoucherForm, operator: e.target.value })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Telkomsel">Telkomsel</option>
                    <option value="Indosat">Indosat</option>
                    <option value="XL">XL</option>
                    <option value="Tri">Tri</option>
                    <option value="Smartfren">Smartfren</option>
                    <option value="Axis">Axis</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nominal
                  </label>
                  <input
                    type="text"
                    required
                    value={newVoucherForm.nominal}
                    onChange={(e) =>
                      setNewVoucherForm({ ...newVoucherForm, nominal: e.target.value })
                    }
                    placeholder="Contoh: 10GB 30 Hari"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Harga Modal (Rp)
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={newVoucherForm.costPrice || ""}
                    onChange={(e) =>
                      setNewVoucherForm({ ...newVoucherForm, costPrice: Number(e.target.value) })
                    }
                    placeholder="0"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Harga Jual (Rp)
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={newVoucherForm.sellingPrice || ""}
                    onChange={(e) =>
                      setNewVoucherForm({ ...newVoucherForm, sellingPrice: Number(e.target.value) })
                    }
                    placeholder="0"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Stok Awal Fisik (Pcs)
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={newVoucherForm.stock || ""}
                    onChange={(e) =>
                      setNewVoucherForm({ ...newVoucherForm, stock: Number(e.target.value) })
                    }
                    placeholder="0"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Peringatan Min. Stok
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={newVoucherForm.minStock}
                    onChange={(e) =>
                      setNewVoucherForm({ ...newVoucherForm, minStock: Number(e.target.value) })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow disabled:opacity-50"
                >
                  {loading ? "Menyimpan..." : "Simpan Voucher"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL STOK MASUK VOUCHER */}
      {isStockInModalOpen && selectedVoucher && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Tambah Stok Masuk Voucher</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Catat penerimaan pasokan voucher fisik baru
                </p>
              </div>
              <button onClick={() => setIsStockInModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 text-xs rounded-xl">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleStockIn} className="space-y-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span
                  className={`px-2 py-0.5 rounded-lg text-xs font-bold border ${getOperatorBadgeClass(
                    selectedVoucher.operator
                  )}`}
                >
                  {selectedVoucher.operator}
                </span>
                <p className="font-bold text-slate-800 text-sm mt-1.5">
                  Nominal {selectedVoucher.nominal}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Stok fisik saat ini:{" "}
                  <span className="font-bold text-slate-900">{selectedVoucher.stock} pcs</span>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Jumlah Masuk (Pcs)
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={stockInForm.quantity}
                    onChange={(e) =>
                      setStockInForm({ ...stockInForm, quantity: Number(e.target.value) })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-bold focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Total Stok Nanti
                  </label>
                  <div className="w-full bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-xs text-emerald-800 font-bold">
                    {selectedVoucher.stock + Number(stockInForm.quantity || 0)} pcs
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Harga Beli / Modal Baru (Rp)
                </label>
                <input
                  type="number"
                  min={0}
                  value={stockInForm.costPrice}
                  onChange={(e) =>
                    setStockInForm({ ...stockInForm, costPrice: Number(e.target.value) })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Catatan / Keterangan Pasokan
                </label>
                <input
                  type="text"
                  value={stockInForm.notes}
                  onChange={(e) => setStockInForm({ ...stockInForm, notes: e.target.value })}
                  placeholder="Contoh: Pasokan 50 pcs dari distributor"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsStockInModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow disabled:opacity-50"
                >
                  {loading ? "Menyimpan..." : "Konfirmasi Stok Masuk"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDIT VOUCHER */}
      {editingVoucher && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Edit Data Voucher</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Perbarui harga dan batas peringatan stok minimum
                </p>
              </div>
              <button onClick={() => setEditingVoucher(null)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateVoucher} className="space-y-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-lg text-xs font-bold border ${getOperatorBadgeClass(editingVoucher.operator)}`}>
                    {editingVoucher.operator}
                  </span>
                  <span className="font-bold text-slate-900 text-sm">
                    {editingVoucher.nominal}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Stok saat ini: <span className="font-bold text-slate-800">{editingVoucher.stock} pcs</span>
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Stok Fisik Tersedia (Pcs) *
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  value={editingVoucher.stock}
                  onChange={(e) =>
                    setEditingVoucher({
                      ...editingVoucher,
                      stock: Math.max(0, parseInt(e.target.value) || 0),
                    })
                  }
                  className="w-full bg-slate-50 border border-indigo-300 rounded-xl px-3 py-2 text-xs font-bold text-indigo-700 focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Perubahan stok akan otomatis tersimpan dan tercatat pada riwayat mutasi stok.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Harga Modal (Rp)
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={editingVoucher.costPrice}
                    onChange={(e) =>
                      setEditingVoucher({ ...editingVoucher, costPrice: Number(e.target.value) })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Harga Jual (Rp)
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={editingVoucher.sellingPrice}
                    onChange={(e) =>
                      setEditingVoucher({ ...editingVoucher, sellingPrice: Number(e.target.value) })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Peringatan Minimum Stok (Pcs)
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  value={editingVoucher.minStock}
                  onChange={(e) =>
                    setEditingVoucher({ ...editingVoucher, minStock: Number(e.target.value) })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    const target = editingVoucher;
                    setEditingVoucher(null);
                    setVoucherToDelete(target);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Hapus Voucher</span>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingVoucher(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow disabled:opacity-50"
                  >
                    {loading ? "Menyimpan..." : "Simpan Perubahan"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS VOUCHER */}
      {voucherToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Konfirmasi Hapus Voucher</h3>
                <p className="text-xs text-slate-500">Tindakan penghapusan jenis voucher fisik</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Operator:</span>
                <span className="font-bold text-slate-900">{voucherToDelete.operator}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Nominal:</span>
                <span className="font-bold text-slate-900">{voucherToDelete.nominal}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Stok Fisik Saat Ini:</span>
                <span className="font-semibold text-slate-800">{voucherToDelete.stock} pcs</span>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Apakah Anda yakin ingin menghapus voucher ini? Jika voucher sudah pernah terjual, voucher akan otomatis dinonaktifkan (diarsipkan) dari katalog agar rekap laporan keuangan masa lalu tetap aman.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={deleteLoading}
                onClick={() => setVoucherToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={deleteLoading}
                onClick={handleDeleteVoucher}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl shadow-md shadow-rose-600/20 transition-all disabled:opacity-50"
              >
                {deleteLoading ? "Menghapus..." : "Ya, Hapus Voucher"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI BATAL/HAPUS REKAPAN PENJUALAN */}
      {saleItemToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Batalkan Rekapan Penjualan</h3>
                <p className="text-xs text-slate-500">Koreksi & pembatalan transaksi voucher</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Voucher:</span>
                <span className="font-bold text-slate-900">{saleItemToDelete.itemName}</span>
              </div>
              {saleItemToDelete.sale?.invoiceNumber && (
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">No. Faktur:</span>
                  <span className="font-mono font-bold text-slate-700">#{saleItemToDelete.sale.invoiceNumber}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Kuantitas Dicatat Terjual:</span>
                <span className="font-extrabold text-rose-600">{saleItemToDelete.quantity} pcs</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Total Nilai Penjualan:</span>
                <span className="font-extrabold text-emerald-600">{formatRupiah(saleItemToDelete.subtotal)}</span>
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-amber-900">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Pengembalian Stok Otomatis</span>
              </p>
              <p>
                Jika dibatalkan, sejumlah <strong>{saleItemToDelete.quantity} pcs</strong> stok fisik akan otomatis dikembalikan ke katalog voucher, dan rekapan omset/laba tanggal tersebut akan dikurangi kembali.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={deleteSaleItemLoading}
                onClick={() => setSaleItemToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Tutup
              </button>
              <button
                type="button"
                disabled={deleteSaleItemLoading}
                onClick={handleDeleteSaleItem}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl shadow-md shadow-rose-600/20 transition-all disabled:opacity-50"
              >
                {deleteSaleItemLoading ? "Membatalkan..." : "Ya, Batalkan & Kembalikan Stok"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

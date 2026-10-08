"use client";

import React, { useState } from "react";
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
} from "lucide-react";
import { formatRupiah } from "@/lib/calculations";

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
}

interface VoucherClientProps {
  initialVouchers: Voucher[];
  initialMovements: VoucherMovement[];
  initialTodaySales?: TodaySaleItem[];
  userRole: string;
}

const POPULAR_OPERATORS = ["Semua", "Telkomsel", "Indosat", "XL", "Tri", "Smartfren", "Axis"];

export default function VoucherClient({
  initialVouchers,
  initialMovements,
  initialTodaySales = [],
  userRole,
}: VoucherClientProps) {
  const [vouchers, setVouchers] = useState<Voucher[]>(initialVouchers);
  const [movements, setMovements] = useState<VoucherMovement[]>(initialMovements);
  const [todaySales, setTodaySales] = useState<TodaySaleItem[]>(initialTodaySales);

  const [activeTab, setActiveTab] = useState<"DAILY_SALES" | "CATALOG" | "MOVEMENTS">("DAILY_SALES");
  const [selectedOperator, setSelectedOperator] = useState("Semua");
  const [search, setSearch] = useState("");
  const [onlyLowStock, setOnlyLowStock] = useState(false);

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
        body: JSON.stringify({ items: itemsToSubmit }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan laporan penjualan");

      setSuccessMessage("Laporan penjualan voucher berhasil disimpan!");

      // Reset Sisa inputs
      setRemainingStockInputs({});

      // Refresh data
      const [vouchersRes, salesRes] = await Promise.all([
        fetch("/api/vouchers"),
        fetch("/api/vouchers/daily-sales"),
      ]);
      const vouchersData = await vouchersRes.json();
      const salesData = await salesRes.json();

      if (vouchersData.vouchers) setVouchers(vouchersData.vouchers);
      if (salesData.saleItems) setTodaySales(salesData.saleItems);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openCorrectionModal = (item: TodaySaleItem) => {
    setSelectedCorrectionItem(item);
    setCorrectedQty(item.quantity);
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
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengoreksi laporan penjualan");

      setSuccessMessage("Koreksi penjualan berhasil disimpan!");
      setIsCorrectionModalOpen(false);

      // Refresh data
      const [vouchersRes, salesRes] = await Promise.all([
        fetch("/api/vouchers"),
        fetch("/api/vouchers/daily-sales"),
      ]);
      const vouchersData = await vouchersRes.json();
      const salesData = await salesRes.json();

      if (vouchersData.vouchers) setVouchers(vouchersData.vouchers);
      if (salesData.saleItems) setTodaySales(salesData.saleItems);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
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

      setVouchers([...vouchers, data.voucher]);
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

      setVouchers(vouchers.map((v) => (v.id === data.voucher.id ? data.voucher : v)));
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

      setVouchers(vouchers.filter((v) => v.id !== voucherToDelete.id));
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
          minStock: Number(editingVoucher.minStock),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memperbarui voucher");

      setVouchers(vouchers.map((v) => (v.id === editingVoucher.id ? { ...v, ...data.voucher } : v)));
      setEditingVoucher(null);
      setSuccessMessage("Data voucher berhasil diperbarui!");
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Aggregated today sales summary
  const todayTotalQty = todaySales.reduce((sum, item) => sum + item.quantity, 0);
  const todayTotalAmount = todaySales.reduce((sum, item) => sum + item.subtotal, 0);

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

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Voucher Baru</span>
        </button>
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
        <div className="space-y-8">
          {/* Card 1: Input Form Tabel Penjualan Voucher */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden space-y-4">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gradient-to-r from-slate-50 to-indigo-50/30">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-indigo-600" />
                  <span>Form Pencatatan Penjualan Voucher Harian</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Input <strong>SISA STOK</strong> voucher fisik saat ini. Sistem akan otomatis menghitung jumlah terjual & subtotal.
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
                  Estimasi Total Penjualan
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
                <span>{loading ? "Menyimpan Laporan..." : "SIMPAN LAPORAN PENJUALAN"}</span>
              </button>
            </div>
          </div>

          {/* Card 2: ARSIP & LAPORAN - Rekap Penjualan Voucher Hari Ini */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
                Arsip & Laporan
              </span>
              <h3 className="text-xl font-extrabold text-slate-900 tracking-tight mt-2">
                Rekap Penjualan Voucher Hari Ini
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Rekapitulasi total voucher fisik yang telah berhasil dijual hari ini. Anda dapat mengedit jika ada kesalahan pencatatan.
              </p>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-100">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-50/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200/80">
                    <th className="py-3.5 px-4">Nama Voucher</th>
                    <th className="py-3.5 px-4 text-center">Harga Satuan</th>
                    <th className="py-3.5 px-4 text-center">Jumlah Terjual</th>
                    <th className="py-3.5 px-4 text-center">Total Uang</th>
                    <th className="py-3.5 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {todaySales.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                        Belum ada pencatatan penjualan voucher hari ini.
                      </td>
                    </tr>
                  ) : (
                    todaySales.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-4 px-4 font-bold text-slate-900">
                          {item.itemName}
                        </td>
                        <td className="py-4 px-4 text-center font-semibold text-slate-600">
                          {formatRupiah(item.unitPrice)}
                        </td>
                        <td className="py-4 px-4 text-center font-extrabold text-slate-900 text-sm">
                          {item.quantity} pcs
                        </td>
                        <td className="py-4 px-4 text-center font-extrabold text-indigo-600 text-sm">
                          {formatRupiah(item.subtotal)}
                        </td>
                        <td className="py-4 px-4 text-right">
                          <button
                            onClick={() => openCorrectionModal(item)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/70 rounded-xl text-xs font-bold transition-all active:scale-95"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Koreksi</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}

                  {/* Summary Row */}
                  {todaySales.length > 0 && (
                    <tr className="bg-slate-50/90 font-bold border-t-2 border-slate-200 text-slate-900">
                      <td className="py-4 px-4 text-sm font-extrabold text-slate-900">
                        Total Penjualan Hari Ini
                      </td>
                      <td className="py-4 px-4"></td>
                      <td className="py-4 px-4 text-center font-extrabold text-slate-900 text-sm">
                        {todayTotalQty} pcs
                      </td>
                      <td className="py-4 px-4 text-center font-extrabold text-emerald-600 text-base">
                        {formatRupiah(todayTotalAmount)}
                      </td>
                      <td className="py-4 px-4"></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: KATALOG & PERSEDIAAN */}
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

      {/* TAB 3: AUDIT LOG MOVEMENTS */}
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
                  Ubah kuantitas terjual untuk transaksi ini
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
                <p className="text-xs text-slate-500">
                  Harga Satuan: {formatRupiah(selectedCorrectionItem.unitPrice)}
                </p>
                <p className="text-xs text-slate-500">
                  Kuantitas Terjual Saat Ini:{" "}
                  <span className="font-bold text-slate-800">{selectedCorrectionItem.quantity} pcs</span>
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kuantitas Terjual yang Benar (Pcs)
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  value={correctedQty}
                  onChange={(e) => setCorrectedQty(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-extrabold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100/80 flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">Subtotal Baru:</span>
                <span className="font-extrabold text-indigo-700 text-sm">
                  {formatRupiah(correctedQty * selectedCorrectionItem.unitPrice)}
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
    </div>
  );
}

"use client";

import React, { useState } from "react";
import {
  Package,
  ArrowDownRight,
  ArrowUpRight,
  Sliders,
  History,
  AlertTriangle,
  PlusCircle,
  RotateCcw,
  Search,
  CheckCircle,
  Calendar,
  User,
} from "lucide-react";
import { formatRupiah } from "@/lib/calculations";

interface Product {
  id: string;
  sku: string;
  name: string;
  brand: string | null;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  minStock: number;
  type: "ACCESSORY" | "GENERAL";
  category: { id: string; name: string };
  supplier: { id: string; name: string } | null;
}

interface Supplier {
  id: string;
  name: string;
}

interface InventoryMovement {
  id: string;
  productId: string;
  type: string;
  quantity: number;
  previousStock: number;
  newStock: number;
  referenceId: string | null;
  notes: string | null;
  createdAt: string;
  product: {
    id: string;
    sku: string;
    name: string;
    brand: string | null;
    type: string;
  };
  createdBy: {
    id: string;
    name: string;
    role: string;
  } | null;
}

interface InventoryClientProps {
  initialProducts: Product[];
  suppliers: Supplier[];
  initialMovements: InventoryMovement[];
  userRole: string;
}

export default function InventoryClient({
  initialProducts,
  suppliers,
  initialMovements,
  userRole,
}: InventoryClientProps) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [movements, setMovements] = useState<InventoryMovement[]>(initialMovements);

  const [activeTab, setActiveTab] = useState<"STOCK" | "MOVEMENTS">("STOCK");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [movementTypeFilter, setMovementTypeFilter] = useState("ALL");

  // Modals
  const [isStockInOpen, setIsStockInOpen] = useState(false);
  const [isAdjustmentOpen, setIsAdjustmentOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Forms
  const [stockInForm, setStockInForm] = useState({
    productId: "",
    quantity: 1,
    costPrice: 0,
    supplierId: "",
    notes: "",
  });

  const [adjustmentForm, setAdjustmentForm] = useState({
    productId: "",
    actualStock: 0,
    reason: "",
  });

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filtered Products
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      (p.brand && p.brand.toLowerCase().includes(search.toLowerCase()));
    const matchesType = typeFilter === "ALL" || p.type === typeFilter;
    return matchesSearch && matchesType;
  });

  // Filtered Movements
  const filteredMovements = movements.filter((m) => {
    const matchesSearch =
      m.product.name.toLowerCase().includes(search.toLowerCase()) ||
      m.product.sku.toLowerCase().includes(search.toLowerCase()) ||
      (m.notes && m.notes.toLowerCase().includes(search.toLowerCase()));
    const matchesType = movementTypeFilter === "ALL" || m.type === movementTypeFilter;
    return matchesSearch && matchesType;
  });

  // Open modals with preselected product
  const openStockInFor = (product: Product) => {
    setSelectedProduct(product);
    setStockInForm({
      productId: product.id,
      quantity: 5,
      costPrice: product.costPrice,
      supplierId: product.supplier?.id || "",
      notes: "Restock pasokan baru",
    });
    setErrorMessage(null);
    setIsStockInOpen(true);
  };

  const openAdjustmentFor = (product: Product) => {
    setSelectedProduct(product);
    setAdjustmentForm({
      productId: product.id,
      actualStock: product.stock,
      reason: "",
    });
    setErrorMessage(null);
    setIsAdjustmentOpen(true);
  };

  const handleStockIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/inventory/stock-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: stockInForm.productId,
          quantity: Number(stockInForm.quantity),
          costPrice: Number(stockInForm.costPrice),
          supplierId: stockInForm.supplierId || null,
          notes: stockInForm.notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menambah stok");

      // Update local state
      setProducts(products.map((p) => (p.id === data.product.id ? data.product : p)));
      setMovements([data.movement, ...movements]);
      setIsStockInOpen(false);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/inventory/adjustment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: adjustmentForm.productId,
          actualStock: Number(adjustmentForm.actualStock),
          reason: adjustmentForm.reason,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal melakukan penyesuaian");

      // Update local state
      setProducts(products.map((p) => (p.id === data.product.id ? data.product : p)));
      setMovements([data.movement, ...movements]);
      setIsAdjustmentOpen(false);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Package className="w-6 h-6 text-indigo-600" />
            <span>Manajemen Inventaris & Mutasi Stok</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Rumus stok: Stok Awal + Stok Masuk - Terjual ± Penyesuaian = Stok Saat Ini
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (products.length > 0) openStockInFor(products[0]);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Stok Masuk (Stock In)</span>
          </button>
          <button
            onClick={() => {
              if (products.length > 0) openAdjustmentFor(products[0]);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
          >
            <Sliders className="w-4 h-4" />
            <span>Penyesuaian (Opname)</span>
          </button>
        </div>
      </div>

      {/* Primary Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("STOCK")}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 flex items-center gap-2 transition-all ${
            activeTab === "STOCK"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Status Stok Fisik ({products.length})</span>
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
          <span>Log Mutasi Inventaris ({movements.length})</span>
        </button>
      </div>

      {/* TAB 1: STOCK STATUS */}
      {activeTab === "STOCK" && (
        <div className="space-y-4">
          {/* Search & Filter */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari SKU, nama produk, brand..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Filter Tipe:</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700"
              >
                <option value="ALL">Semua Tipe</option>
                <option value="ACCESSORY">Aksesoris Fisik</option>
                <option value="GENERAL">Umum / Lainnya</option>
              </select>
            </div>
          </div>

          {/* Stock Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-[11px] uppercase font-semibold text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3.5">SKU & Nama Produk</th>
                    <th className="px-5 py-3.5">Tipe & Kategori</th>
                    {userRole === "OWNER" && <th className="px-5 py-3.5">Harga Modal</th>}
                    <th className="px-5 py-3.5">Stok Saat Ini</th>
                    <th className="px-5 py-3.5">Status Persediaan</th>
                    <th className="px-5 py-3.5 text-right">Tindakan Inventaris</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredProducts.map((p) => {
                    const isOut = p.stock === 0;
                    const isLow = p.stock > 0 && p.stock <= p.minStock;

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-3.5">
                          <span className="font-mono text-[11px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {p.sku}
                          </span>
                          <p className="font-bold text-slate-900 mt-1">{p.name}</p>
                          {p.brand && <p className="text-[11px] text-slate-400">{p.brand}</p>}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              p.type === "ACCESSORY"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {p.type === "ACCESSORY" ? "Aksesoris" : "Umum"}
                          </span>
                          <p className="text-slate-500 mt-1">{p.category?.name}</p>
                        </td>
                        {userRole === "OWNER" && (
                          <td className="px-5 py-3.5 font-medium text-slate-700">
                            {formatRupiah(p.costPrice)}
                          </td>
                        )}
                        <td className="px-5 py-3.5">
                          <span className="text-base font-extrabold text-slate-900">
                            {p.stock}
                          </span>
                          <span className="text-[11px] text-slate-400 ml-1">unit</span>
                          <p className="text-[10px] text-slate-400">Min. {p.minStock} unit</p>
                        </td>
                        <td className="px-5 py-3.5">
                          {isOut ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                              Habis (0)
                            </span>
                          ) : isLow ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                              <AlertTriangle className="w-3 h-3" />
                              Menipis
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                              <CheckCircle className="w-3 h-3" />
                              Aman
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right space-x-1.5">
                          <button
                            onClick={() => openStockInFor(p)}
                            className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold transition-colors"
                          >
                            + Masuk
                          </button>
                          <button
                            onClick={() => openAdjustmentFor(p)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold transition-colors"
                          >
                            Opname
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: AUDIT LOG MOVEMENTS */}
      {activeTab === "MOVEMENTS" && (
        <div className="space-y-4">
          {/* Movement Type Filter */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari log SKU, produk, catatan..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Tipe Mutasi:</span>
              <select
                value={movementTypeFilter}
                onChange={(e) => setMovementTypeFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700"
              >
                <option value="ALL">Semua Mutasi</option>
                <option value="INITIAL_STOCK">Saldo Awal (INITIAL_STOCK)</option>
                <option value="PURCHASE">Barang Masuk (PURCHASE)</option>
                <option value="SALE">Penjualan Kasir (SALE)</option>
                <option value="ADJUSTMENT">Penyesuaian Opname (ADJUSTMENT)</option>
                <option value="RETURN">Retur (RETURN)</option>
              </select>
            </div>
          </div>

          {/* Movements Log Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-[11px] uppercase font-semibold text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3.5">Waktu</th>
                    <th className="px-5 py-3.5">Produk</th>
                    <th className="px-5 py-3.5">Jenis Mutasi</th>
                    <th className="px-5 py-3.5">Perubahan</th>
                    <th className="px-5 py-3.5">Stok Sebelum → Sesudah</th>
                    <th className="px-5 py-3.5">Petugas / Ref</th>
                    <th className="px-5 py-3.5">Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredMovements.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                        Belum ada riwayat mutasi yang tercatat.
                      </td>
                    </tr>
                  ) : (
                    filteredMovements.map((m) => {
                      const isPositive = m.quantity > 0;
                      const dateStr = new Date(m.createdAt).toLocaleString("id-ID", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      });

                      const typeBadge =
                        m.type === "PURCHASE"
                          ? "bg-emerald-100 text-emerald-700"
                          : m.type === "SALE"
                          ? "bg-blue-100 text-blue-700"
                          : m.type === "ADJUSTMENT"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-slate-100 text-slate-700";

                      return (
                        <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-5 py-3 text-slate-500 font-mono text-[11px]">
                            {dateStr}
                          </td>
                          <td className="px-5 py-3">
                            <span className="font-mono text-[10px] text-slate-400">
                              {m.product.sku}
                            </span>
                            <p className="font-bold text-slate-900">{m.product.name}</p>
                          </td>
                          <td className="px-5 py-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase ${typeBadge}`}
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
                          <td className="px-5 py-3 text-slate-600">
                            <div className="flex items-center gap-1">
                              <User className="w-3 h-3 text-slate-400" />
                              <span>{m.createdBy?.name || "System"}</span>
                            </div>
                            {m.referenceId && (
                              <span className="text-[10px] text-indigo-500 block font-mono">
                                #{m.referenceId}
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-slate-500 max-w-xs truncate">
                            {m.notes || "-"}
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

      {/* MODAL STOCK IN */}
      {isStockInOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Tambah Stok Masuk (Stock In)</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Mencatat penerimaan stok baru ke dalam inventaris toko
                </p>
              </div>
              <button onClick={() => setIsStockInOpen(false)} className="text-slate-400 hover:text-slate-600">
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
                <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                  {selectedProduct.sku}
                </span>
                <p className="font-bold text-slate-800 text-sm mt-1">{selectedProduct.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Stok saat ini: <span className="font-bold text-slate-800">{selectedProduct.stock} unit</span>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Jumlah Masuk (Unit)
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
                    Stok Akhir Nanti
                  </label>
                  <div className="w-full bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-xs text-emerald-800 font-bold">
                    {selectedProduct.stock + Number(stockInForm.quantity || 0)} unit
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Harga Beli / Modal Satuan (Rp)
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
                  Supplier Pemasok (Opsional)
                </label>
                <select
                  value={stockInForm.supplierId}
                  onChange={(e) => setStockInForm({ ...stockInForm, supplierId: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Tanpa Supplier --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Catatan / Keterangan Masuk
                </label>
                <input
                  type="text"
                  value={stockInForm.notes}
                  onChange={(e) => setStockInForm({ ...stockInForm, notes: e.target.value })}
                  placeholder="Contoh: Faktur No. 128 dari CV Jaya"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsStockInOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow disabled:opacity-50"
                >
                  {loading ? "Menyimpan..." : "Konfirmasi Stok Masuk"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ADJUSTMENT (STOCK OPNAME) */}
      {isAdjustmentOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Penyesuaian Stok (Stock Opname)</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Koreksi jumlah stok fisik aktual vs sistem
                </p>
              </div>
              <button onClick={() => setIsAdjustmentOpen(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 text-xs rounded-xl">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleAdjustment} className="space-y-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] font-mono font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                  {selectedProduct.sku}
                </span>
                <p className="font-bold text-slate-800 text-sm mt-1">{selectedProduct.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Stok di Sistem: <span className="font-bold text-slate-900">{selectedProduct.stock} unit</span>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Stok Fisik Nyata (Aktual)
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={adjustmentForm.actualStock}
                    onChange={(e) =>
                      setAdjustmentForm({ ...adjustmentForm, actualStock: Number(e.target.value) })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-bold focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Selisih Koreksi
                  </label>
                  {(() => {
                    const diff = adjustmentForm.actualStock - selectedProduct.stock;
                    return (
                      <div
                        className={`w-full border rounded-xl px-3 py-2 text-xs font-bold ${
                          diff === 0
                            ? "bg-slate-50 border-slate-200 text-slate-600"
                            : diff > 0
                            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                            : "bg-rose-50 border-rose-200 text-rose-700"
                        }`}
                      >
                        {diff > 0 ? `+${diff}` : diff} unit
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Alasan Penyesuaian (Wajib Diisi)
                </label>
                <input
                  type="text"
                  required
                  value={adjustmentForm.reason}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, reason: e.target.value })}
                  placeholder="Contoh: Barang rusak / selisih hitung opname mingguan"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAdjustmentOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow disabled:opacity-50"
                >
                  {loading ? "Menyimpan..." : "Simpan Penyesuaian"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useState } from "react";
import {
  Receipt,
  Plus,
  Search,
  Filter,
  Trash2,
  Edit2,
  Calendar,
  AlertCircle,
  TrendingDown,
  DollarSign,
  PieChart,
  CheckCircle2,
} from "lucide-react";
import { formatRupiah } from "@/lib/calculations";

interface ExpenseItem {
  id: string;
  date: string;
  category: "ELECTRICITY" | "INTERNET" | "RENT" | "OPERATIONAL" | "TRANSPORT" | "SALARY" | "OTHER";
  description: string;
  amount: number;
  notes: string | null;
  createdBy: {
    id: string;
    name: string;
    role: string;
  } | null;
}

const CATEGORY_MAP: Record<string, { label: string; badgeColor: string }> = {
  ELECTRICITY: { label: "Listrik & Air (Utilitas)", badgeColor: "bg-amber-100 text-amber-800 border-amber-200" },
  INTERNET: { label: "Internet & WiFi Toko", badgeColor: "bg-blue-100 text-blue-800 border-blue-200" },
  RENT: { label: "Sewa Tempat / Kios", badgeColor: "bg-purple-100 text-purple-800 border-purple-200" },
  OPERATIONAL: { label: "Operasional Toko & Konsumsi", badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  TRANSPORT: { label: "Transportasi & Logistik", badgeColor: "bg-orange-100 text-orange-800 border-orange-200" },
  SALARY: { label: "Gaji / Upah Karyawan", badgeColor: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  OTHER: { label: "Pengeluaran Lain-lain", badgeColor: "bg-slate-100 text-slate-800 border-slate-200" },
};

export default function ExpensesClient({
  initialExpenses,
  userRole,
}: {
  initialExpenses: ExpenseItem[];
  userRole: string;
}) {
  const [expenses, setExpenses] = useState<ExpenseItem[]>(initialExpenses);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseItem | null>(null);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().slice(0, 10),
    category: "OPERATIONAL" as any,
    description: "",
    amount: 0,
    notes: "",
  });

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Metrics
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const thisMonthExpenses = expenses.filter((e) => {
    const d = new Date(e.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const totalThisMonth = thisMonthExpenses.reduce((sum, e) => sum + e.amount, 0);

  const todayStr = now.toISOString().slice(0, 10);
  const todayExpenses = expenses.filter((e) => e.date.slice(0, 10) === todayStr);
  const totalToday = todayExpenses.reduce((sum, e) => sum + e.amount, 0);

  // Top Category
  const catSums: Record<string, number> = {};
  thisMonthExpenses.forEach((e) => {
    catSums[e.category] = (catSums[e.category] || 0) + e.amount;
  });
  const topCatEntry = Object.entries(catSums).sort((a, b) => b[1] - a[1])[0];
  const topCatName = topCatEntry ? CATEGORY_MAP[topCatEntry[0]]?.label || topCatEntry[0] : "-";
  const topCatAmount = topCatEntry ? topCatEntry[1] : 0;

  // Filtered List
  const filteredExpenses = expenses.filter((e) => {
    const matchesCategory = selectedCategory === "ALL" || e.category === selectedCategory;
    const matchesSearch =
      e.description.toLowerCase().includes(search.toLowerCase()) ||
      (e.notes && e.notes.toLowerCase().includes(search.toLowerCase())) ||
      (e.createdBy && e.createdBy.name.toLowerCase().includes(search.toLowerCase()));

    return matchesCategory && matchesSearch;
  });

  const handleOpenCreate = () => {
    setEditingExpense(null);
    setFormData({
      date: new Date().toISOString().slice(0, 10),
      category: "OPERATIONAL",
      description: "",
      amount: 0,
      notes: "",
    });
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (exp: ExpenseItem) => {
    setEditingExpense(exp);
    setFormData({
      date: exp.date.slice(0, 10),
      category: exp.category,
      description: exp.description,
      amount: exp.amount,
      notes: exp.notes || "",
    });
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (editingExpense) {
        // Edit PUT
        const res = await fetch(`/api/expenses/${editingExpense.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...formData,
            amount: Number(formData.amount),
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Gagal memperbarui pengeluaran");

        setExpenses(expenses.map((item) => (item.id === editingExpense.id ? data.expense : item)));
        setSuccessMessage("Pengeluaran berhasil diperbarui!");
      } else {
        // Create POST
        const res = await fetch("/api/expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...formData,
            amount: Number(formData.amount),
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Gagal menyimpan pengeluaran");

        setExpenses([data.expense, ...expenses]);
        setSuccessMessage("Pengeluaran berhasil dicatat!");
      }

      setIsModalOpen(false);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus catatan pengeluaran ini?")) return;

    try {
      const res = await fetch(`/api/expenses/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Gagal menghapus pengeluaran");

      setExpenses(expenses.filter((e) => e.id !== id));
      setSuccessMessage("Pengeluaran berhasil dihapus!");
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Receipt className="w-6 h-6 text-rose-600" />
            <span>Pengeluaran & Beban Operasional Toko</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Pencatatan seluruh biaya utilitas, sewa, gaji, konsumsi, dan logistik toko ChiCha Mobile
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/20 transition-all active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>+ Catat Pengeluaran Baru</span>
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

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Pengeluaran Bulan Ini */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Total Beban Bulan Ini</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-rose-600 mt-2">{formatRupiah(totalThisMonth)}</p>
          <p className="text-[10px] text-slate-400 mt-1">{thisMonthExpenses.length} transaksi beban</p>
        </div>

        {/* Total Hari Ini */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Pengeluaran Hari Ini</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 mt-2">{formatRupiah(totalToday)}</p>
          <p className="text-[10px] text-slate-400 mt-1">{todayExpenses.length} transaksi hari ini</p>
        </div>

        {/* Total Catatan */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Total Riwayat Beban</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-blue-600 mt-2">{expenses.length} catatan</p>
          <p className="text-[10px] text-slate-400 mt-1">Keseluruhan beban tercatat</p>
        </div>

        {/* Kategori Beban Terbesar */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Pos Beban Terbesar</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <PieChart className="w-4 h-4" />
            </div>
          </div>
          <p className="text-base font-extrabold text-slate-900 mt-2 truncate">{topCatName}</p>
          <p className="text-[10px] text-rose-600 font-bold mt-1">{formatRupiah(topCatAmount)}</p>
        </div>
      </div>

      {/* Filter Category Pills & Search */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="flex items-center gap-1.5 overflow-x-auto w-full pb-1 sm:pb-0">
            <button
              onClick={() => setSelectedCategory("ALL")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === "ALL"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Semua Kategori
            </button>
            {Object.entries(CATEGORY_MAP).map(([key, info]) => (
              <button
                key={key}
                onClick={() => setSelectedCategory(key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedCategory === key
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {info.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari deskripsi atau pencatat..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-[11px] uppercase font-semibold text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">Tanggal</th>
                <th className="px-5 py-3.5">Kategori Beban</th>
                <th className="px-5 py-3.5">Deskripsi / Keperluan</th>
                <th className="px-5 py-3.5">Catatan</th>
                <th className="px-5 py-3.5">Dicatat Oleh</th>
                <th className="px-5 py-3.5 text-right">Nominal Beban</th>
                <th className="px-5 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-slate-400">
                    Belum ada data pengeluaran yang cocok dengan kriteria.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => {
                  const catInfo = CATEGORY_MAP[exp.category] || {
                    label: exp.category,
                    badgeColor: "bg-slate-100 text-slate-800",
                  };

                  return (
                    <tr key={exp.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-slate-500 whitespace-nowrap">
                        {new Date(exp.date).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-lg text-[10px] font-bold border ${catInfo.badgeColor}`}
                        >
                          {catInfo.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-bold text-slate-900">{exp.description}</td>
                      <td className="px-5 py-3.5 text-slate-500 max-w-xs truncate">{exp.notes || "-"}</td>
                      <td className="px-5 py-3.5 text-slate-600 font-medium">
                        {exp.createdBy?.name || "Owner"}
                      </td>
                      <td className="px-5 py-3.5 text-right font-extrabold text-rose-600 text-sm whitespace-nowrap">
                        -{formatRupiah(exp.amount)}
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEdit(exp)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                            title="Edit Pengeluaran"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(exp.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Hapus Pengeluaran"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* MODAL TAMBAH / EDIT PENGELUARAN */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  {editingExpense ? "Edit Catatan Pengeluaran" : "Catat Beban Pengeluaran Baru"}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Biaya operasional toko atau utilitas</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 text-xs rounded-xl">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tanggal Pengeluaran
                </label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kategori Pengeluaran
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-rose-500"
                >
                  <option value="OPERATIONAL">Operasional Toko & Konsumsi</option>
                  <option value="ELECTRICITY">Listrik & Air (Utilitas)</option>
                  <option value="INTERNET">Internet & WiFi Toko</option>
                  <option value="RENT">Sewa Tempat / Kios</option>
                  <option value="TRANSPORT">Transportasi & Logistik</option>
                  <option value="SALARY">Gaji & Upah Karyawan</option>
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
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nominal Biaya (Rp)
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  placeholder="0"
                  value={formData.amount || ""}
                  onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-extrabold focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Catatan Tambahan (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Keterangan tambahan..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow disabled:opacity-50"
                >
                  {loading ? "Menyimpan..." : editingExpense ? "Simpan Perubahan" : "Catat Pengeluaran"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

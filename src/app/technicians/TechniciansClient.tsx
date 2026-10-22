"use client";

import React, { useState } from "react";
import {
  UserCheck,
  Plus,
  Search,
  Phone,
  MapPin,
  Percent,
  Wrench,
  Coins,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  Edit2,
  Trash2,
  X,
  RefreshCw,
  Eye,
  ShieldAlert,
} from "lucide-react";
import { formatRupiah } from "@/lib/calculations";

interface TechnicianItem {
  id: string;
  name: string;
  phone: string;
  address: string;
  defaultPercentage: number;
  isActive: boolean;
  createdAt: string;
  totalServicesCount: number;
  completedCount: number;
  pendingCount: number;
  totalRevenue: number;
  totalCommission: number;
  totalStoreProfit: number;
}

interface TechniciansClientProps {
  initialTechnicians: TechnicianItem[];
  userRole: string;
  userName: string;
}

export default function TechniciansClient({
  initialTechnicians,
  userRole,
  userName,
}: TechniciansClientProps) {
  const isOwner = userRole === "OWNER";
  const [technicians, setTechnicians] = useState<TechnicianItem[]>(initialTechnicians);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  // Modal State: Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"ADD" | "EDIT">("ADD");
  const [selectedTechId, setSelectedTechId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formPercentage, setFormPercentage] = useState("50");
  const [formIsActive, setFormIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Modal State: History / Detail
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyTech, setHistoryTech] = useState<any | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchTechnicians = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/technicians");
      const data = await res.json();
      if (res.ok) {
        setTechnicians(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setModalMode("ADD");
    setSelectedTechId(null);
    setFormName("");
    setFormPhone("");
    setFormAddress("");
    setFormPercentage("50");
    setFormIsActive(true);
    setFormError("");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (tech: TechnicianItem) => {
    setModalMode("EDIT");
    setSelectedTechId(tech.id);
    setFormName(tech.name);
    setFormPhone(tech.phone || "");
    setFormAddress(tech.address || "");
    setFormPercentage(String(tech.defaultPercentage || 50));
    setFormIsActive(tech.isActive);
    setFormError("");
    setIsModalOpen(true);
  };

  const handleOpenHistory = async (tech: TechnicianItem) => {
    setIsHistoryModalOpen(true);
    setHistoryTech({ ...tech, services: [] });
    setHistoryLoading(true);

    try {
      const res = await fetch(`/api/technicians/${tech.id}`);
      const data = await res.json();
      if (res.ok) {
        setHistoryTech(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError("Nama teknisi wajib diisi.");
      return;
    }

    const pct = parseFloat(formPercentage);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      setFormError("Persentase harus berupa angka antara 0% s/d 100%.");
      return;
    }

    setSubmitting(true);
    setFormError("");

    try {
      let url = "/api/technicians";
      let method = "POST";

      if (modalMode === "EDIT" && selectedTechId) {
        url = `/api/technicians/${selectedTechId}`;
        method = "PUT";
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          phone: formPhone.trim(),
          address: formAddress.trim(),
          defaultPercentage: pct,
          isActive: formIsActive,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menyimpan data teknisi");
      }

      setIsModalOpen(false);
      await fetchTechnicians();
    } catch (err: any) {
      setFormError(err.message || "Terjadi kesalahan saat menyimpan");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (tech: TechnicianItem) => {
    const confirmMsg =
      tech.totalServicesCount > 0
        ? `Teknisi "${tech.name}" sudah memiliki riwayat servis. Menonaktifkannya akan menyembunyikan teknisi dari pilihan servis baru. Lanjutkan?`
        : `Apakah Anda yakin ingin menghapus data teknisi "${tech.name}"?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await fetch(`/api/technicians/${tech.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapus teknisi");
      await fetchTechnicians();
    } catch (err: any) {
      alert(err.message || "Gagal menghapus teknisi");
    }
  };

  // Filtered list
  const filteredTechs = technicians.filter((t) => {
    const matchSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.phone.toLowerCase().includes(search.toLowerCase()) ||
      t.address.toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  });

  // Aggregate stats
  const totalTechs = technicians.length;
  const activeTechs = technicians.filter((t) => t.isActive).length;
  const totalAllServices = technicians.reduce((s, t) => s + t.totalServicesCount, 0);
  const totalAllRevenue = technicians.reduce((s, t) => s + t.totalRevenue, 0);
  const totalAllCommission = technicians.reduce((s, t) => s + t.totalCommission, 0);
  const totalAllStoreProfit = technicians.reduce((s, t) => s + t.totalStoreProfit, 0);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-teal-800 via-teal-700 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-teal-900/15 flex flex-col md:flex-row md:items-center justify-between gap-6 border border-teal-600/30">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-[10px] font-bold tracking-wider uppercase">
            <UserCheck className="w-3.5 h-3.5" />
            <span>Master Data & Komisi Teknisi</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Data Teknisi Servis HP
          </h1>
          <p className="text-teal-100 text-xs sm:text-sm max-w-xl">
            Kelola profil teknisi, persentase bagi hasil jasa servis, serta pantau total omset,
            hak komisi teknisi, dan laba bersih toko. Teknisi adalah entitas operasional internal (tanpa akses login).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchTechnicians}
            disabled={loading}
            className="p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95"
            title="Muat Ulang"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white text-teal-900 font-extrabold text-xs shadow-lg shadow-black/10 hover:bg-teal-50 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Teknisi</span>
          </button>
        </div>
      </div>

      {/* Aggregate Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Teknisi
            </span>
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-800">{totalTechs}</span>
            <span className="text-xs text-emerald-600 font-bold">({activeTechs} Aktif)</span>
          </div>
          <p className="text-[11px] text-slate-400">Total {totalAllServices} pengerjaan servis</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Jasa Servis
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-800">
            {formatRupiah(totalAllRevenue)}
          </div>
          <p className="text-[11px] text-slate-400">Dari seluruh servis lunas</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Hak Komisi Teknisi
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-600">
            {isOwner ? formatRupiah(totalAllCommission) : "Terkunci"}
          </div>
          <p className="text-[11px] text-slate-400">Bagi hasil jasa untuk teknisi</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Laba Bersih Toko
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-600">
            {isOwner ? formatRupiah(totalAllStoreProfit) : "Terkunci"}
          </div>
          <p className="text-[11px] text-slate-400">Keuntungan toko dari jasa servis</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
        <Search className="w-5 h-5 text-slate-400 shrink-0" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari nama teknisi, nomor telepon, atau alamat..."
          className="w-full text-sm outline-none bg-transparent text-slate-800 placeholder-slate-400"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="text-xs text-slate-400 hover:text-slate-600 px-2"
          >
            Clear
          </button>
        )}
      </div>

      {/* Technician Cards Grid */}
      {filteredTechs.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <UserCheck className="w-8 h-8" />
          </div>
          <div>
            <h3 className="font-bold text-slate-700 text-base">Belum Ada Data Teknisi</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              Tambahkan teknisi pertama untuk mulai mencatat servis HP dan membagi hasil jasa teknisi.
            </p>
          </div>
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-teal-600 text-white font-bold text-xs hover:bg-teal-700 transition-all shadow-md shadow-teal-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Teknisi Sekarang</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTechs.map((tech) => {
            const initials = tech.name
              .split(" ")
              .map((w) => w[0])
              .join("")
              .toUpperCase()
              .slice(0, 2);

            return (
              <div
                key={tech.id}
                className={`bg-white rounded-3xl border transition-all hover:shadow-lg p-5 flex flex-col justify-between space-y-4 ${
                  tech.isActive
                    ? "border-slate-200 shadow-sm hover:border-teal-300"
                    : "border-slate-200 bg-slate-50/70 opacity-75"
                }`}
              >
                <div>
                  {/* Top card info */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-indigo-600 text-white font-black text-base flex items-center justify-center shadow-md shadow-teal-600/20 shrink-0">
                        {initials}
                      </div>
                      <div>
                        <h3 className="font-extrabold text-slate-900 text-base leading-tight">
                          {tech.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              tech.isActive
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {tech.isActive ? "Aktif" : "Nonaktif"}
                          </span>
                          <span className="text-[11px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                            Bagi Hasil: {tech.defaultPercentage}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Contact details */}
                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{tech.phone || "Tidak ada no. HP"}</span>
                    </div>
                    {tech.address && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{tech.address}</span>
                      </div>
                    )}
                  </div>

                  {/* Financial & Performance Snapshot */}
                  <div className="mt-4 bg-slate-50 rounded-2xl p-3.5 border border-slate-100 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Servis Selesai:</span>
                      <span className="font-bold text-slate-800">
                        {tech.completedCount} unit
                        {tech.pendingCount > 0 && (
                          <span className="text-amber-600 font-semibold ml-1">
                            ({tech.pendingCount} proses)
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Total Omset Jasa:</span>
                      <span className="font-bold text-slate-900">
                        {formatRupiah(tech.totalRevenue)}
                      </span>
                    </div>
                    {isOwner && (
                      <>
                        <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-200/60">
                          <span className="text-amber-700 font-medium">Hak Komisi Teknisi:</span>
                          <span className="font-black text-amber-600">
                            {formatRupiah(tech.totalCommission)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-emerald-700 font-medium">Laba Toko:</span>
                          <span className="font-black text-emerald-600">
                            {formatRupiah(tech.totalStoreProfit)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={() => handleOpenHistory(tech)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold text-xs transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Riwayat Servis</span>
                  </button>
                  <button
                    onClick={() => handleOpenEdit(tech)}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                    title="Edit Data Teknisi"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  {isOwner && (
                    <button
                      onClick={() => handleDelete(tech)}
                      className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors"
                      title={tech.totalServicesCount > 0 ? "Nonaktifkan Teknisi" : "Hapus Teknisi"}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Tambah / Edit Teknisi */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-100 space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    {modalMode === "ADD" ? "Tambah Teknisi Baru" : "Edit Data Teknisi"}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Entitas operasional internal (tanpa login)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-2xl bg-rose-50 text-rose-700 text-xs border border-rose-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Teknisi <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Misal: Mas Budi / Bang Agus"
                  className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nomor HP / WhatsApp
                </label>
                <input
                  type="text"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="Misal: 081234567890"
                  className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Persentase Komisi Default (%) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    required
                    value={formPercentage}
                    onChange={(e) => setFormPercentage(e.target.value)}
                    placeholder="50"
                    className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 text-slate-800 pr-10"
                  />
                  <span className="absolute right-3.5 top-3 text-xs font-bold text-slate-400">
                    %
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Persen hak teknisi dari biaya jasa servis (contoh: 50% berarti 50% untuk teknisi, 50% untuk toko).
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Alamat / Catatan Domisili
                </label>
                <textarea
                  rows={2}
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="Misal: Counter Cabang 2 / Servis Freelance"
                  className="w-full px-4 py-2 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 text-slate-800 resize-none"
                />
              </div>

              {modalMode === "EDIT" && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="isActiveCheck"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500"
                  />
                  <label htmlFor="isActiveCheck" className="text-xs font-bold text-slate-700">
                    Status Teknisi Aktif (Bisa dipilih di form servis)
                  </label>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-2xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all shadow-md shadow-teal-600/20 disabled:opacity-50"
                >
                  {submitting ? "Menyimpan..." : modalMode === "ADD" ? "Simpan Teknisi" : "Update Teknisi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Riwayat Servis Teknisi */}
      {isHistoryModalOpen && historyTech && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 animate-scaleUp overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-600 text-white font-extrabold flex items-center justify-center text-sm shadow-md shadow-teal-600/20">
                  {historyTech.name?.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    Riwayat Servis: {historyTech.name}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Bagi hasil default: {historyTech.defaultPercentage}% | HP: {historyTech.phone || "-"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body / History List */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {historyLoading ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-teal-600" />
                  <p className="text-xs">Memuat riwayat servis teknisi...</p>
                </div>
              ) : !historyTech.services || historyTech.services.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <Wrench className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="text-xs">Teknisi ini belum memiliki riwayat pengerjaan servis.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3 bg-teal-50/70 p-4 rounded-2xl border border-teal-100 text-xs">
                    <div>
                      <span className="text-slate-500 block">Total Servis:</span>
                      <span className="font-extrabold text-slate-800 text-base">
                        {historyTech.services.length} unit
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Total Jasa:</span>
                      <span className="font-extrabold text-teal-800 text-base">
                        {formatRupiah(
                          historyTech.services.reduce((s: number, i: any) => s + (i.serviceFee || 0), 0)
                        )}
                      </span>
                    </div>
                    {isOwner && (
                      <div>
                        <span className="text-slate-500 block">Total Komisi Teknisi:</span>
                        <span className="font-extrabold text-amber-700 text-base">
                          {formatRupiah(
                            historyTech.services.reduce((s: number, i: any) => s + (i.technicianFee || 0), 0)
                          )}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="border border-slate-200 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs text-slate-600">
                      <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                        <tr>
                          <th className="py-3 px-3">Tanggal / No</th>
                          <th className="py-3 px-3">Tipe HP & Kendala</th>
                          <th className="py-3 px-3">Pelanggan</th>
                          <th className="py-3 px-3 text-right">Biaya Jasa</th>
                          {isOwner && <th className="py-3 px-3 text-right">Komisi Teknisi</th>}
                          <th className="py-3 px-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {historyTech.services.map((srv: any) => (
                          <tr key={srv.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span className="font-bold text-slate-800 block">
                                {srv.serviceNumber}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {new Date(srv.createdAt).toLocaleDateString("id-ID", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="font-bold text-slate-900 block">
                                {srv.deviceType}
                              </span>
                              <span className="text-[11px] text-slate-500">{srv.issue}</span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span>{srv.customerName || "Umum"}</span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-slate-800 whitespace-nowrap">
                              {formatRupiah(srv.serviceFee)}
                            </td>
                            {isOwner && (
                              <td className="py-2.5 px-3 text-right font-bold text-amber-600 whitespace-nowrap">
                                {formatRupiah(srv.technicianFee)}
                                <span className="text-[10px] text-slate-400 block font-normal">
                                  ({srv.technicianPercentage}%)
                                </span>
                              </td>
                            )}
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  srv.status === "COMPLETED"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : srv.status === "CANCELLED"
                                    ? "bg-rose-100 text-rose-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {srv.status === "COMPLETED"
                                  ? "Selesai"
                                  : srv.status === "CANCELLED"
                                  ? "Batal"
                                  : "Proses"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 flex justify-end bg-slate-50/50">
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="px-5 py-2 rounded-2xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

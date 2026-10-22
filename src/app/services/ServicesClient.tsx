"use client";

import React, { useState, useRef } from "react";
import {
  Wrench,
  Plus,
  Search,
  Filter,
  UserCheck,
  Smartphone,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Printer,
  Edit2,
  Trash2,
  X,
  RefreshCw,
  Coins,
  Percent,
  Calendar,
  Phone,
  FileText,
  DollarSign,
  TrendingUp,
  Ban,
  RotateCcw,
} from "lucide-react";
import { formatRupiah } from "@/lib/calculations";

interface ServiceRecordItem {
  id: string;
  serviceNumber: string;
  deviceType: string;
  issue: string;
  serviceFee: number;
  sparepartCost: number;
  technicianPercentage: number;
  technicianFee: number;
  storeProfit: number;
  technicianId: string;
  customerName?: string | null;
  customerPhone?: string | null;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  paymentStatus: "PAID" | "UNPAID";
  paymentMethod: string;
  notes?: string | null;
  createdAt: string;
  completedAt?: string | null;
  technician?: {
    id: string;
    name: string;
    phone?: string | null;
    defaultPercentage: number;
  } | null;
  cashier?: {
    id: string;
    name: string;
  } | null;
}

interface TechnicianOption {
  id: string;
  name: string;
  phone?: string | null;
  defaultPercentage: number;
}

interface ServicesClientProps {
  initialServices: ServiceRecordItem[];
  technicians: TechnicianOption[];
  storeSetting: any | null;
  userRole: string;
  userName: string;
}

export default function ServicesClient({
  initialServices,
  technicians: initialTechs,
  storeSetting,
  userRole,
  userName,
}: ServicesClientProps) {
  const isOwner = userRole === "OWNER";
  const [services, setServices] = useState<ServiceRecordItem[]>(initialServices);
  const [technicians, setTechnicians] = useState<TechnicianOption[]>(initialTechs);
  const [loading, setLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<string>("ALL");

  // Modal: Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"ADD" | "EDIT">("ADD");
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);

  // Form Fields
  const [formDeviceType, setFormDeviceType] = useState("");
  const [formIssue, setFormIssue] = useState("");
  const [formServiceFee, setFormServiceFee] = useState<number | "">("");
  const [formSparepartCost, setFormSparepartCost] = useState<number | "">("");
  const [formTechnicianId, setFormTechnicianId] = useState("");
  const [formTechnicianPercentage, setFormTechnicianPercentage] = useState<number>(50);
  const [formCustomerName, setFormCustomerName] = useState("");
  const [formCustomerPhone, setFormCustomerPhone] = useState("");
  const [formStatus, setFormStatus] = useState<"PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED">("COMPLETED");
  const [formPaymentStatus, setFormPaymentStatus] = useState<"PAID" | "UNPAID">("PAID");
  const [formPaymentMethod, setFormPaymentMethod] = useState("CASH");
  const [formNotes, setFormNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Modal: Receipt / Print
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [selectedReceiptService, setSelectedReceiptService] = useState<ServiceRecordItem | null>(null);

  // Fetch updated data from API
  const fetchServices = async () => {
    setLoading(true);
    try {
      let query = "?";
      if (search) query += `search=${encodeURIComponent(search)}&`;
      if (selectedStatus !== "ALL") query += `status=${selectedStatus}&`;
      if (selectedTechnicianId !== "ALL") query += `technicianId=${selectedTechnicianId}&`;

      const res = await fetch(`/api/services${query}`);
      const data = await res.json();
      if (res.ok) {
        setServices(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setModalMode("ADD");
    setSelectedServiceId(null);
    setFormDeviceType("");
    setFormIssue("");
    setFormServiceFee("");
    setFormSparepartCost("");

    const defaultTech = technicians.length > 0 ? technicians[0] : null;
    setFormTechnicianId(defaultTech ? defaultTech.id : "");
    setFormTechnicianPercentage(isOwner && defaultTech ? (defaultTech.defaultPercentage || 50) : 50);

    setFormCustomerName("");
    setFormCustomerPhone("");
    setFormStatus("COMPLETED");
    setFormPaymentStatus("PAID");
    setFormPaymentMethod("CASH");
    setFormNotes("");
    setFormError("");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (srv: ServiceRecordItem) => {
    setModalMode("EDIT");
    setSelectedServiceId(srv.id);
    setFormDeviceType(srv.deviceType);
    setFormIssue(srv.issue);
    setFormServiceFee(srv.serviceFee);
    setFormSparepartCost(srv.sparepartCost || "");
    setFormTechnicianId(srv.technicianId);
    setFormTechnicianPercentage(isOwner ? srv.technicianPercentage : 50);
    setFormCustomerName(srv.customerName || "");
    setFormCustomerPhone(srv.customerPhone || "");
    setFormStatus(srv.status);
    setFormPaymentStatus(srv.paymentStatus);
    setFormPaymentMethod(srv.paymentMethod);
    setFormNotes(srv.notes || "");
    setFormError("");
    setIsModalOpen(true);
  };

  // Change technician selection in form -> auto update default percentage
  const handleTechnicianChange = (techId: string) => {
    setFormTechnicianId(techId);
    if (isOwner) {
      const tech = technicians.find((t) => t.id === techId);
      if (tech) {
        setFormTechnicianPercentage(tech.defaultPercentage || 50);
      }
    }
  };

  // Real-time calculation helpers
  const feeNum = typeof formServiceFee === "number" ? formServiceFee : 0;
  const partNum = typeof formSparepartCost === "number" ? formSparepartCost : 0;
  const netPool = Math.max(0, feeNum - partNum);
  const calcTechFee = Math.round(netPool * (formTechnicianPercentage / 100));
  const calcStoreProfit = feeNum - partNum - calcTechFee;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!formDeviceType.trim()) {
      setFormError("Tipe HP wajib diisi.");
      return;
    }
    if (!formIssue.trim()) {
      setFormError("Kendala / Kerusakan wajib diisi.");
      return;
    }
    if (!formTechnicianId) {
      setFormError("Pilih teknisi yang mengerjakan servis.");
      return;
    }
    if (typeof formServiceFee !== "number" || formServiceFee <= 0) {
      setFormError("Biaya Jasa Servis harus berupa angka positif.");
      return;
    }

    setSubmitting(true);
    setFormError("");

    try {
      let url = "/api/services";
      let method = "POST";

      if (modalMode === "EDIT" && selectedServiceId) {
        url = `/api/services/${selectedServiceId}`;
        method = "PUT";
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceType: formDeviceType.trim(),
          issue: formIssue.trim(),
          serviceFee: formServiceFee,
          sparepartCost: typeof formSparepartCost === "number" ? formSparepartCost : 0,
          technicianId: formTechnicianId,
          ...(isOwner ? { technicianPercentage: formTechnicianPercentage } : {}),
          customerName: formCustomerName.trim() || null,
          customerPhone: formCustomerPhone.trim() || null,
          status: formStatus,
          paymentStatus: formPaymentStatus,
          paymentMethod: formPaymentMethod,
          notes: formNotes.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menyimpan data servis");
      }

      setIsModalOpen(false);
      await fetchServices();
    } catch (err: any) {
      setFormError(err.message || "Terjadi kesalahan saat menyimpan data servis");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (
    srv: ServiceRecordItem,
    newStatus: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
  ) => {
    try {
      const res = await fetch(`/api/services/${srv.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          paymentStatus: newStatus === "COMPLETED" ? "PAID" : srv.paymentStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengubah status servis");
      await fetchServices();
    } catch (err: any) {
      alert(err.message || "Gagal mengubah status");
    }
  };

  const handleCancelService = async (srv: ServiceRecordItem) => {
    if (
      !window.confirm(
        `Yakin ingin membatalkan servis ${srv.serviceNumber} (${srv.deviceType} - ${srv.issue})?\n\nStatus akan diubah menjadi Dibatalkan dan tidak akan dihitung ke omzet atau laba toko.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/services/${srv.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "CANCELLED",
          paymentStatus: "UNPAID",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membatalkan servis");
      await fetchServices();
    } catch (err: any) {
      alert(err.message || "Gagal membatalkan servis");
    }
  };

  const handleRestoreService = async (srv: ServiceRecordItem) => {
    try {
      const res = await fetch(`/api/services/${srv.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "COMPLETED",
          paymentStatus: "PAID",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengaktifkan kembali servis");
      await fetchServices();
    } catch (err: any) {
      alert(err.message || "Gagal mengaktifkan kembali servis");
    }
  };

  const handleDelete = async (srv: ServiceRecordItem) => {
    if (!window.confirm(`Yakin ingin menghapus data servis ${srv.serviceNumber}?`)) return;

    try {
      const res = await fetch(`/api/services/${srv.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapus data servis");
      await fetchServices();
    } catch (err: any) {
      alert(err.message || "Gagal menghapus data servis");
    }
  };

  const handleOpenReceipt = (srv: ServiceRecordItem) => {
    setSelectedReceiptService(srv);
    setIsReceiptModalOpen(true);
  };

  // Filtered Services
  const filteredServices = services.filter((s) => {
    const matchSearch =
      s.serviceNumber.toLowerCase().includes(search.toLowerCase()) ||
      s.deviceType.toLowerCase().includes(search.toLowerCase()) ||
      s.issue.toLowerCase().includes(search.toLowerCase()) ||
      (s.customerName && s.customerName.toLowerCase().includes(search.toLowerCase())) ||
      (s.customerPhone && s.customerPhone.includes(search));

    const matchStatus = selectedStatus === "ALL" || s.status === selectedStatus;
    const matchTech = selectedTechnicianId === "ALL" || s.technicianId === selectedTechnicianId;

    return matchSearch && matchStatus && matchTech;
  });

  // Aggregates for filtered data (Hanya servis yang sudah selesai / diambil dan lunas)
  const paidCompleted = filteredServices.filter(
    (s) => s.status === "COMPLETED" && s.paymentStatus === "PAID"
  );
  const totalRevenue = paidCompleted.reduce((sum, s) => sum + s.serviceFee, 0);
  const totalTechnicianCommission = paidCompleted.reduce((sum, s) => sum + s.technicianFee, 0);
  const totalStoreProfit = paidCompleted.reduce((sum, s) => sum + s.storeProfit, 0);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-teal-900 via-teal-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-teal-900/15 flex flex-col md:flex-row md:items-center justify-between gap-6 border border-teal-700/30">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-[10px] font-bold tracking-wider uppercase">
            <Wrench className="w-3.5 h-3.5" />
            <span>Divisi Servis HP & Teknisi</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Pencatatan Servis HP
          </h1>
          <p className="text-teal-100 text-xs sm:text-sm max-w-xl">
            Catat pengerjaan servis masuk, tipe HP, kendala kerusakan, pemilihan teknisi, pembagian
            persenan jasa secara otomatis, dan cetak nota servis pelanggan.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchServices}
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
            <span>Catat Servis Baru</span>
          </button>
        </div>
      </div>

      {/* Aggregate Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Servis
            </span>
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <Wrench className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-800">
              {filteredServices.length}
            </span>
            <span className="text-xs text-emerald-600 font-bold">
              ({filteredServices.filter((s) => s.status === "COMPLETED").length} Selesai)
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            {filteredServices.filter((s) => s.status === "IN_PROGRESS").length} sedang proses pengerjaan
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Biaya Jasa
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-800">
            {formatRupiah(totalRevenue)}
          </div>
          <p className="text-[11px] text-slate-400">Total uang masuk dari jasa servis</p>
        </div>

        {isOwner ? (
          <>
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Komisi Hak Teknisi
                </span>
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Percent className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-black text-amber-600">
                {formatRupiah(totalTechnicianCommission)}
              </div>
              <p className="text-[11px] text-slate-400">Bagi hasil hak para teknisi</p>
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
                {formatRupiah(totalStoreProfit)}
              </div>
              <p className="text-[11px] text-slate-400">Sumbangan laba bersih untuk toko</p>
            </div>
          </>
        ) : (
          <>
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Servis Selesai
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-black text-emerald-600">
                {filteredServices.filter((s) => s.status === "COMPLETED").length}
              </div>
              <p className="text-[11px] text-slate-400">Unit servis yang telah selesai</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Sedang Dikerjakan
                </span>
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-black text-blue-600">
                {
                  filteredServices.filter(
                    (s) => s.status === "IN_PROGRESS" || s.status === "PENDING"
                  ).length
                }
              </div>
              <p className="text-[11px] text-slate-400">Unit dalam antrean / proses kerja</p>
            </div>
          </>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1 flex items-center gap-2 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200/70">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari tipe HP, kendala, no. servis, atau pelanggan..."
            className="w-full text-xs outline-none bg-transparent text-slate-800 placeholder-slate-400"
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-xs text-slate-400 hover:text-slate-600">
              Clear
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white focus:outline-none focus:border-teal-500"
          >
            <option value="ALL">Semua Status</option>
            <option value="COMPLETED">Selesai</option>
            <option value="IN_PROGRESS">Dalam Proses</option>
            <option value="PENDING">Menunggu Part</option>
            <option value="CANCELLED">Dibatalkan</option>
          </select>

          {/* Technician Filter */}
          <select
            value={selectedTechnicianId}
            onChange={(e) => setSelectedTechnicianId(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white focus:outline-none focus:border-teal-500"
          >
            <option value="ALL">Semua Teknisi</option>
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Service Records Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {filteredServices.length === 0 ? (
          <div className="py-16 text-center space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Wrench className="w-8 h-8" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base">Belum Ada Transaksi Servis</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                Catat servis HP pertama dari pelanggan untuk mulai mencatat biaya jasa dan membagi komisi teknisi.
              </p>
            </div>
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-teal-600 text-white font-bold text-xs hover:bg-teal-700 shadow-md shadow-teal-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>Catat Servis Baru</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                <tr>
                  <th className="py-3.5 px-4">No / Tanggal</th>
                  <th className="py-3.5 px-4">No. Servis</th>
                  <th className="py-3.5 px-4">Tipe HP & Kendala</th>
                  <th className="py-3.5 px-4">Teknisi</th>
                  <th className="py-3.5 px-4 text-right">Biaya Jasa (Rp)</th>
                  {isOwner && <th className="py-3.5 px-4 text-right">Komisi Teknisi</th>}
                  {isOwner && <th className="py-3.5 px-4 text-right">Laba Toko</th>}
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredServices.map((srv, idx) => {
                  const sDate = new Date(srv.createdAt).toLocaleDateString("id-ID", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  });

                  return (
                    <tr key={srv.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-bold text-slate-800">{idx + 1}</span>
                        <span className="block text-[11px] text-slate-400">{sDate}</span>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200">
                          {srv.serviceNumber}
                        </span>
                        <span className="block text-[10px] text-slate-400 mt-1">
                          Kasir: {srv.cashier?.name || "Kasir"}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-extrabold text-slate-900 text-xs">
                          {srv.deviceType}
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium">
                          {srv.issue}
                        </div>
                        {srv.notes && (
                          <div className="text-[10px] text-slate-400 italic mt-0.5">
                            Catatan: {srv.notes}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 font-bold text-slate-700 text-[11px]">
                          <UserCheck className="w-3 h-3 text-teal-600" />
                          <span>{srv.technician?.name || "Teknisi"}</span>
                        </div>
                        {isOwner && (
                          <span className="block text-[10px] text-slate-400 mt-0.5 pl-1">
                            Persen: {srv.technicianPercentage}%
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap font-black text-slate-900 text-xs">
                        {formatRupiah(srv.serviceFee)}
                        <span className="block text-[10px] font-normal text-slate-400">
                          Bayar: {srv.paymentMethod}
                        </span>
                      </td>

                      {isOwner && (
                        <td className="py-3.5 px-4 text-right whitespace-nowrap font-bold text-amber-600">
                          {formatRupiah(srv.technicianFee)}
                        </td>
                      )}

                      {isOwner && (
                        <td className="py-3.5 px-4 text-right whitespace-nowrap font-bold text-emerald-600">
                          {formatRupiah(srv.storeProfit)}
                        </td>
                      )}

                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            srv.status === "COMPLETED"
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : srv.status === "IN_PROGRESS"
                              ? "bg-blue-100 text-blue-800 border border-blue-200"
                              : srv.status === "PENDING"
                              ? "bg-amber-100 text-amber-800 border border-amber-200"
                              : "bg-rose-100 text-rose-800 border border-rose-200"
                          }`}
                        >
                          {srv.status === "COMPLETED"
                            ? "Selesai"
                            : srv.status === "IN_PROGRESS"
                            ? "Pengerjaan"
                            : srv.status === "PENDING"
                            ? "Menunggu"
                            : "Dibatalkan"}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* 1. Tombol Edit */}
                          <button
                            onClick={() => handleOpenEdit(srv)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors shadow-sm"
                            title="Edit Data Servis"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-slate-600" />
                            <span>Edit</span>
                          </button>

                          {/* 2. Tombol Batalkan / Pulihkan */}
                          {srv.status !== "CANCELLED" ? (
                            <button
                              onClick={() => handleCancelService(srv)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs transition-colors border border-rose-200"
                              title="Batalkan Servis Ini"
                            >
                              <Ban className="w-3.5 h-3.5 text-rose-600" />
                              <span>Batalkan</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleRestoreService(srv)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs transition-colors border border-blue-200"
                              title="Pulihkan Servis"
                            >
                              <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
                              <span>Pulihkan</span>
                            </button>
                          )}

                          {/* 3. Tombol Tandai Selesai Cepat (Jika belum selesai) */}
                          {srv.status !== "COMPLETED" && srv.status !== "CANCELLED" && (
                            <button
                              onClick={() => handleUpdateStatus(srv, "COMPLETED")}
                              className="p-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors"
                              title="Tandai Selesai"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          )}

                          {/* 4. Tombol Cetak Struk */}
                          <button
                            onClick={() => handleOpenReceipt(srv)}
                            className="p-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-700 transition-colors"
                            title="Cetak Nota Servis"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {/* 5. Tombol Hapus (Owner) */}
                          {isOwner && (
                            <button
                              onClick={() => handleDelete(srv)}
                              className="p-1.5 rounded-xl bg-slate-50 hover:bg-rose-100 text-slate-400 hover:text-rose-600 transition-colors"
                              title="Hapus Servis (Owner)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Catat / Edit Servis HP */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-100 animate-scaleUp overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-md shadow-teal-600/20">
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    {modalMode === "ADD" ? "Catat Servis HP Baru" : "Edit Data Servis HP"}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {modalMode === "ADD"
                      ? isOwner
                        ? "Input tipe HP, kendala kerusakan, pemilihan teknisi & persenan bagi hasil"
                        : "Input tipe HP, kendala kerusakan, dan pemilihan teknisi servis"
                      : isOwner
                      ? "Perbarui data servis, biaya jasa, ganti teknisi, atau batalkan servis"
                      : "Perbarui data servis, biaya jasa, atau batalkan servis"}
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

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {formError && (
                <div className="p-3 rounded-2xl bg-rose-50 text-rose-700 text-xs border border-rose-200 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {formStatus === "CANCELLED" && (
                <div className="p-3 rounded-2xl bg-rose-50 text-rose-800 text-xs border border-rose-200 flex items-center gap-2 font-bold">
                  <Ban className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>Status Servis: DIBATALKAN (Tidak dihitung ke omzet & laba toko)</span>
                </div>
              )}

              <form id="serviceForm" onSubmit={handleSubmit} className="space-y-4">
                {/* Tipe HP & Kendala */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Tipe HP / Model <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formDeviceType}
                      onChange={(e) => setFormDeviceType(e.target.value)}
                      placeholder="Contoh: iPhone 11 / Samsung A52"
                      className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Kendala / Kerusakan <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formIssue}
                      onChange={(e) => setFormIssue(e.target.value)}
                      placeholder="Contoh: Ganti LCD / Mati Total / Baterai"
                      className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 text-slate-800"
                    />
                  </div>
                </div>

                {/* Pemilihan Teknisi & Persenan */}
                <div
                  className={`grid ${
                    isOwner ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"
                  } gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/80`}
                >
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center justify-between">
                      <span>Pemilihan Teknisi <span className="text-rose-500">*</span></span>
                      {technicians.length === 0 && (
                        <span className="text-[10px] text-rose-500 font-normal">
                          (Belum ada teknisi terdaftar)
                        </span>
                      )}
                    </label>
                    <select
                      required
                      value={formTechnicianId}
                      onChange={(e) => handleTechnicianChange(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold focus:outline-none focus:border-teal-500 text-slate-800 bg-white"
                    >
                      <option value="">-- Pilih Teknisi --</option>
                      {technicians.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                          {isOwner && t.defaultPercentage !== undefined && t.defaultPercentage > 0
                            ? ` (Bagi Hasil: ${t.defaultPercentage}%)`
                            : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  {isOwner && (
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1">
                        Persenan Teknisi (%) <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          required
                          value={formTechnicianPercentage}
                          onChange={(e) => setFormTechnicianPercentage(parseFloat(e.target.value) || 0)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold focus:outline-none focus:border-teal-500 text-slate-800 pr-10 bg-white"
                        />
                        <span className="absolute right-3.5 top-2.5 text-xs font-bold text-slate-400">
                          %
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Biaya Jasa & Modal Sparepart */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Biaya Jasa Servis (Rp) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="any"
                      value={formServiceFee}
                      onChange={(e) =>
                        setFormServiceFee(e.target.value ? parseFloat(e.target.value) : "")
                      }
                      placeholder="Contoh: 150000"
                      className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Modal Sparepart (Rp, opsional)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={formSparepartCost}
                      onChange={(e) =>
                        setFormSparepartCost(e.target.value ? parseFloat(e.target.value) : "")
                      }
                      placeholder="0 jika murni jasa"
                      className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 text-slate-900"
                    />
                  </div>
                </div>

                {/* Real-time Calculation Card (Khusus Owner) */}
                {isOwner && feeNum > 0 && (
                  <div className="p-4 rounded-2xl bg-teal-50 border border-teal-200/80 space-y-2 text-xs">
                    <span className="font-extrabold text-teal-900 block text-xs tracking-wide uppercase">
                      Simulasi Pembagian Keuntungan:
                    </span>
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div className="bg-white p-2.5 rounded-xl border border-teal-100">
                        <span className="text-slate-500 text-[11px] block">
                          Hak Teknisi ({formTechnicianPercentage}%):
                        </span>
                        <span className="font-black text-amber-600 text-sm">
                          {formatRupiah(calcTechFee)}
                        </span>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-teal-100">
                        <span className="text-slate-500 text-[11px] block">
                          Laba Bersih Toko ({100 - formTechnicianPercentage}%):
                        </span>
                        <span className="font-black text-emerald-600 text-sm">
                          {formatRupiah(calcStoreProfit)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Status Servis, Pembayaran & Metode */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Status Servis
                    </label>
                    <select
                      value={formStatus}
                      onChange={(e: any) => setFormStatus(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white"
                    >
                      <option value="COMPLETED">Selesai (Langsung Jadi)</option>
                      <option value="IN_PROGRESS">Dalam Proses</option>
                      <option value="PENDING">Menunggu Sparepart</option>
                      <option value="CANCELLED">Dibatalkan</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Status Bayar
                    </label>
                    <select
                      value={formPaymentStatus}
                      onChange={(e: any) => setFormPaymentStatus(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white"
                    >
                      <option value="PAID">Lunas</option>
                      <option value="UNPAID">Belum Lunas</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Metode Pembayaran
                    </label>
                    <select
                      value={formPaymentMethod}
                      onChange={(e) => setFormPaymentMethod(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white"
                    >
                      <option value="CASH">Tunai (Cash)</option>
                      <option value="TRANSFER">Transfer Bank</option>
                      <option value="QRIS">QRIS</option>
                    </select>
                  </div>
                </div>

                {/* Catatan Tambahan */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Catatan Tambahan (Kelengkapan HP / Garansi)
                  </label>
                  <textarea
                    rows={2}
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="Contoh: Garansi servis 7 hari, tanpa charger & SIM card"
                    className="w-full px-3.5 py-2 rounded-2xl border border-slate-200 text-xs focus:outline-none focus:border-teal-500 text-slate-800 resize-none"
                  />
                </div>
              </form>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 flex items-center justify-between gap-3 bg-slate-50/70 shrink-0">
              <div>
                {modalMode === "EDIT" && (
                  formStatus !== "CANCELLED" ? (
                    <button
                      type="button"
                      onClick={() => {
                        setFormStatus("CANCELLED");
                        setFormPaymentStatus("UNPAID");
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all"
                    >
                      <Ban className="w-3.5 h-3.5 text-rose-600" />
                      <span>Batalkan Servis Ini</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setFormStatus("COMPLETED");
                        setFormPaymentStatus("PAID");
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold transition-all"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
                      <span>Pulihkan (Selesai)</span>
                    </button>
                  )
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-2xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-100"
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  form="serviceForm"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md shadow-teal-600/20 disabled:opacity-50 transition-all"
                >
                  {submitting ? "Menyimpan..." : modalMode === "ADD" ? "Simpan Servis" : "Update Servis"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Cetak Nota / Struk Tanda Terima Servis */}
      {isReceiptModalOpen && selectedReceiptService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-slate-100 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="font-bold text-xs text-slate-700">Tanda Terima / Nota Servis</span>
              <button
                onClick={() => setIsReceiptModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Printable Receipt Box */}
            <div
              id="printableReceipt"
              className="bg-slate-50 p-4 rounded-2xl border border-dashed border-slate-300 font-mono text-[11px] space-y-3 text-slate-800"
            >
              <div className="text-center space-y-0.5">
                <div className="font-bold text-sm tracking-wide">
                  {storeSetting?.name || "CHICHA MOBILE"}
                </div>
                <div className="text-[10px] text-slate-500">
                  {storeSetting?.address || "Pusat Aksesoris & Servis HP"}
                </div>
                <div className="text-[10px] text-slate-500">
                  Telp: {storeSetting?.phone || "0812-3456-7890"}
                </div>
              </div>

              <div className="border-t border-dashed border-slate-300 pt-2 space-y-1 text-[10px]">
                <div className="flex justify-between">
                  <span>No. Servis:</span>
                  <span className="font-bold">{selectedReceiptService.serviceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tanggal:</span>
                  <span>
                    {new Date(selectedReceiptService.createdAt).toLocaleDateString("id-ID")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Teknisi:</span>
                  <span className="font-bold">
                    {selectedReceiptService.technician?.name || "Teknisi"}
                  </span>
                </div>
              </div>

              <div className="border-t border-dashed border-slate-300 pt-2 space-y-1">
                <div className="font-bold text-xs">{selectedReceiptService.deviceType}</div>
                <div className="text-[10px] text-slate-600">
                  Kerusakan: {selectedReceiptService.issue}
                </div>
                {selectedReceiptService.notes && (
                  <div className="text-[9px] text-slate-500 italic">
                    Catatan: {selectedReceiptService.notes}
                  </div>
                )}
              </div>

              <div className="border-t border-dashed border-slate-300 pt-2 space-y-1">
                <div className="flex justify-between text-xs font-black">
                  <span>TOTAL BIAYA JASA:</span>
                  <span>{formatRupiah(selectedReceiptService.serviceFee)}</span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-600">
                  <span>Status Pembayaran:</span>
                  <span className="font-bold">
                    {selectedReceiptService.paymentStatus === "PAID" ? "LUNAS" : "BELUM LUNAS"} (
                    {selectedReceiptService.paymentMethod})
                  </span>
                </div>
              </div>

              <div className="border-t border-dashed border-slate-300 pt-2 text-center text-[9px] text-slate-500 leading-tight">
                {storeSetting?.receiptFooter ||
                  "Harap simpan nota ini saat pengambilan unit HP. Garansi servis berlaku sesuai catatan."}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setIsReceiptModalOpen(false)}
                className="flex-1 py-2.5 rounded-2xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50"
              >
                Tutup
              </button>
              <button
                onClick={() => window.print()}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md shadow-teal-600/20"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Nota</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

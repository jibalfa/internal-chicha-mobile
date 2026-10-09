"use client";

import React, { useState, useMemo } from "react";
import {
  UserCheck,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Phone,
  MessageCircle,
  X,
  CreditCard,
  Banknote,
  QrCode,
  RotateCcw,
  Calendar,
  AlertTriangle,
  Receipt,
  FileText,
  Trash2,
} from "lucide-react";
import { formatRupiah } from "@/lib/calculations";

export interface VoucherDebtItem {
  id: string;
  debtId: string;
  voucherId: string;
  quantity: number;
  costPrice: number;
  unitPrice: number;
  subtotal: number;
  profit: number;
  voucher: {
    id: string;
    operator: string;
    nominal: string;
    sellingPrice: number;
    costPrice?: number;
    stock: number;
  };
}

export interface VoucherDebt {
  id: string;
  debtNumber: string;
  customerName: string;
  customerPhone: string | null;
  totalAmount: number;
  status: "UNPAID" | "PAID" | "CANCELLED";
  dueDate: string | null;
  paidAt: string | null;
  paidMethod: string | null;
  notes: string | null;
  cashierId: string | null;
  createdAt: string;
  updatedAt: string;
  cashier?: {
    id: string;
    name: string;
    username?: string;
  } | null;
  items: VoucherDebtItem[];
}

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

interface VoucherDebtsTabProps {
  vouchers: Voucher[];
  initialDebts: VoucherDebt[];
  onRefreshVouchers: () => Promise<void> | void;
  onRefreshSales: () => Promise<void> | void;
  userRole: string;
}

export default function VoucherDebtsTab({
  vouchers,
  initialDebts,
  onRefreshVouchers,
  onRefreshSales,
  userRole,
}: VoucherDebtsTabProps) {
  const [debts, setDebts] = useState<VoucherDebt[]>(initialDebts);
  const [filterStatus, setFilterStatus] = useState<"ALL" | "UNPAID" | "PAID" | "CANCELLED">("UNPAID");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedDebtForPay, setSelectedDebtForPay] = useState<VoucherDebt | null>(null);
  const [debtToCancel, setDebtToCancel] = useState<VoucherDebt | null>(null);

  // Pay Form
  const [paidMethod, setPaidMethod] = useState<"CASH" | "TRANSFER" | "QRIS">("CASH");
  const [payNotes, setPayNotes] = useState("");

  // Add Debt Form
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [debtItems, setDebtItems] = useState<{ voucherId: string; quantity: number }[]>([
    { voucherId: vouchers[0]?.id || "", quantity: 1 },
  ]);

  // Refresh Debts from server
  const fetchDebts = async () => {
    try {
      const res = await fetch("/api/vouchers/debts");
      const data = await res.json();
      if (res.ok && data.debts) {
        setDebts(data.debts);
      }
    } catch (err) {
      console.error("Failed to fetch debts", err);
    }
  };

  // Metrics calculation
  const metrics = useMemo(() => {
    const unpaid = debts.filter((d) => d.status === "UNPAID");
    const unpaidCount = unpaid.length;
    const unpaidTotal = unpaid.reduce((sum, d) => sum + d.totalAmount, 0);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const paidToday = debts.filter(
      (d) => d.status === "PAID" && d.paidAt && new Date(d.paidAt) >= todayStart && new Date(d.paidAt) <= todayEnd
    );
    const paidTodayCount = paidToday.length;
    const paidTodayTotal = paidToday.reduce((sum, d) => sum + d.totalAmount, 0);

    // Due Soon: UNPAID and dueDate within 3 days or overdue
    const now = new Date();
    const threeDaysLater = new Date();
    threeDaysLater.setDate(threeDaysLater.getDate() + 3);

    const dueSoonCount = unpaid.filter((d) => {
      if (!d.dueDate) return false;
      const due = new Date(d.dueDate);
      return due <= threeDaysLater;
    }).length;

    return {
      unpaidCount,
      unpaidTotal,
      paidTodayCount,
      paidTodayTotal,
      dueSoonCount,
    };
  }, [debts]);

  // Filtered debts list
  const filteredDebts = useMemo(() => {
    return debts.filter((d) => {
      const matchesStatus = filterStatus === "ALL" || d.status === filterStatus;
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        d.customerName.toLowerCase().includes(q) ||
        (d.customerPhone && d.customerPhone.toLowerCase().includes(q)) ||
        d.debtNumber.toLowerCase().includes(q) ||
        (d.notes && d.notes.toLowerCase().includes(q)) ||
        d.items.some((i) =>
          `${i.voucher?.operator || ""} ${i.voucher?.nominal || ""}`.toLowerCase().includes(q)
        );

      return matchesStatus && matchesSearch;
    });
  }, [debts, filterStatus, search]);

  // Open modal create
  const handleOpenAddModal = () => {
    setCustomerName("");
    setCustomerPhone("");
    setDueDate("");
    setNotes("");
    setDebtItems([
      { voucherId: vouchers.find((v) => v.stock > 0)?.id || vouchers[0]?.id || "", quantity: 1 },
    ]);
    setErrorMessage(null);
    setIsAddModalOpen(true);
  };

  // Add Item in Modal
  const handleAddDebtItemRow = () => {
    const available = vouchers.find((v) => !debtItems.some((item) => item.voucherId === v.id) && v.stock > 0);
    setDebtItems([
      ...debtItems,
      { voucherId: available ? available.id : vouchers[0]?.id || "", quantity: 1 },
    ]);
  };

  // Remove Item row in Modal
  const handleRemoveDebtItemRow = (index: number) => {
    if (debtItems.length <= 1) return;
    setDebtItems(debtItems.filter((_, i) => i !== index));
  };

  // Change Item in Modal
  const handleItemChange = (index: number, field: "voucherId" | "quantity", value: any) => {
    setDebtItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Total estimation in Add Modal
  const modalTotal = useMemo(() => {
    return debtItems.reduce((sum, item) => {
      const v = vouchers.find((voc) => voc.id === item.voucherId);
      if (!v) return sum;
      return sum + v.sellingPrice * (Number(item.quantity) || 0);
    }, 0);
  }, [debtItems, vouchers]);

  // Submit Create Debt
  const handleSubmitCreateDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      setErrorMessage("Nama pelanggan wajib diisi.");
      return;
    }

    if (debtItems.length === 0) {
      setErrorMessage("Minimal pilih 1 jenis voucher.");
      return;
    }

    // Check stocks
    for (const item of debtItems) {
      const v = vouchers.find((voc) => voc.id === item.voucherId);
      if (!v) {
        setErrorMessage("Salah satu voucher yang dipilih tidak valid.");
        return;
      }
      if (item.quantity <= 0) {
        setErrorMessage("Jumlah voucher harus minimal 1 pcs.");
        return;
      }
      if (v.stock < item.quantity) {
        setErrorMessage(
          `Stok voucher ${v.operator} ${v.nominal} tidak mencukupi (Tersedia: ${v.stock} pcs, diminta: ${item.quantity} pcs).`
        );
        return;
      }
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/vouchers/debts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim() || null,
          dueDate: dueDate ? new Date(dueDate).toISOString() : null,
          notes: notes.trim() || null,
          items: debtItems.map((i) => ({
            voucherId: i.voucherId,
            quantity: Number(i.quantity),
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mencatat bon voucher pelanggan");

      setSuccessMessage(`Berhasil mencatat bon voucher untuk ${customerName} (#${data.debt.debtNumber})!`);
      setIsAddModalOpen(false);

      // Refresh data
      await fetchDebts();
      await onRefreshVouchers();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Open Pay Modal
  const handleOpenPayModal = (debt: VoucherDebt) => {
    setSelectedDebtForPay(debt);
    setPaidMethod("CASH");
    setPayNotes("");
    setErrorMessage(null);
    setIsPayModalOpen(true);
  };

  // Submit Pay
  const handleSubmitPayDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDebtForPay) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/vouchers/debts/${selectedDebtForPay.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "PAY",
          paidMethod,
          notes: payNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memproses pelunasan bon");

      setSuccessMessage(
        `Pelunasan bon #${selectedDebtForPay.debtNumber} (${selectedDebtForPay.customerName}) berhasil dicatat!`
      );
      setIsPayModalOpen(false);
      setSelectedDebtForPay(null);

      // Refresh data
      await fetchDebts();
      await onRefreshSales();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Submit Cancel Debt
  const handleSubmitCancelDebt = async () => {
    if (!debtToCancel) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/vouchers/debts/${debtToCancel.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membatalkan bon");

      setSuccessMessage(
        `Bon #${debtToCancel.debtNumber} (${debtToCancel.customerName}) berhasil dibatalkan. Stok fisik dikembalikan ke etalase toko.`
      );
      setDebtToCancel(null);

      // Refresh data
      await fetchDebts();
      await onRefreshVouchers();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  // WhatsApp Reminder Link
  const handleWhatsAppReminder = (debt: VoucherDebt) => {
    if (!debt.customerPhone) return;

    let phone = debt.customerPhone.replace(/[^0-9]/g, "");
    if (phone.startsWith("0")) {
      phone = "62" + phone.slice(1);
    } else if (!phone.startsWith("62")) {
      phone = "62" + phone;
    }

    const itemsStr = debt.items
      .map((i) => `${i.voucher?.operator || "Voucher"} ${i.voucher?.nominal || ""} (${i.quantity} pcs)`)
      .join(", ");

    const dueStr = debt.dueDate
      ? ` yang dijanjikan pada ${new Date(debt.dueDate).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}`
      : "";

    const text = `Halo Kak/Pak/Bu *${debt.customerName}*, salam dari Chicha Mobile 😊.%0A%0AMengingatkan untuk catatan bon voucher fisik:%0A- *${itemsStr}*%0ATotal tagihan: *${formatRupiah(
      debt.totalAmount
    )}*${dueStr}.%0A%0AMohon konfirmasi atau dapat dilunasi saat mampir ke konter ya. Terima kasih banyak! 🙏`;

    const url = `https://wa.me/${phone}?text=${text}`;
    window.open(url, "_blank");
  };

  return (
    <div className="space-y-6">
      {/* Alert Messages */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-2xl flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
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
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-500 hover:text-rose-700">
            ✕
          </button>
        </div>
      )}

      {/* Top Banner & Action */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
              Buku Kasbon / Piutang
            </span>
            {metrics.unpaidCount > 0 && (
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                {metrics.unpaidCount} Belum Lunas
              </span>
            )}
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight mt-2 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-indigo-600" />
            <span>Daftar Bon & Piutang Voucher Pelanggan</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Catat pelanggan yang mengambil voucher fisik dan belum bayar langsung. Stok voucher langsung berkurang,
            kas laci tidak terganggu, dan omset uang masuk baru diakui saat dilunasi.
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="inline-flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold shadow-lg shadow-indigo-600/25 transition-all active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Catat Bon Pelanggan Baru</span>
        </button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Total Piutang Belum Lunas</p>
            <p className="text-xl font-extrabold text-rose-600 tracking-tight">
              {formatRupiah(metrics.unpaidTotal)}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">{metrics.unpaidCount} transaksi belum lunas</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Dilunasi Hari Ini</p>
            <p className="text-xl font-extrabold text-emerald-600 tracking-tight">
              {formatRupiah(metrics.paidTodayTotal)}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">{metrics.paidTodayCount} bon dilunasi hari ini</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Perlu Ditagih / Jatuh Tempo</p>
            <p className="text-xl font-extrabold text-amber-600 tracking-tight">
              {metrics.dueSoonCount} Pelanggan
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">Jatuh tempo dekat atau terlewat</p>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { key: "UNPAID", label: "Belum Lunas", count: metrics.unpaidCount },
            { key: "PAID", label: "Sudah Lunas", count: debts.filter((d) => d.status === "PAID").length },
            { key: "ALL", label: "Semua Bon", count: debts.length },
            { key: "CANCELLED", label: "Dibatalkan", count: debts.filter((d) => d.status === "CANCELLED").length },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterStatus(tab.key as any)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                filterStatus === tab.key
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                  filterStatus === tab.key ? "bg-white/20 text-white" : "bg-white text-slate-600"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama, no. HP, no bon..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </div>
      </div>

      {/* Debts Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200/80">
                <th className="py-3.5 px-4">Status & No. Bon</th>
                <th className="py-3.5 px-4">Pelanggan</th>
                <th className="py-3.5 px-4">Voucher yang Diambil</th>
                <th className="py-3.5 px-4 text-right">Total Tagihan</th>
                <th className="py-3.5 px-4">Jatuh Tempo & Catatan</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredDebts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    <UserCheck className="w-10 h-10 mx-auto mb-2 text-slate-300 stroke-1" />
                    <p className="font-semibold text-slate-600">Tidak ada data catatan bon</p>
                    <p className="text-slate-400 text-xs mt-0.5">
                      {search ? "Tidak ada bon yang sesuai pencarian Anda" : "Semua piutang telah lunas atau belum ada catatan bon."}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredDebts.map((debt) => {
                  const isUnpaid = debt.status === "UNPAID";
                  const isPaid = debt.status === "PAID";
                  const isCancelled = debt.status === "CANCELLED";

                  const isOverdue =
                    isUnpaid && debt.dueDate && new Date(debt.dueDate) < new Date();

                  return (
                    <tr
                      key={debt.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isOverdue ? "bg-rose-50/30" : ""
                      }`}
                    >
                      {/* No. Bon & Status */}
                      <td className="py-4 px-4 align-top">
                        <div className="space-y-1">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              isUnpaid
                                ? isOverdue
                                  ? "bg-rose-100 text-rose-700 border-rose-300"
                                  : "bg-amber-50 text-amber-700 border-amber-200"
                                : isPaid
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-slate-100 text-slate-500 border-slate-200"
                            }`}
                          >
                            {isUnpaid && <Clock className="w-3 h-3" />}
                            {isPaid && <CheckCircle2 className="w-3 h-3" />}
                            {isCancelled && <RotateCcw className="w-3 h-3" />}
                            <span>
                              {isUnpaid ? (isOverdue ? "Jatuh Tempo!" : "Belum Lunas") : isPaid ? "Lunas" : "Dibatalkan"}
                            </span>
                          </span>

                          <p className="font-mono text-xs font-semibold text-slate-700">{debt.debtNumber}</p>
                          <p className="text-[10px] text-slate-400">
                            {new Date(debt.createdAt).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </td>

                      {/* Customer Info */}
                      <td className="py-4 px-4 align-top">
                        <div className="space-y-1">
                          <p className="font-bold text-slate-900 text-sm">{debt.customerName}</p>
                          {debt.customerPhone ? (
                            <p className="text-xs text-slate-500 flex items-center gap-1 font-mono">
                              <Phone className="w-3 h-3 text-slate-400" />
                              <span>{debt.customerPhone}</span>
                            </p>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">Tanpa nomor kontak</span>
                          )}
                          {debt.cashier && (
                            <p className="text-[10px] text-slate-400">Kasir: {debt.cashier.name}</p>
                          )}
                        </div>
                      </td>

                      {/* Items */}
                      <td className="py-4 px-4 align-top">
                        <div className="space-y-1.5">
                          {debt.items.map((item) => (
                            <div key={item.id} className="text-xs">
                              <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                                <span>
                                  {item.voucher?.operator} {item.voucher?.nominal}
                                </span>
                                <span className="font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded text-[10px]">
                                  x{item.quantity} pcs
                                </span>
                              </div>
                              <span className="text-[11px] text-slate-400 pl-3">
                                @ {formatRupiah(item.unitPrice)} = {formatRupiah(item.subtotal)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>

                      {/* Total */}
                      <td className="py-4 px-4 align-top text-right">
                        <p className="font-extrabold text-base text-slate-900">
                          {formatRupiah(debt.totalAmount)}
                        </p>
                        {isPaid && debt.paidMethod && (
                          <span className="inline-block mt-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            Metode: {debt.paidMethod}
                          </span>
                        )}
                      </td>

                      {/* Due date & notes */}
                      <td className="py-4 px-4 align-top">
                        <div className="space-y-1 max-w-xs">
                          {debt.dueDate ? (
                            <div
                              className={`flex items-center gap-1 text-xs font-semibold ${
                                isOverdue ? "text-rose-600" : "text-amber-700"
                              }`}
                            >
                              <Calendar className="w-3.5 h-3.5 shrink-0" />
                              <span>
                                {new Date(debt.dueDate).toLocaleDateString("id-ID", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">Tanpa batas waktu</span>
                          )}

                          {debt.notes && (
                            <p className="text-[11px] text-slate-600 bg-slate-50 p-1.5 rounded-lg border border-slate-100 break-words">
                              {debt.notes}
                            </p>
                          )}

                          {isPaid && debt.paidAt && (
                            <p className="text-[10px] text-emerald-600 font-medium">
                              Lunas:{" "}
                              {new Date(debt.paidAt).toLocaleDateString("id-ID", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 align-top text-right">
                        <div className="flex flex-col items-end gap-1.5">
                          {isUnpaid && (
                            <>
                              <button
                                onClick={() => handleOpenPayModal(debt)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-emerald-600/20 transition-all active:scale-95"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Lunasi Bon</span>
                              </button>

                              {debt.customerPhone && (
                                <button
                                  onClick={() => handleWhatsAppReminder(debt)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80 rounded-xl text-xs font-semibold transition-all"
                                  title="Kirim pesan WhatsApp penagihan sopan"
                                >
                                  <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Tagih WA</span>
                                </button>
                              )}

                              <button
                                onClick={() => setDebtToCancel(debt)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-400 hover:text-rose-600 text-[11px] rounded-lg transition-colors"
                                title="Batalkan bon dan kembalikan stok voucher fisik"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Batal / Retur</span>
                              </button>
                            </>
                          )}

                          {isPaid && (
                            <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Selesai</span>
                            </span>
                          )}

                          {isCancelled && (
                            <span className="text-xs text-slate-400 font-medium italic">
                              Stok dikembalikan
                            </span>
                          )}
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

      {/* MODAL 1: CATAT BON PELANGGAN BARU */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 p-6 space-y-4 my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-slate-900 text-lg flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-indigo-600" />
                  <span>Catat Bon / Ambil Voucher (Bayar Nanti)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Stok voucher akan langsung berkurang dan tagihan tersimpan di buku piutang.
                </p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"
              >
                ✕
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmitCreateDebt} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Pelanggan <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Pak Budi / Mas Joko"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    No. HP / WhatsApp (Opsional)
                  </label>
                  <input
                    type="tel"
                    placeholder="081234567890"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
              </div>

              {/* Items Voucher yang Diambil */}
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">
                    Voucher yang Diambil <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAddDebtItemRow}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Voucher Lain</span>
                  </button>
                </div>

                <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                  {debtItems.map((item, idx) => {
                    const currentVoc = vouchers.find((v) => v.id === item.voucherId);
                    return (
                      <div
                        key={idx}
                        className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2 relative"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold text-slate-400">Item #{idx + 1}</span>
                          {debtItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveDebtItemRow(idx)}
                              className="text-slate-400 hover:text-rose-600 text-xs"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div className="col-span-2">
                            <label className="block text-[10px] font-medium text-slate-500 mb-0.5">
                              Pilih Voucher
                            </label>
                            <select
                              value={item.voucherId}
                              onChange={(e) => handleItemChange(idx, "voucherId", e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 font-semibold focus:ring-2 focus:ring-indigo-500"
                            >
                              {vouchers.map((v) => (
                                <option key={v.id} value={v.id} disabled={v.stock <= 0}>
                                  {v.operator} {v.nominal} - {formatRupiah(v.sellingPrice)} (Stok: {v.stock} pcs)
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-medium text-slate-500 mb-0.5">
                              Jumlah (Pcs)
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={currentVoc?.stock || 999}
                              value={item.quantity}
                              onChange={(e) =>
                                handleItemChange(idx, "quantity", Math.max(1, parseInt(e.target.value) || 1))
                              }
                              className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-900 text-center focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                        </div>

                        {currentVoc && (
                          <div className="flex justify-between items-center text-[11px] pt-1 border-t border-slate-200/50">
                            <span className="text-slate-500">
                              Subtotal ({item.quantity} x {formatRupiah(currentVoc.sellingPrice)}):
                            </span>
                            <span className="font-bold text-indigo-700">
                              {formatRupiah(currentVoc.sellingPrice * item.quantity)}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Total Summary */}
              <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-2xl flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Total Nilai Bon:</span>
                <span className="text-lg font-extrabold text-indigo-700">
                  {formatRupiah(modalTotal)}
                </span>
              </div>

              {/* Due Date & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Jatuh Tempo / Janji Bayar
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Catatan Tambahan
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Ambil buat tetangga, nanti sore"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md shadow-indigo-600/25 transition-all disabled:opacity-50 active:scale-95"
                >
                  {loading ? "Menyimpan Bon..." : "Simpan Catatan Bon"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: PELUNASAN BON */}
      {isPayModalOpen && selectedDebtForPay && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>Pelunasan Bon Voucher</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pencatatan pembayaran tagihan oleh pelanggan
                </p>
              </div>
              <button
                onClick={() => setIsPayModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"
              >
                ✕
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 text-xs rounded-xl">
                {errorMessage}
              </div>
            )}

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">No. Bon:</span>
                <span className="font-mono font-bold text-slate-800">{selectedDebtForPay.debtNumber}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Nama Pelanggan:</span>
                <span className="font-bold text-slate-900">{selectedDebtForPay.customerName}</span>
              </div>
              <div className="text-xs border-t border-slate-200/60 pt-2">
                <span className="text-slate-500 block mb-1">Rincian Voucher:</span>
                {selectedDebtForPay.items.map((i) => (
                  <div key={i.id} className="flex justify-between text-[11px] text-slate-700">
                    <span>
                      {i.voucher?.operator} {i.voucher?.nominal} (x{i.quantity})
                    </span>
                    <span className="font-semibold">{formatRupiah(i.subtotal)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center text-sm pt-2 border-t border-slate-200 font-bold">
                <span className="text-slate-900">Total Harus Dibayar:</span>
                <span className="text-emerald-600 text-base font-extrabold">
                  {formatRupiah(selectedDebtForPay.totalAmount)}
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmitPayDebt} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Metode Pembayaran
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "CASH", label: "Tunai (Cash)", icon: Banknote },
                    { id: "TRANSFER", label: "Transfer", icon: CreditCard },
                    { id: "QRIS", label: "QRIS", icon: QrCode },
                  ].map((m) => {
                    const Icon = m.icon;
                    return (
                      <button
                        type="button"
                        key={m.id}
                        onClick={() => setPaidMethod(m.id as any)}
                        className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 text-xs font-bold transition-all ${
                          paidMethod === m.id
                            ? "bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20"
                            : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Catatan Pelunasan (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Misal: Uang pas diterima kasir"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100 text-[11px] text-emerald-800">
                💡 Uang sebesar <strong>{formatRupiah(selectedDebtForPay.totalAmount)}</strong> akan otomatis
                masuk ke omset penjualan hari ini ({paidMethod}).
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPayModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md shadow-emerald-600/20 transition-all active:scale-95 disabled:opacity-50"
                >
                  {loading ? "Memproses..." : "Konfirmasi & Lunasi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: BATALKAN BON & KEMBALIKAN STOK */}
      {debtToCancel && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Batalkan Bon / Retur Voucher</h3>
                <p className="text-xs text-slate-500">Pengembalian voucher fisik yang belum dibayar</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">No. Bon:</span>
                <span className="font-mono font-bold text-slate-800">{debtToCancel.debtNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Pelanggan:</span>
                <span className="font-bold text-slate-900">{debtToCancel.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total:</span>
                <span className="font-bold text-rose-600">{formatRupiah(debtToCancel.totalAmount)}</span>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Apakah pelanggan mengembalikan voucher fisik ini? Jika dibatalkan, status bon akan berubah menjadi
              <strong> Dibatalkan</strong> dan seluruh kuantitas voucher fisik di dalamnya akan otomatis dikembalikan ke etalase toko.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={loading}
                onClick={() => setDebtToCancel(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Tutup
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleSubmitCancelDebt}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-md shadow-rose-600/20 active:scale-95 transition-all disabled:opacity-50"
              >
                {loading ? "Memproses..." : "Ya, Batalkan & Kembalikan Stok"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Receipt,
  ShoppingCart,
  Ticket,
  SmartphoneNfc,
  AlertTriangle,
  Coins,
  ArrowUpRight,
  Package,
  Plus,
  RefreshCw,
  Clock,
  CheckCircle2,
  BarChart3,
  Sparkles,
  Layers,
} from "lucide-react";
import { formatRupiah } from "@/lib/calculations";
import { AuthSession } from "@/types";

interface DashboardClientProps {
  currentUser: AuthSession;
}

export default function DashboardClient({ currentUser }: DashboardClientProps) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const isOwner = currentUser?.role === "OWNER";

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/stats");
      const json = await res.json();
      if (res.ok) {
        setData(json);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const todayStr = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Shortcuts */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-indigo-900/15 flex flex-col md:flex-row md:items-center justify-between gap-6 border border-indigo-700/30">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="inline-block px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-[10px] font-bold tracking-wider uppercase">
              {isOwner ? "👑 Dashboard Eksekutif Owner" : "🛒 Dashboard Operasional Kasir"}
            </span>
            <span className="text-xs text-indigo-200">{todayStr}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Halo, {currentUser.name}!
          </h1>
          <p className="text-indigo-100 text-xs sm:text-sm max-w-xl">
            {isOwner
              ? "Ringkasan eksekutif omzet penjualan, modal HPP, margin keuntungan, beban operasional, dan laba bersih toko."
              : "Ringkasan aktivitas operasional penjualan kasir, mutasi voucher fisik, dan transaksi digital hari ini."}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={fetchStats}
            className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-all"
            title="Muat Ulang Metrik"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <Link
            href="/pos"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white text-indigo-900 font-extrabold text-xs shadow-lg shadow-black/10 hover:bg-indigo-50 active:scale-95 transition-all"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Buka Kasir (POS)</span>
          </Link>
          <Link
            href="/vouchers"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
          >
            <Ticket className="w-4 h-4" />
            <span>Input Sisa Voucher</span>
          </Link>
          {isOwner && (
            <Link
              href="/reports"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-800 text-white font-bold text-xs border border-slate-700 transition-all"
            >
              <BarChart3 className="w-4 h-4" />
              <span>Laba Rugi</span>
            </Link>
          )}
        </div>
      </div>

      {loading || !data ? (
        <div className="py-20 text-center text-slate-400">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs">Menyiapkan metrik dashboard hari ini...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* ========================================================================= */}
          {/* OWNER EXCLUSIVE FINANCIAL KPI CARDS                                      */}
          {/* ========================================================================= */}
          {isOwner ? (
            <>
              {/* PRIMARY FINANCIAL METRICS (OWNER ONLY) */}
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Today's Gross Revenue */}
                <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Total Omzet Hari Ini</span>
                    <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-2">
                    {formatRupiah(data.metrics.todayRevenue)}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">Gabungan POS + Voucher + Digital</p>
                </div>

                {/* 2. Today's Gross Profit */}
                <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Laba Kotor Hari Ini</span>
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                      <Coins className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="text-xl sm:text-2xl font-extrabold text-emerald-600 mt-2">
                    +{formatRupiah(data.metrics.todayGrossProfit)}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">Margin keuntungan seluruh penjualan</p>
                </div>

                {/* 3. Expenses Today */}
                <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Beban Pengeluaran</span>
                    <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                      <Receipt className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="text-xl sm:text-2xl font-extrabold text-rose-600 mt-2">
                    {formatRupiah(data.metrics.todayExpenses)}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">Biaya operasional toko hari ini</p>
                </div>

                {/* 4. Net Profit Today */}
                <div
                  className={`p-5 rounded-3xl border shadow-sm flex flex-col justify-between ${
                    data.metrics.todayNetProfit >= 0
                      ? "bg-gradient-to-br from-indigo-900 to-slate-900 text-white"
                      : "bg-rose-950 text-white"
                  }`}
                >
                  <div className="flex items-center justify-between text-indigo-200">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Laba Bersih Hari Ini</span>
                    <div className="w-8 h-8 rounded-xl bg-white/10 text-white flex items-center justify-center font-bold">
                      <Coins className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="text-xl sm:text-2xl font-extrabold text-white mt-2">
                    {formatRupiah(data.metrics.todayNetProfit)}
                  </p>
                  <p className="text-[10px] text-indigo-200 mt-1">Laba Kotor - Beban Pengeluaran</p>
                </div>
              </div>

              {/* SECONDARY CHANNEL PROFIT BREAKDOWN (OWNER ONLY) */}
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* POS Aksesoris */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                    <ShoppingCart className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium">POS Aksesoris</p>
                    <p className="text-base font-bold text-slate-900">
                      {formatRupiah(data.metrics.todayPosRevenue)}
                    </p>
                    <p className="text-[10px] text-emerald-600 font-semibold">
                      Profit: +{formatRupiah(data.metrics.todayPosProfit)}
                    </p>
                  </div>
                </div>

                {/* Voucher Fisik */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                    <Ticket className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Voucher Fisik</p>
                    <p className="text-base font-bold text-slate-900">
                      {formatRupiah(data.metrics.todayVoucherRevenue)} ({data.metrics.todayVoucherSoldQty} pcs)
                    </p>
                    <p className="text-[10px] text-emerald-600 font-semibold">
                      Profit: +{formatRupiah(data.metrics.todayVoucherProfit)}
                    </p>
                  </div>
                </div>

                {/* Transaksi Digital */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                    <SmartphoneNfc className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Transaksi Digital</p>
                    <p className="text-base font-bold text-slate-900">
                      {formatRupiah(data.metrics.todayDigitalRevenue)} ({data.metrics.digitalSuccess} trx)
                    </p>
                    <p className="text-[10px] text-emerald-600 font-semibold">
                      Profit: +{formatRupiah(data.metrics.todayDigitalProfit)}
                    </p>
                  </div>
                </div>

                {/* Total Stok Fisik Voucher */}
                <Link
                  href="/vouchers"
                  className="bg-white hover:bg-slate-50 p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3 transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Stok Voucher di Etalase</p>
                    <p className="text-base font-bold text-blue-600">
                      {data.metrics.totalVoucherStock} pcs
                    </p>
                    <p className="text-[10px] text-slate-400">Klik untuk kelola stok</p>
                  </div>
                </Link>
              </div>

              {/* 7-Days Revenue & Profit Trend Chart Section (OWNER ONLY) */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">Tren Omzet & Laba 7 Hari Terakhir</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Pergerakan pendapatan kotor dan laba kotor harian
                    </p>
                  </div>
                  <Link
                    href="/analytics"
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                  >
                    <span>Analisis Lengkap</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                {/* Visual Bar Chart */}
                <div className="grid grid-cols-7 gap-2 pt-4 items-end h-48">
                  {data.trend?.map((item: any, i: number) => {
                    const maxVal = Math.max(...data.trend.map((t: any) => t.revenue), 100000);
                    const heightPercent = Math.max(12, Math.round((item.revenue / maxVal) * 100));

                    return (
                      <div key={i} className="flex flex-col items-center gap-2 h-full justify-end group">
                        <div className="text-[10px] font-bold text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          {formatRupiah(item.revenue)}
                        </div>
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className="w-full max-w-[48px] bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-xl transition-all group-hover:from-indigo-500 group-hover:to-indigo-300 relative shadow-sm"
                        />
                        <span className="text-[10px] font-bold text-slate-500">{item.date}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            /* ========================================================================= */
            /* CASHIER OPERATIONAL DASHBOARD (NO FINANCIALS / NO PROFITS / NO MODAL)     */
            /* ========================================================================= */
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {/* Total Transaksi Kasir Hari Ini */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Transaksi Kasir</span>
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                    <ShoppingCart className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl font-extrabold text-indigo-600 mt-2">
                  {data.metrics.todayTransactions}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">Total transaksi belanja hari ini</p>
              </div>

              {/* Aksesoris Terjual */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Aksesoris Terjual</span>
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                    <Package className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl font-extrabold text-slate-900 mt-2">
                  {data.metrics.todayProductSoldQty} unit
                </p>
                <p className="text-[10px] text-slate-400 mt-1">Barang ritel keluar kasir</p>
              </div>

              {/* Voucher Fisik Terjual */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Voucher Terjual</span>
                  <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                    <Ticket className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl font-extrabold text-amber-600 mt-2">
                  {data.metrics.todayVoucherSoldQty} pcs
                </p>
                <p className="text-[10px] text-slate-400 mt-1">Voucher fisik keluar hari ini</p>
              </div>

              {/* Transaksi Digital Sukses */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Digital Sukses</span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                    <SmartphoneNfc className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl font-extrabold text-emerald-600 mt-2">
                  {data.metrics.digitalSuccess} trx
                </p>
                <p className="text-[10px] text-slate-400 mt-1">Pulsa & PLN berhasil diisi</p>
              </div>

              {/* Stok Fisik Voucher Tersedia */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Stok Voucher Fisik</span>
                  <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
                    <Layers className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl font-extrabold text-slate-800 mt-2">
                  {data.metrics.totalVoucherStock} pcs
                </p>
                <p className="text-[10px] text-slate-400 mt-1">Total fisik tersedia di etalase</p>
              </div>
            </div>
          )}

          {/* Live Recent Activities Feed */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Sales POS */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <ShoppingCart className="w-4 h-4 text-indigo-600" />
                  <span>Penjualan Kasir Terbaru</span>
                </span>
                <Link href="/pos" className="text-[10px] font-bold text-indigo-600 hover:underline">
                  Buka Kasir
                </Link>
              </div>

              <div className="space-y-2">
                {data.recentActivities?.sales?.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">Belum ada transaksi POS</p>
                ) : (
                  data.recentActivities.sales.map((s: any) => (
                    <div
                      key={s.id}
                      className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs flex justify-between items-center"
                    >
                      <div>
                        <span className="font-mono font-bold text-slate-800">{s.invoiceNumber}</span>
                        <p className="text-[10px] text-slate-500">{s.cashierName || "Kasir"}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-extrabold text-slate-900">
                          {formatRupiah(s.finalAmount)}
                        </span>
                        <span className="text-[10px] text-slate-400 block font-mono">
                          {s.paymentMethod}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Recent Digital */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <SmartphoneNfc className="w-4 h-4 text-emerald-600" />
                  <span>Transaksi Digital Terbaru</span>
                </span>
                <Link
                  href="/digital"
                  className="text-[10px] font-bold text-emerald-600 hover:underline"
                >
                  Buka Digital
                </Link>
              </div>

              <div className="space-y-2">
                {data.recentActivities?.digital?.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">Belum ada transaksi</p>
                ) : (
                  data.recentActivities.digital.map((d: any) => (
                    <div
                      key={d.id}
                      className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs flex justify-between items-center"
                    >
                      <div>
                        <span className="font-bold text-slate-800">{d.digitalProduct?.name}</span>
                        <p className="text-[10px] font-mono text-indigo-600">{d.destinationNumber}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-extrabold text-slate-900">
                          {formatRupiah(d.sellingPrice)}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full block ${
                            d.status === "SUCCESS"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {d.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Recent Voucher Movements */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Ticket className="w-4 h-4 text-amber-600" />
                  <span>Mutasi Voucher Fisik</span>
                </span>
                <Link
                  href="/vouchers"
                  className="text-[10px] font-bold text-amber-600 hover:underline"
                >
                  Kelola Voucher
                </Link>
              </div>

              <div className="space-y-2">
                {data.recentActivities?.voucherMovements?.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">Belum ada mutasi voucher</p>
                ) : (
                  data.recentActivities.voucherMovements.map((vm: any) => (
                    <div
                      key={vm.id}
                      className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs flex justify-between items-center"
                    >
                      <div>
                        <span className="font-bold text-slate-800">
                          {vm.voucher ? `${vm.voucher.operator} ${vm.voucher.nominal}` : "Voucher"}
                        </span>
                        <p className="text-[10px] text-slate-400">{vm.notes || vm.type}</p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`font-mono font-bold ${
                            vm.type === "STOCK_IN"
                              ? "text-emerald-600"
                              : vm.type === "SOLD"
                              ? "text-blue-600"
                              : "text-slate-700"
                          }`}
                        >
                          {vm.quantity > 0 ? `+${vm.quantity}` : vm.quantity} pcs
                        </span>
                        <span className="text-[9px] text-slate-400 block font-mono">
                          Stok: {vm.newStock}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

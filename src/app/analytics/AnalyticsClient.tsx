"use client";

import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  BarChart3,
  PieChart,
  Coins,
  ShoppingCart,
  Ticket,
  SmartphoneNfc,
  Receipt,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  AlertTriangle,
  Lightbulb,
  Award,
  Layers,
  Percent,
} from "lucide-react";
import { formatRupiah } from "@/lib/calculations";

export default function AnalyticsClient() {
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async (selectedDays: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics?days=${selectedDays}`);
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
    fetchAnalytics(days);
  }, [days]);

  return (
    <div className="space-y-6">
      {/* Header & Range Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <TrendingUp className="w-6 h-6 text-indigo-600" />
            <span>Analisis Bisnis & Profitabilitas</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Intelijensi performa penjualan ritel, efisiensi operasional, profit share, dan tren pertumbuhan ChiCha Mobile
          </p>
        </div>

        {/* Range Selector */}
        <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-slate-200/80 shadow-sm">
          {[
            { label: "7 Hari", val: 7 },
            { label: "14 Hari", val: 14 },
            { label: "30 Hari", val: 30 },
            { label: "90 Hari (3 Bulan)", val: 90 },
          ].map((item) => (
            <button
              key={item.val}
              onClick={() => setDays(item.val)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                days === item.val
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {loading || !data ? (
        <div className="py-24 text-center text-slate-400">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs">Menghitung analisis bisnis & data profitabilitas...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* TOP EXECUTIVE METRIC CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Overall Gross Margin */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-bold uppercase tracking-wider">Gross Profit Margin</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <Percent className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-extrabold text-emerald-600 mt-2">
                {data.summary.overallGrossMargin}%
              </p>
              <p className="text-[10px] text-slate-400 mt-1">
                Laba Kotor: +{formatRupiah(data.summary.totalGrossProfit)}
              </p>
            </div>

            {/* Net Profit Margin */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-bold uppercase tracking-wider">Net Profit Margin</span>
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Sparkles className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-extrabold text-indigo-600 mt-2">
                {data.summary.netMargin}%
              </p>
              <p className="text-[10px] text-slate-400 mt-1">
                Laba Bersih: {formatRupiah(data.summary.netProfit)}
              </p>
            </div>

            {/* Average Order Value */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-bold uppercase tracking-wider">Rata-rata Transaksi (AOV)</span>
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <ShoppingCart className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-extrabold text-slate-900 mt-2">
                {formatRupiah(data.summary.averageOrderValue)}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">
                Total {data.summary.totalTrxCount} transaksi belanja
              </p>
            </div>

            {/* Expense Efficiency Ratio */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-bold uppercase tracking-wider">Rasio Beban Operasional</span>
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-extrabold text-purple-600 mt-2">
                {data.summary.expenseToProfitRatio}%
              </p>
              <p className="text-[10px] text-slate-400 mt-1">
                Total Beban: {formatRupiah(data.summary.totalExpenses)}
              </p>
            </div>
          </div>

          {/* SMART BUSINESS INSIGHTS SECTION */}
          <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl p-6 text-white shadow-xl shadow-indigo-900/15 border border-indigo-700/40 space-y-4">
            <div className="flex items-center gap-2 border-b border-indigo-700/50 pb-3">
              <Lightbulb className="w-5 h-5 text-amber-400" />
              <h3 className="font-extrabold text-base tracking-tight text-white">
                Rangkuman Intelijensi & Rekomendasi Bisnis
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.insights?.map((ins: any, i: number) => (
                <div
                  key={i}
                  className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 space-y-1"
                >
                  <p className="font-bold text-xs text-indigo-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>{ins.title}</span>
                  </p>
                  <p className="text-xs text-slate-100 leading-relaxed">{ins.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CHANNEL PROFITABILITY COMPARISON MATRIX */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-5">
            <div>
              <h3 className="text-lg font-extrabold text-slate-900">
                Matriks Komparasi Profitabilitas per Channel
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Perbandingan margin, perputaran omzet, modal, dan persentase kontribusi laba
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {data.channelComparison?.map((c: any, i: number) => {
                const isTopProfit = i === 0;
                return (
                  <div
                    key={c.channel}
                    className={`rounded-2xl p-5 border transition-all ${
                      isTopProfit
                        ? "bg-indigo-50/40 border-indigo-200 ring-2 ring-indigo-400/20"
                        : "bg-slate-50/70 border-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-slate-900 text-sm">{c.channel}</span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                        Margin: {c.margin}%
                      </span>
                    </div>

                    <div className="mt-4 space-y-2 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span>Total Omzet:</span>
                        <span className="font-bold text-slate-900">{formatRupiah(c.revenue)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Total Modal HPP:</span>
                        <span className="font-semibold text-slate-700">{formatRupiah(c.cost)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Laba Bersih Channel:</span>
                        <span className="font-extrabold text-emerald-600">+{formatRupiah(c.profit)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Volume Penjualan:</span>
                        <span className="font-semibold text-slate-800">
                          {c.volume} {c.unit}
                        </span>
                      </div>
                    </div>

                    {/* Profit Contribution Bar */}
                    <div className="mt-4 pt-3 border-t border-slate-200/80">
                      <div className="flex justify-between text-[11px] font-bold mb-1">
                        <span className="text-slate-500">Pangsa Laba Toko:</span>
                        <span className="text-indigo-600">{c.profitShare}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${Math.min(100, Math.max(5, c.profitShare))}%` }}
                          className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 rounded-full"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* HISTORICAL TREND CHART */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  Dinamika Tren Omzet vs Laba Kotor
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Grafik pergerakan harian dalam periode {days} hari terakhir
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs font-semibold text-slate-600">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-indigo-600" />
                  Omzet Penjualan
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-500" />
                  Laba Kotor
                </span>
              </div>
            </div>

            {/* Visual Bar Chart */}
            <div className="grid grid-cols-7 sm:grid-cols-14 gap-2 pt-6 items-end h-56 overflow-x-auto">
              {data.trendData?.map((item: any, i: number) => {
                const maxVal = Math.max(...data.trendData.map((t: any) => t.revenue), 100000);
                const revHeight = Math.max(8, Math.round((item.revenue / maxVal) * 100));
                const profHeight = Math.max(6, Math.round((item.profit / maxVal) * 100));

                return (
                  <div key={i} className="flex flex-col items-center gap-1.5 h-full justify-end group min-w-[32px]">
                    <div className="text-[9px] font-bold text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      {formatRupiah(item.revenue)}
                    </div>
                    <div className="flex items-end gap-1 w-full justify-center">
                      <div
                        style={{ height: `${revHeight}%` }}
                        className="w-3 bg-indigo-600 rounded-t-md transition-all group-hover:bg-indigo-500"
                        title={`Omzet: ${formatRupiah(item.revenue)}`}
                      />
                      <div
                        style={{ height: `${profHeight}%` }}
                        className="w-3 bg-emerald-500 rounded-t-md transition-all group-hover:bg-emerald-400"
                        title={`Laba: ${formatRupiah(item.profit)}`}
                      />
                    </div>
                    <span className="text-[9px] font-bold text-slate-400 whitespace-nowrap">
                      {item.date}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* BEST SELLERS & OPERATOR SHARE BREAKDOWN */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Products Aksesoris */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-500" />
                  <span>Produk Aksesoris Paling Menguntungkan</span>
                </span>
              </div>
              <div className="space-y-3">
                {data.topProducts?.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">Belum ada data penjualan</p>
                ) : (
                  data.topProducts.map((p: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 font-extrabold flex items-center justify-center text-xs">
                          {idx + 1}
                        </span>
                        <div>
                          <p className="font-bold text-slate-900">{p.name}</p>
                          <p className="text-slate-400 text-[10px]">{p.qty} unit terjual</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-extrabold text-emerald-600 block">
                          +{formatRupiah(p.profit)}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Omzet: {formatRupiah(p.revenue)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Operator Share for Vouchers */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                  <Ticket className="w-4 h-4 text-indigo-600" />
                  <span>Dominasi Operator Voucher Fisik</span>
                </span>
              </div>
              <div className="space-y-3">
                {data.operatorShares?.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">Belum ada data voucher</p>
                ) : (
                  data.operatorShares.map((op: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-slate-900 text-xs">{op.operator}</span>
                        <p className="text-slate-400 text-[10px]">{op.qty} pcs terjual</p>
                      </div>
                      <div className="text-right">
                        <span className="font-extrabold text-slate-900 block">
                          {formatRupiah(op.revenue)}
                        </span>
                        <span className="text-[10px] text-emerald-600 font-bold">
                          Laba: +{formatRupiah(op.profit)}
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

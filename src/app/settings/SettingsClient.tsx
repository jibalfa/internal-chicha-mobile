"use client";

import React, { useState } from "react";
import {
  Store,
  MapPin,
  Phone,
  Printer,
  FileText,
  Copy,
  CheckCircle2,
  AlertCircle,
  Save,
  RotateCcw,
  Sparkles,
  Layers,
  Settings2,
} from "lucide-react";
import {
  printerManager,
  buildSaleReceiptBuffer,
  PrintSaleData,
} from "@/lib/bluetoothPrinter";

interface StoreSettingData {
  id: string;
  name: string;
  tagline?: string | null;
  address?: string | null;
  phone?: string | null;
  receiptFooter?: string | null;
  printCopies: number;
  paperWidth: "58mm" | "80mm" | string;
  autoPrint: boolean;
}

interface SettingsClientProps {
  initialSetting: StoreSettingData;
}

export function SettingsClient({ initialSetting }: SettingsClientProps) {
  const [form, setForm] = useState<StoreSettingData>(initialSetting);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [testPrinting, setTestPrinting] = useState(false);
  const [testPrintFeedback, setTestPrintFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Handle save settings
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menyimpan pengaturan toko");
      }

      setForm(data.setting);
      setSuccessMessage("Pengaturan toko dan format struk berhasil disimpan!");

      // Update local storage cache for POS printer receipt header
      if (typeof window !== "undefined") {
        localStorage.setItem("chicha_store_name", data.setting.name);
        localStorage.setItem("chicha_store_address", data.setting.address || "");
        localStorage.setItem("chicha_store_phone", data.setting.phone || "");
        localStorage.setItem("chicha_store_tagline", data.setting.tagline || "");
        localStorage.setItem("chicha_store_footer", data.setting.receiptFooter || "");
        localStorage.setItem("chicha_print_copies", String(data.setting.printCopies));
        localStorage.setItem("chicha_paper_width", data.setting.paperWidth);
      }

      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle test print with custom store settings
  const handleTestPrintLive = async () => {
    setTestPrinting(true);
    setTestPrintFeedback(null);

    try {
      const sampleSale: PrintSaleData = {
        invoiceNumber: "INV-PREVIEW-001",
        createdAt: new Date(),
        cashierName: "Kasir Bertugas",
        paymentMethod: "TUNAI",
        totalAmount: 75000,
        discount: 5000,
        finalAmount: 70000,
        cashGiven: 100000,
        changeGiven: 30000,
        items: [
          { itemName: "Kabel Data Type-C 65W", quantity: 1, unitPrice: 35000, subtotal: 35000 },
          { itemName: "Voucher Data Telkomsel 5GB", quantity: 1, unitPrice: 40000, subtotal: 40000 },
        ],
      };

      const buffer = buildSaleReceiptBuffer(
        sampleSale,
        (form.paperWidth as "58mm" | "80mm") || "58mm",
        form
      );

      const copies = form.printCopies || 1;
      for (let i = 0; i < copies; i++) {
        const res = await printerManager.print(buffer);
        if (!res.success) {
          throw new Error(res.error || "Printer belum terhubung");
        }
      }

      setTestPrintFeedback({
        type: "success",
        text: `Test struk (${copies}x rangkap) berhasil dicetak ke printer!`,
      });
      setTimeout(() => setTestPrintFeedback(null), 4000);
    } catch (err: any) {
      setTestPrintFeedback({
        type: "error",
        text: err.message || "Pastikan printer sudah terhubung.",
      });
    } finally {
      setTestPrinting(false);
    }
  };

  return (
    <div className="space-y-6 pb-16 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-inner">
            <Settings2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Pengaturan Toko & Struk
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Sesuaikan nama toko, alamat, kontak WhatsApp, dan format cetak struk kasir.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={handleTestPrintLive}
            disabled={testPrinting}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>{testPrinting ? "Mencetak..." : "Test Cetak Struk"}</span>
          </button>
        </div>
      </div>

      {/* Alert Banners */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-xs font-semibold animate-in fade-in shadow-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-xs font-semibold animate-in fade-in shadow-sm">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {testPrintFeedback && (
        <div
          className={`p-3 rounded-2xl text-xs font-semibold flex items-center gap-2.5 ${
            testPrintFeedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-amber-50 text-amber-800 border border-amber-200"
          }`}
        >
          {testPrintFeedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          )}
          <span>{testPrintFeedback.text}</span>
        </div>
      )}

      {/* Main 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: SETTINGS FORM (7 cols) */}
        <form onSubmit={handleSave} className="lg:col-span-7 space-y-6">
          {/* CARD 1: IDENTITAS TOKO */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Store className="w-5 h-5 text-indigo-600" />
              <h2 className="font-extrabold text-slate-900 text-base">Identitas & Informasi Toko</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Nama Toko <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Contoh: CHICHA MOBILE"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Nama ini akan dicetak besar pada bagian paling atas struk belanja.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Slogan / Tagline Toko (Opsional)
                </label>
                <input
                  type="text"
                  value={form.tagline || ""}
                  onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                  placeholder="Contoh: Pusat Aksesoris, Pulsa & Servis HP"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>No. HP / WhatsApp</span>
                  </label>
                  <input
                    type="text"
                    value={form.phone || ""}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="Contoh: 0812-3456-7890"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-mono text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>Alamat Toko</span>
                  </label>
                  <input
                    type="text"
                    value={form.address || ""}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="Contoh: Jl. Raya Barat No. 45"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* CARD 2: PENGATURAN STRUK & PRINTER */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Printer className="w-5 h-5 text-indigo-600" />
              <h2 className="font-extrabold text-slate-900 text-base">Format Cetak Struk</h2>
            </div>

            <div className="space-y-4">
              {/* JUMLAH RANGKAP CETAK */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Copy className="w-4 h-4 text-slate-400" />
                    <span>Jumlah Rangkap Struk yang Dicetak</span>
                  </span>
                  <span className="text-indigo-600 font-extrabold">{form.printCopies}x Struk</span>
                </label>

                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setForm({ ...form, printCopies: num })}
                      className={`py-2.5 px-3 rounded-2xl text-xs font-bold border transition-all text-center ${
                        form.printCopies === num
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20"
                          : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {num === 1 && "1x (Hanya Pelanggan)"}
                      {num === 2 && "2x (Pelanggan + Kasir)"}
                      {num === 3 && "3x Rangkap"}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Saat menekan tombol cetak di kasir POS, printer akan otomatis mencetak sebanyak rangkap ini.
                </p>
              </div>

              {/* UKURAN KERTAS */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Ukuran Kertas Thermal Default
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, paperWidth: "58mm" })}
                    className={`py-2.5 px-3 rounded-2xl text-xs font-bold border transition-all text-center ${
                      form.paperWidth === "58mm"
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    58mm (Printer Mini / Portabel)
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, paperWidth: "80mm" })}
                    className={`py-2.5 px-3 rounded-2xl text-xs font-bold border transition-all text-center ${
                      form.paperWidth === "80mm"
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    80mm (Printer Thermal Besar)
                  </button>
                </div>
              </div>

              {/* PESAN FOOTER STRUK */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span>Pesan / Catatan Kaki Struk (Footer)</span>
                </label>
                <textarea
                  rows={2}
                  value={form.receiptFooter || ""}
                  onChange={(e) => setForm({ ...form, receiptFooter: e.target.value })}
                  placeholder="Contoh: Barang yang sudah dibeli tidak dapat ditukar/dikembalikan. Terima kasih atas kunjungan Anda!"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* SUBMIT BUTTON */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-indigo-600/25 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{loading ? "Menyimpan..." : "Simpan Pengaturan Toko"}</span>
            </button>
          </div>
        </form>

        {/* RIGHT COLUMN: LIVE STRUK THERMAL PREVIEW (5 cols) */}
        <div className="lg:col-span-5 space-y-4 sticky top-20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Preview Tampilan Struk Kasir</span>
            </span>
            <span className="text-[10px] font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
              {form.paperWidth || "58mm"} • {form.printCopies || 1}x Rangkap
            </span>
          </div>

          {/* Thermal Paper Simulation Card */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50 space-y-3 font-mono text-xs text-slate-800">
            {/* Header */}
            <div className="text-center space-y-1 pb-3 border-b-2 border-dashed border-slate-300">
              <h3 className="font-extrabold text-lg text-slate-900 tracking-tight">
                {form.name || "NAMA TOKO"}
              </h3>
              {form.tagline && <p className="text-[11px] text-slate-600">{form.tagline}</p>}
              {form.address && <p className="text-[10px] text-slate-500">{form.address}</p>}
              {form.phone && <p className="text-[10px] text-slate-500 font-bold">WA: {form.phone}</p>}
            </div>

            {/* Transaction metadata */}
            <div className="space-y-0.5 text-[11px] text-slate-600 pt-1">
              <div className="flex justify-between">
                <span>No. Faktur:</span>
                <span className="font-bold text-slate-800">INV-20261006-0042</span>
              </div>
              <div className="flex justify-between">
                <span>Waktu:</span>
                <span>{new Date().toLocaleDateString("id-ID")} {new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              <div className="flex justify-between">
                <span>Kasir:</span>
                <span>Kasir Bertugas</span>
              </div>
              <div className="flex justify-between">
                <span>Pelanggan:</span>
                <span>Pelanggan Umum</span>
              </div>
            </div>

            {/* Sample items table */}
            <div className="py-2.5 border-y-2 border-dashed border-slate-300 space-y-1.5 text-xs">
              <div>
                <p className="font-bold text-slate-900">Kabel Data Type-C 65W</p>
                <div className="flex justify-between text-[11px] text-slate-600">
                  <span>  1 x 35.000</span>
                  <span className="font-bold text-slate-900">35.000</span>
                </div>
              </div>
              <div>
                <p className="font-bold text-slate-900">Voucher Telkomsel 5GB</p>
                <div className="flex justify-between text-[11px] text-slate-600">
                  <span>  1 x 40.000</span>
                  <span className="font-bold text-slate-900">40.000</span>
                </div>
              </div>
            </div>

            {/* Totals */}
            <div className="space-y-1 text-xs pt-1">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span>75.000</span>
              </div>
              <div className="flex justify-between text-rose-600">
                <span>Diskon:</span>
                <span>-5.000</span>
              </div>
              <div className="flex justify-between font-extrabold text-sm text-slate-900 pt-1.5 border-t border-slate-200">
                <span>TOTAL BAYAR:</span>
                <span>Rp 70.000</span>
              </div>
              <div className="flex justify-between text-slate-600 text-[11px]">
                <span>Metode: TUNAI</span>
                <span>Bayar: 100.000</span>
              </div>
              <div className="flex justify-between font-bold text-emerald-700 text-xs">
                <span>Kembalian:</span>
                <span>Rp 30.000</span>
              </div>
            </div>

            {/* Footer Note */}
            <div className="text-center pt-3 text-[11px] text-slate-600 leading-tight border-t-2 border-dashed border-slate-300">
              <p className="font-bold text-slate-900 mb-1">TERIMA KASIH</p>
              <p>{form.receiptFooter || "Barang yang dibeli tidak dapat ditukar/dikembalikan."}</p>
            </div>
          </div>

          <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-2xl flex items-center justify-between text-xs text-indigo-900">
            <span className="font-semibold">Jumlah Rangkap Struk:</span>
            <span className="font-extrabold bg-white px-2.5 py-1 rounded-xl shadow-sm border border-indigo-200">
              {form.printCopies || 1}x Rangkap Cetak
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsClient;


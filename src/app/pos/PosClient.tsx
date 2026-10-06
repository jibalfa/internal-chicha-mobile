"use client";

import React, { useState, useEffect } from "react";
import {
  ShoppingCart,
  Search,
  Plus,
  Minus,
  Trash2,
  User,
  CreditCard,
  Banknote,
  QrCode,
  CheckCircle2,
  Printer,
  X,
  Package,
  Ticket,
  AlertCircle,
  Bluetooth,
  RefreshCw,
  Settings2,
  Radio,
  Cable,
  Sparkles,
  HelpCircle,
} from "lucide-react";
import { formatRupiah } from "@/lib/calculations";
import {
  printerManager,
  buildSaleReceiptBuffer,
  PrintSaleData,
  PrinterConnectionType,
} from "@/lib/bluetoothPrinter";

interface Product {
  id: string;
  sku: string;
  name: string;
  brand: string | null;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  type: string;
  category: { id: string; name: string };
}

interface Voucher {
  id: string;
  operator: string;
  nominal: string;
  costPrice: number;
  sellingPrice: number;
  stock: number;
}

interface CartItem {
  id: string;
  itemType: "PRODUCT" | "VOUCHER";
  productId?: string | null;
  voucherId?: string | null;
  itemName: string;
  costPrice: number;
  unitPrice: number;
  quantity: number;
  maxStock: number;
}

interface StoreSettingState {
  id?: string;
  name: string;
  tagline?: string | null;
  address?: string | null;
  phone?: string | null;
  receiptFooter?: string | null;
  printCopies: number;
  paperWidth: "58mm" | "80mm" | string;
  autoPrint: boolean;
}

interface PosClientProps {
  initialProducts: Product[];
  initialVouchers: Voucher[];
  cashierName: string;
  initialStoreSetting?: StoreSettingState | null;
}

export default function PosClient({
  initialProducts,
  initialVouchers,
  cashierName,
  initialStoreSetting,
}: PosClientProps) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [vouchers, setVouchers] = useState<Voucher[]>(initialVouchers);

  // Store Setting State
  const [storeSetting, setStoreSetting] = useState<StoreSettingState>(() => {
    if (initialStoreSetting) return initialStoreSetting;
    if (typeof window !== "undefined") {
      return {
        name: localStorage.getItem("chicha_store_name") || "CHICHA MOBILE",
        tagline: localStorage.getItem("chicha_store_tagline") || "Pusat Aksesoris & Pulsa",
        address: localStorage.getItem("chicha_store_address") || "Jl. Toko ChiCha Mobile",
        phone: localStorage.getItem("chicha_store_phone") || "0812-3456-7890",
        receiptFooter: localStorage.getItem("chicha_store_footer") || "Barang yang dibeli tidak dapat ditukar/dikembalikan.\nTerima kasih atas kunjungan Anda!",
        printCopies: parseInt(localStorage.getItem("chicha_print_copies") || "1", 10) || 1,
        paperWidth: (localStorage.getItem("chicha_paper_width") as "58mm" | "80mm") || "58mm",
        autoPrint: false,
      };
    }
    return {
      name: "CHICHA MOBILE",
      tagline: "Pusat Aksesoris & Pulsa",
      address: "Jl. Toko ChiCha Mobile",
      phone: "0812-3456-7890",
      receiptFooter: "Barang yang dibeli tidak dapat ditukar/dikembalikan.\nTerima kasih atas kunjungan Anda!",
      printCopies: 1,
      paperWidth: "58mm",
      autoPrint: false,
    };
  });

  // Filter State
  const [activeCatalog, setActiveCatalog] = useState<"ALL" | "PRODUCTS" | "VOUCHERS">("ALL");
  const [search, setSearch] = useState("");

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "TRANSFER" | "QRIS">("CASH");
  const [cashGiven, setCashGiven] = useState<number>(0);

  // Checkout Status & Receipt Modal
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [completedSale, setCompletedSale] = useState<any | null>(null);

  // Universal Thermal Printer State
  const [printerConnected, setPrinterConnected] = useState<boolean>(false);
  const [printerName, setPrinterName] = useState<string | null>(null);
  const [printerConnectionType, setPrinterConnectionType] = useState<PrinterConnectionType>("NONE");
  const [printerConnecting, setPrinterConnecting] = useState<boolean>(false);
  const [printerError, setPrinterError] = useState<string | null>(null);
  const [printerPrinting, setPrinterPrinting] = useState<boolean>(false);
  const [printFeedback, setPrintFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [paperWidth, setPaperWidth] = useState<"58mm" | "80mm">((storeSetting.paperWidth as any) === "80mm" ? "80mm" : "58mm");
  const [isPrinterModalOpen, setIsPrinterModalOpen] = useState<boolean>(false);

  // Auto-connect to previously paired printer on mount (CUKUP SEKALI)
  useEffect(() => {
    printerManager.tryAutoConnect().then((res) => {
      if (res.success) {
        setPrinterConnected(true);
        setPrinterName(res.deviceName || "Printer Thermal");
        setPrinterConnectionType(res.type || "SERIAL");
      } else {
        const saved = printerManager.getSavedPrinterInfo();
        if (saved) {
          setPrinterName(saved.name);
          setPrinterConnectionType(saved.type);
        }
      }
    });
  }, []);

  // Connect via Web Serial (Bluetooth Outgoing COM / USB) - Recommended for Windows
  const handleConnectSerial = async () => {
    setPrinterConnecting(true);
    setPrinterError(null);
    setPrintFeedback(null);

    const res = await printerManager.connectSerial();
    setPrinterConnecting(false);

    if (res.success) {
      setPrinterConnected(true);
      setPrinterName(res.deviceName || "Bluetooth / Serial Printer");
      setPrinterConnectionType("SERIAL");
      setPrintFeedback({ type: "success", text: `Terhubung ke ${res.deviceName || "Printer"}` });
      setIsPrinterModalOpen(false);
      setTimeout(() => setPrintFeedback(null), 4000);
    } else {
      setPrinterError(res.error || "Gagal menghubungkan port printer");
    }
  };

  // Connect via Web Bluetooth BLE (Mobile / BLE)
  const handleConnectBluetoothBLE = async () => {
    setPrinterConnecting(true);
    setPrinterError(null);
    setPrintFeedback(null);

    const res = await printerManager.connectBluetooth();
    setPrinterConnecting(false);

    if (res.success) {
      setPrinterConnected(true);
      setPrinterName(res.deviceName || "Bluetooth BLE Printer");
      setPrinterConnectionType("BLUETOOTH");
      setPrintFeedback({ type: "success", text: `Terhubung ke ${res.deviceName || "Printer"}` });
      setIsPrinterModalOpen(false);
      setTimeout(() => setPrintFeedback(null), 4000);
    } else {
      setPrinterError(res.error || "Gagal menghubungkan Bluetooth");
    }
  };

  const handleDisconnectPrinter = async () => {
    await printerManager.disconnect();
    setPrinterConnected(false);
    setPrinterConnectionType("NONE");
    setPrintFeedback(null);
  };

  const handleTestPrint = async () => {
    setPrinterPrinting(true);
    setPrintFeedback(null);
    const res = await printerManager.printTest();
    setPrinterPrinting(false);

    if (res.success) {
      setPrintFeedback({ type: "success", text: "Test print berhasil dikirim ke printer!" });
      setTimeout(() => setPrintFeedback(null), 4000);
    } else {
      setPrintFeedback({ type: "error", text: res.error || "Test print gagal" });
    }
  };

  // Direct 1-Click Thermal Receipt Print with Custom Settings & Multi-Copies
  const handlePrintReceiptThermal = async (sale: any) => {
    if (!sale) return;

    if (!printerManager.isConnected()) {
      setIsPrinterModalOpen(true);
      return;
    }

    setPrinterPrinting(true);
    setPrintFeedback(null);

    try {
      const printData: PrintSaleData = {
        invoiceNumber: sale.invoiceNumber,
        createdAt: sale.createdAt,
        cashierName: sale.cashier?.name || cashierName,
        paymentMethod: sale.paymentMethod,
        totalAmount: sale.totalAmount,
        discount: sale.discount,
        finalAmount: sale.finalAmount,
        cashGiven: sale.cashGiven,
        changeGiven: sale.changeGiven,
        items: (sale.items || []).map((it: any) => ({
          itemName: it.itemName,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          subtotal: it.subtotal,
        })),
      };

      const buffer = buildSaleReceiptBuffer(printData, paperWidth, storeSetting);
      const copies = storeSetting.printCopies || 1;

      for (let i = 0; i < copies; i++) {
        const res = await printerManager.print(buffer);
        if (!res.success) {
          throw new Error(res.error || "Gagal mengirim data cetak ke printer.");
        }
      }

      setPrinterConnected(true);
      setPrintFeedback({
        type: "success",
        text: `Struk ${copies > 1 ? `(${copies}x rangkap) ` : ""}berhasil dicetak ke printer thermal!`,
      });
      setTimeout(() => setPrintFeedback(null), 5000);
    } catch (err: any) {
      setPrintFeedback({ type: "error", text: err.message || "Gagal memproses struk." });
    } finally {
      setPrinterPrinting(false);
    }
  };

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const finalTotal = Math.max(0, subtotal - discount);
  const changeGiven = paymentMethod === "CASH" ? Math.max(0, cashGiven - finalTotal) : 0;

  // Add Product to Cart
  const addProductToCart = (p: Product) => {
    if (p.stock <= 0) return;
    const existing = cart.find((item) => item.productId === p.id);

    if (existing) {
      if (existing.quantity >= p.stock) return;
      setCart(
        cart.map((item) =>
          item.productId === p.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      );
    } else {
      setCart([
        ...cart,
        {
          id: `prod-${p.id}`,
          itemType: "PRODUCT",
          productId: p.id,
          itemName: p.name,
          costPrice: p.costPrice,
          unitPrice: p.sellingPrice,
          quantity: 1,
          maxStock: p.stock,
        },
      ]);
    }
  };

  // Add Voucher to Cart
  const addVoucherToCart = (v: Voucher) => {
    if (v.stock <= 0) return;
    const existing = cart.find((item) => item.voucherId === v.id);

    if (existing) {
      if (existing.quantity >= v.stock) return;
      setCart(
        cart.map((item) =>
          item.voucherId === v.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      );
    } else {
      setCart([
        ...cart,
        {
          id: `vouch-${v.id}`,
          itemType: "VOUCHER",
          voucherId: v.id,
          itemName: `Voucher ${v.operator} ${v.nominal}`,
          costPrice: v.costPrice,
          unitPrice: v.sellingPrice,
          quantity: 1,
          maxStock: v.stock,
        },
      ]);
    }
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(
      cart
        .map((item) => {
          if (item.id === id) {
            const nextQty = item.quantity + delta;
            if (nextQty > item.maxStock) return item;
            return { ...item, quantity: nextQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter((item) => item.id !== id));
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (paymentMethod === "CASH" && cashGiven < finalTotal) {
      setErrorMessage(
        `Uang tunai pembayaran (${formatRupiah(cashGiven)}) kurang dari total tagihan (${formatRupiah(
          finalTotal
        )})`
      );
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((i) => ({
            itemType: i.itemType,
            productId: i.productId || null,
            voucherId: i.voucherId || null,
            itemName: i.itemName,
            quantity: i.quantity,
            costPrice: i.costPrice,
            unitPrice: i.unitPrice,
          })),
          discount: Number(discount || 0),
          paymentMethod,
          cashGiven: paymentMethod === "CASH" ? Number(cashGiven) : finalTotal,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memproses transaksi");

      // Update local product and voucher stock state
      setProducts(
        products.map((p) => {
          const bought = cart.find((i) => i.productId === p.id);
          if (bought) return { ...p, stock: p.stock - bought.quantity };
          return p;
        })
      );
      setVouchers(
        vouchers.map((v) => {
          const bought = cart.find((i) => i.voucherId === v.id);
          if (bought) return { ...v, stock: v.stock - bought.quantity };
          return v;
        })
      );

      // Display receipt modal & reset cart
      setCompletedSale(data.sale);
      setCart([]);
      setDiscount(0);
      setCashGiven(0);

      // Auto-print if Printer is already connected
      if (printerManager.isConnected()) {
        setTimeout(() => {
          handlePrintReceiptThermal(data.sale);
        }, 300);
      }
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Filter Catalog
  const filteredProducts = products.filter(
    (p) =>
      p.stock > 0 &&
      (p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase()) ||
        (p.brand && p.brand.toLowerCase().includes(search.toLowerCase())))
  );

  const filteredVouchers = vouchers.filter(
    (v) =>
      v.stock > 0 &&
      (v.operator.toLowerCase().includes(search.toLowerCase()) ||
        v.nominal.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      {/* Top POS Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-indigo-600" />
            <span>Kasir Penjualan (POS)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Kasir Bertugas: <span className="font-semibold text-slate-800">{cashierName}</span>
          </p>
        </div>

        {/* Printer Status Widget in Header */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {printerConnected ? (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3.5 py-1.5 rounded-xl text-xs text-emerald-800 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {printerConnectionType === "SERIAL" ? (
                <Cable className="w-4 h-4 text-emerald-600" />
              ) : (
                <Bluetooth className="w-4 h-4 text-emerald-600" />
              )}
              <div className="flex flex-col">
                <span className="font-extrabold text-[11px] leading-tight text-emerald-900">
                  {printerName || "Printer Thermal"}
                </span>
                <span className="text-[10px] text-emerald-600 font-medium">Siap Cetak Struk</span>
              </div>
              <button
                type="button"
                onClick={handleTestPrint}
                disabled={printerPrinting}
                title="Test Cetak Struk"
                className="ml-2 px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold transition-colors"
              >
                {printerPrinting ? "..." : "Test"}
              </button>
              <button
                type="button"
                onClick={handleDisconnectPrinter}
                title="Putuskan koneksi printer"
                className="text-slate-400 hover:text-rose-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsPrinterModalOpen(true)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-[0.98]"
            >
              <Printer className="w-4 h-4 text-indigo-600" />
              <span>
                {printerName ? `Sambungkan (${printerName})` : "Hubungkan Printer Thermal"}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Printer Error Banner if any */}
      {printerError && (
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-2xl flex items-start justify-between gap-2 animate-in fade-in">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-900">Koneksi Printer:</p>
              <p className="text-amber-800 text-[11px] mt-0.5">{printerError}</p>
            </div>
          </div>
          <button
            onClick={() => setPrinterError(null)}
            className="text-amber-600 hover:text-amber-800 text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Grid: Catalog Browser (Left) vs Cart (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: CATALOG BROWSER */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">
          {/* Search & Tabs */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              {/* Tabs */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
                <button
                  onClick={() => setActiveCatalog("ALL")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeCatalog === "ALL"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Semua Item
                </button>
                <button
                  onClick={() => setActiveCatalog("PRODUCTS")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeCatalog === "PRODUCTS"
                      ? "bg-white text-indigo-600 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Aksesoris ({filteredProducts.length})
                </button>
                <button
                  onClick={() => setActiveCatalog("VOUCHERS")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeCatalog === "VOUCHERS"
                      ? "bg-white text-amber-600 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Voucher HP ({filteredVouchers.length})
                </button>
              </div>

              {/* Search input */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari item kasir..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Item Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[calc(100vh-250px)] overflow-y-auto pr-1">
            {/* 1. Products */}
            {(activeCatalog === "ALL" || activeCatalog === "PRODUCTS") &&
              filteredProducts.map((p) => {
                const inCart = cart.find((i) => i.productId === p.id);
                return (
                  <div
                    key={p.id}
                    onClick={() => addProductToCart(p)}
                    className="bg-white p-3.5 rounded-2xl border border-slate-200/80 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group active:scale-[0.98]"
                  >
                    <div>
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-1">
                        <span className="font-mono">{p.sku}</span>
                        <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                          Stok: {p.stock}
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-900 text-xs line-clamp-2 group-hover:text-indigo-600 transition-colors">
                        {p.name}
                      </h4>
                      {p.brand && <p className="text-[10px] text-slate-400 mt-0.5">{p.brand}</p>}
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="font-extrabold text-xs text-indigo-600">
                        {formatRupiah(p.sellingPrice)}
                      </span>
                      {inCart ? (
                        <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shadow">
                          {inCart.quantity}
                        </span>
                      ) : (
                        <span className="w-6 h-6 rounded-full bg-slate-100 group-hover:bg-indigo-50 group-hover:text-indigo-600 text-slate-400 flex items-center justify-center transition-colors">
                          <Plus className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

            {/* 2. Vouchers */}
            {(activeCatalog === "ALL" || activeCatalog === "VOUCHERS") &&
              filteredVouchers.map((v) => {
                const inCart = cart.find((i) => i.voucherId === v.id);
                return (
                  <div
                    key={v.id}
                    onClick={() => addVoucherToCart(v)}
                    className="bg-white p-3.5 rounded-2xl border border-amber-200/60 hover:border-amber-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group active:scale-[0.98]"
                  >
                    <div>
                      <div className="flex items-center justify-between text-[10px] font-bold mb-1">
                        <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded font-semibold">
                          {v.operator}
                        </span>
                        <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                          Stok: {v.stock}
                        </span>
                      </div>
                      <h4 className="font-extrabold text-slate-900 text-sm mt-1 group-hover:text-amber-600 transition-colors">
                        Voucher {v.nominal}
                      </h4>
                      <p className="text-[10px] text-slate-400">Voucher Fisik Operator</p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-amber-100 flex items-center justify-between">
                      <span className="font-extrabold text-xs text-amber-700">
                        {formatRupiah(v.sellingPrice)}
                      </span>
                      {inCart ? (
                        <span className="w-6 h-6 rounded-full bg-amber-600 text-white flex items-center justify-center text-xs font-bold shadow">
                          {inCart.quantity}
                        </span>
                      ) : (
                        <span className="w-6 h-6 rounded-full bg-amber-50 group-hover:bg-amber-100 text-amber-600 flex items-center justify-center transition-colors">
                          <Plus className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* RIGHT COLUMN: SHOPPING CART & CHECKOUT */}
        <div className="lg:col-span-5 xl:col-span-4 bg-white rounded-3xl border border-slate-200/90 shadow-xl shadow-slate-200/50 p-5 space-y-4 sticky top-20">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-slate-900 text-base">Keranjang Transaksi</h3>
            </div>
            {cart.length > 0 && (
              <button
                onClick={() => setCart([])}
                className="text-xs text-rose-500 hover:text-rose-700 font-medium"
              >
                Kosongkan
              </button>
            )}
          </div>



          {/* Cart Items List */}
          <div className="space-y-2 max-h-56 overflow-y-auto divide-y divide-slate-100 pr-1">
            {cart.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">Keranjang masih kosong</p>
                <p className="text-[10px] mt-0.5">Pilih produk atau voucher di sebelah kiri</p>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.id} className="pt-2 flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{item.itemName}</p>
                    <p className="text-[11px] text-slate-500 font-mono">
                      {formatRupiah(item.unitPrice)}
                    </p>
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => updateQuantity(item.id, -1)}
                      className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center text-xs font-bold text-slate-900">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      disabled={item.quantity >= item.maxStock}
                      className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center disabled:opacity-40"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Item Subtotal & Delete */}
                  <div className="text-right flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 w-16">
                      {formatRupiah(item.unitPrice * item.quantity)}
                    </span>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="text-slate-300 hover:text-rose-500 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pricing & Discount */}
          <div className="border-t border-slate-100 pt-3 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal Item</span>
              <span className="font-bold text-slate-900">{formatRupiah(subtotal)}</span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-600">Diskon (Rp)</span>
              <input
                type="number"
                min={0}
                value={discount || ""}
                onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))}
                placeholder="0"
                className="w-28 text-right bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-rose-600 focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex justify-between text-sm font-extrabold text-slate-900 pt-1 border-t border-dashed border-slate-200">
              <span>Total Tagihan</span>
              <span className="text-base text-indigo-600">{formatRupiah(finalTotal)}</span>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-1.5 pt-1">
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Metode Pembayaran
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => setPaymentMethod("CASH")}
                className={`py-2 px-1 rounded-xl text-xs font-bold border flex flex-col items-center gap-1 transition-all ${
                  paymentMethod === "CASH"
                    ? "bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Banknote className="w-4 h-4" />
                <span>Tunai</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod("QRIS")}
                className={`py-2 px-1 rounded-xl text-xs font-bold border flex flex-col items-center gap-1 transition-all ${
                  paymentMethod === "QRIS"
                    ? "bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <QrCode className="w-4 h-4" />
                <span>QRIS</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod("TRANSFER")}
                className={`py-2 px-1 rounded-xl text-xs font-bold border flex flex-col items-center gap-1 transition-all ${
                  paymentMethod === "TRANSFER"
                    ? "bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>Transfer</span>
              </button>
            </div>
          </div>

          {/* Cash Payment Controls */}
          {paymentMethod === "CASH" && (
            <div className="space-y-2 pt-1 bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">Uang Diterima:</span>
                <input
                  type="number"
                  min={0}
                  value={cashGiven || ""}
                  onChange={(e) => setCashGiven(Number(e.target.value))}
                  placeholder="Rp 0"
                  className="w-32 text-right bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-extrabold text-slate-900 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Quick Cash Suggestions */}
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                <button
                  type="button"
                  onClick={() => setCashGiven(finalTotal)}
                  className="px-2 py-0.5 bg-white border border-slate-200 hover:bg-indigo-50 rounded text-[10px] font-bold text-indigo-600 whitespace-nowrap"
                >
                  Uang Pas
                </button>
                {[50000, 100000, 200000].map((nominal) => (
                  <button
                    key={nominal}
                    type="button"
                    onClick={() => setCashGiven(nominal)}
                    className="px-2 py-0.5 bg-white border border-slate-200 hover:bg-slate-100 rounded text-[10px] font-semibold text-slate-700 whitespace-nowrap"
                  >
                    {nominal / 1000}k
                  </button>
                ))}
              </div>

              {/* Kembalian */}
              <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-200">
                <span className="font-semibold text-slate-700">Kembalian:</span>
                <span className="font-extrabold text-sm text-emerald-600">
                  {formatRupiah(changeGiven)}
                </span>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-600 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Checkout Button */}
          <button
            onClick={handleCheckout}
            disabled={loading || cart.length === 0}
            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 active:scale-[0.99] text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-40 cursor-pointer"
          >
            {loading ? (
              <span>Memproses...</span>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Bayar Transaksi ({formatRupiah(finalTotal)})</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* MODAL PENGATURAN PRINTER THERMAL */}
      {isPrinterModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">Hubungkan Printer Thermal</h3>
                  <p className="text-xs text-slate-400">Pilih metode koneksi printer konter Anda</p>
                </div>
              </div>
              <button
                onClick={() => setIsPrinterModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            {/* Error Message inside Modal */}
            {printerError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-2xl flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>{printerError}</div>
              </div>
            )}

            {/* Connection Options */}
            <div className="space-y-3">
              {/* Option 1: Serial / Bluetooth COM (Recommended for Windows) */}
              <div className="p-4 bg-gradient-to-r from-indigo-50/90 to-purple-50/50 border-2 border-indigo-200 rounded-2xl space-y-2 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cable className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-extrabold text-indigo-900">
                      Port Serial / Bluetooth COM (Windows)
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-indigo-600 text-white text-[9px] font-extrabold uppercase">
                    ⭐ Rekomendasi Windows
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Printer Bluetooth yang sudah di-pair di Windows atau printer USB akan terdeteksi sebagai Port Serial. <strong>100% stabil, tanpa error koneksi</strong>.
                </p>
                <button
                  type="button"
                  onClick={handleConnectSerial}
                  disabled={printerConnecting}
                  className="w-full mt-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Cable className="w-4 h-4" />
                  <span>{printerConnecting ? "Membuka Port..." : "Pilih Port Serial / Bluetooth (COM)"}</span>
                </button>
              </div>

              {/* Option 2: Bluetooth BLE */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <div className="flex items-center gap-2">
                  <Bluetooth className="w-4 h-4 text-slate-700" />
                  <span className="text-xs font-bold text-slate-900">
                    Bluetooth Low Energy (BLE / Mobile)
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Gunakan opsi ini jika Anda menggunakan smartphone/tablet Android atau printer nirkabel BLE khusus.
                </p>
                <button
                  type="button"
                  onClick={handleConnectBluetoothBLE}
                  disabled={printerConnecting}
                  className="w-full mt-1 py-2.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Bluetooth className="w-4 h-4 text-indigo-600" />
                  <span>{printerConnecting ? "Memindai Bluetooth..." : "Pindai Bluetooth BLE"}</span>
                </button>
              </div>
            </div>

            {/* Current Status Info */}
            {printerConnected && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-emerald-900">{printerName}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleTestPrint}
                    className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-[10px] font-bold"
                  >
                    Test Cetak
                  </button>
                  <button
                    type="button"
                    onClick={handleDisconnectPrinter}
                    className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[10px] font-bold"
                  >
                    Putuskan
                  </button>
                </div>
              </div>
            )}

            <div className="text-center pt-1 border-t border-slate-100">
              <p className="text-[11px] text-slate-400">
                🔒 Konfigurasi tersimpan otomatis dan akan terhubung langsung di transaksi berikutnya.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RECEIPT / STRUK TRANSAKSI SUKSES DENGAN 1-KLIK THERMAL PRINTER */}
      {completedSale && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl border border-slate-200 p-6 space-y-4 animate-in zoom-in-95">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-slate-900 text-lg">Transaksi Berhasil!</h3>
              <p className="text-xs text-slate-500">Faktur #{completedSale.invoiceNumber}</p>
            </div>

            {/* Print Feedback Notification */}
            {printFeedback && (
              <div
                className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                  printFeedback.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-rose-50 text-rose-800 border border-rose-200"
                }`}
              >
                {printFeedback.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{printFeedback.text}</span>
              </div>
            )}

            {/* Thermal Receipt Box */}
            <div
              id="printable-receipt"
              className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs font-mono space-y-2 text-slate-700 max-h-60 overflow-y-auto"
            >
              <div className="text-center pb-2 border-b border-dashed border-slate-300">
                <p className="font-bold text-sm text-slate-900">{storeSetting.name}</p>
                {storeSetting.tagline && <p className="text-[10px] text-slate-600 font-semibold">{storeSetting.tagline}</p>}
                {storeSetting.address && <p className="text-[10px] text-slate-500">{storeSetting.address}</p>}
                {storeSetting.phone && <p className="text-[10px] text-slate-500">Telp/WA: {storeSetting.phone}</p>}
                <p className="text-[10px] text-slate-500 font-bold mt-1">{completedSale.invoiceNumber}</p>
              </div>

              <div className="flex justify-between text-[11px]">
                <span>Kasir: {completedSale.cashier?.name || cashierName}</span>
                <span>{new Date(completedSale.createdAt).toLocaleTimeString("id-ID")}</span>
              </div>

              <div className="py-2 border-y border-dashed border-slate-300 space-y-1">
                {completedSale.items?.map((item: any) => (
                  <div key={item.id} className="flex justify-between">
                    <span className="truncate max-w-[170px]">
                      {item.itemName} x{item.quantity}
                    </span>
                    <span className="font-bold">{formatRupiah(item.subtotal)}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-1 pt-1 text-[11px]">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{formatRupiah(completedSale.totalAmount)}</span>
                </div>
                {completedSale.discount > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Diskon:</span>
                    <span>-{formatRupiah(completedSale.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-xs text-slate-900 pt-1 border-t border-slate-200">
                  <span>TOTAL:</span>
                  <span>{formatRupiah(completedSale.finalAmount)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Metode: {completedSale.paymentMethod}</span>
                  <span>Bayar: {formatRupiah(completedSale.cashGiven)}</span>
                </div>
                {completedSale.paymentMethod === "CASH" && (
                  <div className="flex justify-between font-bold text-emerald-600">
                    <span>Kembalian:</span>
                    <span>{formatRupiah(completedSale.changeGiven)}</span>
                  </div>
                )}
              </div>

              <div className="text-center pt-2 text-[10px] text-slate-500 border-t border-dashed border-slate-300 whitespace-pre-line leading-relaxed">
                {storeSetting.receiptFooter || "Terima kasih atas kunjungan Anda!\nBarang yang dibeli tidak dapat ditukar/dikembalikan."}
              </div>
            </div>

            {/* Paper Width & Printer Status Selector */}
            <div className="flex items-center justify-between px-1 text-xs">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <span className={`w-2 h-2 rounded-full ${printerConnected ? "bg-emerald-500" : "bg-slate-300"}`}></span>
                <span className="truncate max-w-[160px] font-semibold">
                  {printerConnected ? printerName || "Printer Siap" : "Printer Belum Terhubung"}
                </span>
              </div>
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setPaperWidth("58mm")}
                  className={`px-1.5 py-0.5 rounded ${paperWidth === "58mm" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
                >
                  58mm
                </button>
                <button
                  type="button"
                  onClick={() => setPaperWidth("80mm")}
                  className={`px-1.5 py-0.5 rounded ${paperWidth === "80mm" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
                >
                  80mm
                </button>
              </div>
            </div>

            {/* Print Actions */}
            <div className="space-y-2 pt-1">
              {/* Primary 1-Click Thermal Print Button */}
              <button
                onClick={() => handlePrintReceiptThermal(completedSale)}
                disabled={printerPrinting}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white rounded-2xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 transition-all cursor-pointer disabled:opacity-50"
              >
                <Printer className={`w-4 h-4 ${printerPrinting ? "animate-pulse" : ""}`} />
                <span>
                  {printerPrinting
                    ? "Mengirim ke Printer..."
                    : printerConnected
                    ? "Cetak Struk Thermal (1-Klik)"
                    : "Hubungkan & Cetak Struk"}
                </span>
              </button>

              <div className="flex items-center gap-2">
                {/* Fallback Standard Browser Print */}
                <button
                  onClick={() => window.print()}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Dialog Browser</span>
                </button>

                {/* Selesai / Close Button */}
                <button
                  onClick={() => {
                    setCompletedSale(null);
                    setPrintFeedback(null);
                  }}
                  className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors"
                >
                  Selesai
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



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
  FileText,
  UserPlus,
  Calendar,
  Clock,
  Edit2,
  Check,
  ScanBarcode,
  Camera,
} from "lucide-react";
import { formatRupiah } from "@/lib/calculations";
import { sortVouchers } from "@/lib/voucher-sort";
import {
  printerManager,
  buildSaleReceiptBuffer,
  PrintSaleData,
  PrinterConnectionType,
} from "@/lib/bluetoothPrinter";
import BarcodeScannerModal from "@/components/BarcodeScannerModal";
import { useBarcodeScanner } from "@/lib/useBarcodeScanner";
import { playSuccessBeep, playErrorBeep } from "@/lib/sound";

interface Product {
  id: string;
  sku: string;
  barcode?: string | null;
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

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  address?: string | null;
  notes?: string | null;
}

interface CartItem {
  id: string;
  itemType: "PRODUCT" | "VOUCHER";
  productId?: string | null;
  voucherId?: string | null;
  itemName: string;
  costPrice: number;
  originalPrice: number;
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
  initialCustomers?: Customer[];
  cashierName: string;
  userRole?: string;
  initialStoreSetting?: StoreSettingState | null;
}

export default function PosClient({
  initialProducts,
  initialVouchers,
  initialCustomers = [],
  cashierName,
  userRole = "CASHIER",
  initialStoreSetting,
}: PosClientProps) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [vouchers, setVouchers] = useState<Voucher[]>(() => sortVouchers(initialVouchers));
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);

  // Store Setting State
  const [storeSetting, setStoreSetting] = useState<StoreSettingState>(() => {
    if (initialStoreSetting) return initialStoreSetting;
    if (typeof window !== "undefined") {
      return {
        name: localStorage.getItem("chicha_store_name") || "CHICHA MOBILE",
        tagline: localStorage.getItem("chicha_store_tagline") || "Pusat Aksesoris & Pulsa",
        address: localStorage.getItem("chicha_store_address") || "Jl. Toko ChiCha Mobile",
        phone: localStorage.getItem("chicha_store_phone") || "0812-3456-7890",
        receiptFooter:
          localStorage.getItem("chicha_store_footer") ||
          "Barang yang dibeli tidak dapat ditukar/dikembalikan.\nTerima kasih atas kunjungan Anda!",
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
      receiptFooter:
        "Barang yang dibeli tidak dapat ditukar/dikembalikan.\nTerima kasih atas kunjungan Anda!",
      printCopies: 1,
      paperWidth: "58mm",
      autoPrint: false,
    };
  });

  // Filter State
  const [activeCatalog, setActiveCatalog] = useState<"ALL" | "PRODUCTS" | "VOUCHERS">("ALL");
  const [search, setSearch] = useState("");

  // Customer State
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("chicha_pos_customer");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          return null;
        }
      }
    }
    return null;
  });
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [newCustomerForm, setNewCustomerForm] = useState({
    name: "",
    phone: "",
    address: "",
  });
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [customerModalTab, setCustomerModalTab] = useState<"PICK" | "CREATE">("PICK");

  // Cart State with Local Storage persistence
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("chicha_pos_cart");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          return [];
        }
      }
    }
    return [];
  });

  // Payment Method State: Tunai, QRIS, Transfer, Kredit/Nota
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "TRANSFER" | "QRIS" | "CREDIT">("CASH");
  const [cashGiven, setCashGiven] = useState<number>(0);
  const [creditDueDate, setCreditDueDate] = useState<string>("");
  const [creditNotes, setCreditNotes] = useState<string>("");

  // Item Price Edit Modal / Inline State
  const [editingPriceItemId, setEditingPriceItemId] = useState<string | null>(null);
  const [tempEditPrice, setTempEditPrice] = useState<string>("");

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
  const [paperWidth, setPaperWidth] = useState<"58mm" | "80mm">(
    (storeSetting.paperWidth as any) === "80mm" ? "80mm" : "58mm"
  );
  const [isPrinterModalOpen, setIsPrinterModalOpen] = useState<boolean>(false);

  // QR & Barcode Scanner State
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState<boolean>(false);
  const [scanToast, setScanToast] = useState<{
    type: "success" | "warning" | "error";
    text: string;
    detail?: string;
  } | null>(null);

  // Sync cart & customer to local storage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("chicha_pos_cart", JSON.stringify(cart));
    }
  }, [cart]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (selectedCustomer) {
        localStorage.setItem("chicha_pos_customer", JSON.stringify(selectedCustomer));
      } else {
        localStorage.removeItem("chicha_pos_customer");
      }
    }
  }, [selectedCustomer]);

  // Auto-connect to previously paired printer on mount
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

  // Connect via Web Serial
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

  // Connect via Web Bluetooth BLE
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

  // Direct 1-Click Thermal Receipt Print
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
        customerName: sale.customerName || sale.customer?.name || "",
        paymentMethod: sale.paymentMethod,
        totalAmount: sale.totalAmount,
        discount: 0,
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

  // Calculations: Total is pure subtotal without discount
  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const finalTotal = subtotal;
  const changeGiven = paymentMethod === "CASH" ? Math.max(0, cashGiven - finalTotal) : 0;
  const remainingDebt = paymentMethod === "CREDIT" ? Math.max(0, finalTotal - cashGiven) : 0;

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
          originalPrice: p.sellingPrice,
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
          originalPrice: v.sellingPrice,
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

  // Barcode / QR Scan Handler (handles camera scan & hardware barcode gun)
  const handleBarcodeScanned = (scannedCode: string) => {
    const code = scannedCode.trim();
    if (!code) return;

    // 1. Search products by Barcode or SKU
    const matchedProduct = products.find(
      (p) =>
        (p.barcode && p.barcode.toLowerCase() === code.toLowerCase()) ||
        p.sku.toLowerCase() === code.toLowerCase()
    );

    if (matchedProduct) {
      if (matchedProduct.stock <= 0) {
        playErrorBeep();
        setScanToast({
          type: "warning",
          text: `Stok produk "${matchedProduct.name}" habis (0)!`,
        });
        setTimeout(() => setScanToast(null), 3000);
        return;
      }

      const inCart = cart.find((i) => i.productId === matchedProduct.id);
      if (inCart && inCart.quantity >= matchedProduct.stock) {
        playErrorBeep();
        setScanToast({
          type: "warning",
          text: `Stok tidak mencukupi untuk menambah "${matchedProduct.name}" lagi.`,
          detail: `Maksimal stok tersedia: ${matchedProduct.stock}`,
        });
        setTimeout(() => setScanToast(null), 3000);
        return;
      }

      addProductToCart(matchedProduct);
      playSuccessBeep();
      setScanToast({
        type: "success",
        text: `+1 ${matchedProduct.name} ditambahkan`,
        detail: `Barcode: ${matchedProduct.barcode || matchedProduct.sku} • Rp ${matchedProduct.sellingPrice.toLocaleString("id-ID")}`,
      });
      setTimeout(() => setScanToast(null), 2500);
      return;
    }

    // 2. Search vouchers by Operator-Nominal or Nominal
    const matchedVoucher = vouchers.find(
      (v) =>
        `${v.operator}-${v.nominal}`.toLowerCase() === code.toLowerCase() ||
        `${v.operator} ${v.nominal}`.toLowerCase() === code.toLowerCase()
    );

    if (matchedVoucher) {
      if (matchedVoucher.stock <= 0) {
        playErrorBeep();
        setScanToast({
          type: "warning",
          text: `Stok voucher "${matchedVoucher.operator} ${matchedVoucher.nominal}" habis!`,
        });
        setTimeout(() => setScanToast(null), 3000);
        return;
      }

      addVoucherToCart(matchedVoucher);
      playSuccessBeep();
      setScanToast({
        type: "success",
        text: `+1 Voucher ${matchedVoucher.operator} ${matchedVoucher.nominal} ditambahkan`,
      });
      setTimeout(() => setScanToast(null), 2500);
      return;
    }

    // 3. Not found
    playErrorBeep();
    setScanToast({
      type: "error",
      text: `Produk dengan kode "${code}" tidak ditemukan di database SQLite lokal.`,
      detail: "Pastikan barcode sudah didaftarkan pada menu Master Produk.",
    });
    setTimeout(() => setScanToast(null), 3500);
  };

  // Listen to USB / Wireless / Bluetooth Barcode Scanner Guns
  useBarcodeScanner({
    onScan: handleBarcodeScanned,
    enabled: true,
  });

  // Real-time Dynamic Edit Item Unit Price
  const startEditPrice = (item: CartItem) => {
    setEditingPriceItemId(item.id);
    setTempEditPrice(item.unitPrice > 0 ? String(item.unitPrice) : "");
  };

  const handlePriceChange = (id: string, rawVal: string) => {
    // Only accept numeric digits
    const digitsOnly = rawVal.replace(/[^\d]/g, "");
    setTempEditPrice(digitsOnly);

    // Live update item price immediately in cart state
    const parsed = digitsOnly === "" ? 0 : parseInt(digitsOnly, 10);
    setCart((prevCart) =>
      prevCart.map((item) => (item.id === id ? { ...item, unitPrice: parsed } : item))
    );
  };

  const finishEditPrice = (id: string) => {
    // If cashier left it blank, fallback to original price
    if (tempEditPrice === "") {
      const item = cart.find((i) => i.id === id);
      const fallbackPrice = item?.originalPrice || 0;
      setCart((prevCart) =>
        prevCart.map((i) => (i.id === id ? { ...i, unitPrice: fallbackPrice } : i))
      );
    }
    setEditingPriceItemId(null);
  };

  const resetItemPrice = (id: string) => {
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.id === id ? { ...item, unitPrice: item.originalPrice } : item
      )
    );
    if (editingPriceItemId === id) {
      setEditingPriceItemId(null);
    }
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter((item) => item.id !== id));
  };

  // Customer Management
  const handleSaveNewCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerForm.name.trim()) return;

    setIsCreatingCustomer(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCustomerForm),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membuat pelanggan baru");

      const createdCustomer = data.customer;
      setCustomers([createdCustomer, ...customers]);
      setSelectedCustomer(createdCustomer);
      setIsCustomerModalOpen(false);
      setNewCustomerForm({ name: "", phone: "", address: "" });
      setCustomerModalTab("PICK");
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsCreatingCustomer(false);
    }
  };

  // Checkout Handler with Connection Resilience
  const handleCheckout = async () => {
    if (loading || cart.length === 0) return;

    if (paymentMethod === "CASH" && cashGiven < finalTotal) {
      setErrorMessage(
        `Uang tunai pembayaran (${formatRupiah(cashGiven)}) kurang dari total tagihan (${formatRupiah(
          finalTotal
        )})`
      );
      return;
    }

    if (paymentMethod === "CREDIT" && !selectedCustomer?.name?.trim()) {
      setErrorMessage(
        "Transaksi Kredit / Nota wajib memilih pelanggan. Silakan klik 'Pilih Pelanggan' terlebih dahulu."
      );
      setIsCustomerModalOpen(true);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const payload = {
        items: cart.map((i) => ({
          itemType: i.itemType,
          productId: i.productId || null,
          voucherId: i.voucherId || null,
          itemName: i.itemName,
          quantity: i.quantity,
          costPrice: i.costPrice,
          unitPrice: i.unitPrice,
        })),
        discount: 0,
        paymentMethod,
        cashGiven:
          paymentMethod === "CASH"
            ? Number(cashGiven)
            : paymentMethod === "CREDIT"
            ? Number(cashGiven || 0)
            : finalTotal,
        customerId: selectedCustomer?.id || null,
        customerName: selectedCustomer?.name || null,
        customerPhone: selectedCustomer?.phone || null,
        dueDate: paymentMethod === "CREDIT" && creditDueDate ? creditDueDate : null,
        notes: creditNotes?.trim() || null,
      };

      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal memproses transaksi ke database.");
      }

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

      // Display receipt modal & reset cart & storage
      setCompletedSale(data.sale);
      setCart([]);
      setCashGiven(0);
      setCreditDueDate("");
      setCreditNotes("");
      if (typeof window !== "undefined") {
        localStorage.removeItem("chicha_pos_cart");
      }

      // Auto-print if Printer is already connected
      if (printerManager.isConnected()) {
        setTimeout(() => {
          handlePrintReceiptThermal(data.sale);
        }, 300);
      }
    } catch (err: any) {
      setErrorMessage(
        `${err.message}. Data keranjang tetap aman tersimpan. Anda dapat mencoba kembali tanpa perlu input ulang.`
      );
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
        (p.barcode && p.barcode.toLowerCase().includes(search.toLowerCase())) ||
        (p.brand && p.brand.toLowerCase().includes(search.toLowerCase())))
  );

  const filteredVouchers = vouchers.filter(
    (v) =>
      v.stock > 0 &&
      (v.operator.toLowerCase().includes(search.toLowerCase()) ||
        v.nominal.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      (c.phone && c.phone.includes(customerSearch))
  );

  return (
    <div className="space-y-5">
      {/* Top Bar: Store & Printer Status Bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <h1 className="text-lg font-black tracking-tight text-slate-900">
              Kasir (Point of Sale)
            </h1>
            <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-extrabold uppercase border border-indigo-200/60">
              {userRole === "OWNER" ? "Owner / Admin" : "Kasir"}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Petugas Kasir: <strong className="text-slate-800">{cashierName}</strong> • {storeSetting.name}
          </p>
        </div>

        {/* Printer Quick Status & Action */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {printFeedback && (
            <div
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 animate-in fade-in ${
                printFeedback.type === "success"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-rose-50 text-rose-700 border border-rose-200"
              }`}
            >
              <span>{printFeedback.text}</span>
            </div>
          )}

          {printerConnected ? (
            <div className="flex items-center gap-2">
              <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs font-bold text-emerald-800">
                <Bluetooth className="w-4 h-4 text-emerald-600 animate-pulse" />
                <span className="truncate max-w-[130px]">{printerName || "Printer Siap"}</span>
              </div>
              <button
                type="button"
                onClick={handleTestPrint}
                disabled={printerPrinting}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                title="Test Cetak Struk"
              >
                Test
              </button>
              <button
                type="button"
                onClick={handleDisconnectPrinter}
                className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold transition-all"
                title="Putuskan Printer"
              >
                Putus
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

              {/* Search input & Camera Scan Button */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    data-barcode-target="true"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && search.trim()) {
                        handleBarcodeScanned(search.trim());
                        setSearch("");
                      }
                    }}
                    placeholder="Cari item / scan barcode..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setIsCameraScannerOpen(true)}
                  className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition whitespace-nowrap"
                  title="Buka Kamera Scan QR & Barcode"
                >
                  <ScanBarcode className="w-4 h-4" />
                  <span className="hidden sm:inline">Scan Barcode / QR</span>
                </button>
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
                        <span className="font-mono text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.5 rounded" title="Kode Barcode / QR">
                          {p.barcode || p.sku}
                        </span>
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
          {/* Cart Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-slate-900 text-base">Keranjang Transaksi</h3>
            </div>
            {cart.length > 0 && (
              <button
                onClick={() => setCart([])}
                className="text-xs text-rose-500 hover:text-rose-700 font-semibold"
              >
                Kosongkan
              </button>
            )}
          </div>

          {/* CUSTOMER SELECTION CARD */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Pelanggan
                </p>
                <p className="text-xs font-extrabold text-slate-900 truncate">
                  {selectedCustomer ? selectedCustomer.name : "Pelanggan Umum (Non-Member)"}
                </p>
                {selectedCustomer?.phone && (
                  <p className="text-[10px] text-slate-500">{selectedCustomer.phone}</p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsCustomerModalOpen(true)}
              className="px-2.5 py-1.5 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-xl text-xs font-bold text-indigo-600 transition-all shrink-0 shadow-sm"
            >
              {selectedCustomer ? "Ganti" : "Pilih"}
            </button>
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
                <div key={item.id} className="pt-2 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{item.itemName}</p>
                      
                      {/* Price display with real-time dynamic edit */}
                      {editingPriceItemId === item.id ? (
                        <div className="flex items-center gap-1.5 mt-1">
                          <div className="relative flex items-center">
                            <span className="absolute left-2 text-[10px] font-bold text-slate-400 select-none">
                              Rp
                            </span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={tempEditPrice}
                              onChange={(e) => handlePriceChange(item.id, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  finishEditPrice(item.id);
                                } else if (e.key === "Escape") {
                                  finishEditPrice(item.id);
                                }
                              }}
                              onBlur={() => finishEditPrice(item.id)}
                              onFocus={(e) => e.target.select()}
                              className="w-28 pl-7 pr-2 py-0.5 text-xs font-mono font-extrabold border-2 border-indigo-500 rounded-lg bg-white text-indigo-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              autoFocus
                              placeholder="0"
                            />
                          </div>
                          <button
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              finishEditPrice(item.id);
                            }}
                            className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold shadow-sm transition-all shrink-0"
                            title="Selesai ubah harga"
                          >
                            OK
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center flex-wrap gap-1.5 mt-0.5">
                          <button
                            type="button"
                            onClick={() => startEditPrice(item)}
                            className="group flex items-center gap-1 text-[11px] font-mono font-bold text-slate-700 hover:text-indigo-600 transition-colors bg-slate-50 hover:bg-indigo-50 px-1.5 py-0.5 rounded-md border border-slate-200 hover:border-indigo-200"
                            title="Klik untuk ubah harga jual item ini"
                          >
                            <span>{formatRupiah(item.unitPrice)}</span>
                            <Edit2 className="w-2.5 h-2.5 text-slate-400 group-hover:text-indigo-600" />
                          </button>
                          {item.unitPrice !== item.originalPrice && (
                            <div className="flex items-center gap-1">
                              <span className="px-1.5 py-0.5 text-[9px] bg-amber-50 text-amber-700 font-extrabold rounded-md border border-amber-200">
                                Khusus
                              </span>
                              <button
                                type="button"
                                onClick={() => resetItemPrice(item.id)}
                                className="text-[9px] text-slate-400 hover:text-indigo-600 underline font-medium transition-colors"
                                title={`Reset ke harga normal (${formatRupiah(item.originalPrice)})`}
                              >
                                Reset
                              </button>
                            </div>
                          )}
                        </div>
                      )}
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

                    {/* Subtotal & Delete */}
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
                </div>
              ))
            )}
          </div>

          {/* Pricing Summary (No Discount Field) */}
          <div className="border-t border-slate-100 pt-3 space-y-2 text-xs">
            <div className="flex justify-between items-center text-sm font-black text-slate-900 pt-1">
              <span>Total Tagihan</span>
              <span className="text-lg text-indigo-600">{formatRupiah(finalTotal)}</span>
            </div>
          </div>

          {/* Payment Method Selector (CASH, QRIS, TRANSFER, KREDIT/NOTA) */}
          <div className="space-y-1.5 pt-1">
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Metode Pembayaran
            </label>
            <div className="grid grid-cols-4 gap-1.5">
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

              <button
                type="button"
                onClick={() => {
                  setPaymentMethod("CREDIT");
                  if (!selectedCustomer) {
                    setIsCustomerModalOpen(true);
                  }
                }}
                className={`py-2 px-1 rounded-xl text-xs font-bold border flex flex-col items-center gap-1 transition-all ${
                  paymentMethod === "CREDIT"
                    ? "bg-amber-50 border-amber-500 text-amber-800 shadow-sm"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <FileText className="w-4 h-4" />
                <span className="truncate">Kredit/Nota</span>
              </button>
            </div>
          </div>

          {/* CASH PAYMENT CONTROLS */}
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

          {/* KREDIT / NOTA CONTROLS */}
          {paymentMethod === "CREDIT" && (
            <div className="space-y-2.5 pt-1 bg-amber-50/70 p-3.5 rounded-2xl border border-amber-200 text-xs">
              {!selectedCustomer && (
                <div className="p-2 bg-amber-100/80 rounded-xl text-amber-900 font-bold text-[11px] flex items-center justify-between">
                  <span>Wajib pilih pelanggan untuk nota kredit!</span>
                  <button
                    type="button"
                    onClick={() => setIsCustomerModalOpen(true)}
                    className="underline text-indigo-700 font-black"
                  >
                    Pilih
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="font-semibold text-amber-900">Uang Muka / DP (Rp):</span>
                <input
                  type="number"
                  min={0}
                  max={finalTotal}
                  value={cashGiven || ""}
                  onChange={(e) => setCashGiven(Math.max(0, Number(e.target.value)))}
                  placeholder="0 (Tanpa DP)"
                  className="w-32 text-right bg-white border border-amber-300 rounded-lg px-2.5 py-1 text-xs font-bold text-amber-900 focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="font-semibold text-amber-900">Jatuh Tempo:</span>
                <input
                  type="date"
                  value={creditDueDate}
                  onChange={(e) => setCreditDueDate(e.target.value)}
                  className="bg-white border border-amber-300 rounded-lg px-2 py-1 text-xs text-slate-800"
                />
              </div>

              <div>
                <input
                  type="text"
                  value={creditNotes}
                  onChange={(e) => setCreditNotes(e.target.value)}
                  placeholder="Catatan nota bon piutang..."
                  className="w-full bg-white border border-amber-300 rounded-lg px-2.5 py-1 text-xs text-slate-800 placeholder-amber-400"
                />
              </div>

              <div className="flex justify-between items-center text-xs pt-1.5 border-t border-amber-200">
                <span className="font-bold text-amber-900">Sisa Tagihan Piutang:</span>
                <span className="font-black text-sm text-rose-600">
                  {formatRupiah(remainingDebt)}
                </span>
              </div>
            </div>
          )}

          {/* Error Banner with Retry button */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-2xl space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">{errorMessage}</p>
              </div>
              <button
                type="button"
                onClick={handleCheckout}
                disabled={loading}
                className="w-full py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-[11px] transition-colors flex items-center justify-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                <span>Coba Simpan Ulang Transaksi</span>
              </button>
            </div>
          )}

          {/* Checkout Button */}
          <button
            onClick={handleCheckout}
            disabled={loading || cart.length === 0}
            className={`w-full py-3 text-white font-extrabold text-sm rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-40 cursor-pointer active:scale-[0.99] ${
              paymentMethod === "CREDIT"
                ? "bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 shadow-amber-600/30"
                : "bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 shadow-indigo-600/30"
            }`}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Menghubungkan ke database...
              </span>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {paymentMethod === "CREDIT"
                    ? `Buat Nota Kredit (${formatRupiah(finalTotal)})`
                    : `Bayar Transaksi (${formatRupiah(finalTotal)})`}
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* MODAL PEMILIHAN & PENAMBAHAN PELANGGAN */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">Pelanggan Transaksi</h3>
                  <p className="text-xs text-slate-400">Pilih atau daftarkan pelanggan</p>
                </div>
              </div>
              <button
                onClick={() => setIsCustomerModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            {/* Tab: Pilih Pelanggan vs Pelanggan Baru */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setCustomerModalTab("PICK")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  customerModalTab === "PICK"
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Pilih Pelanggan
              </button>
              <button
                type="button"
                onClick={() => setCustomerModalTab("CREATE")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  customerModalTab === "CREATE"
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                + Pelanggan Baru
              </button>
            </div>

            {customerModalTab === "PICK" ? (
              <div className="space-y-3">
                {/* Search */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="Cari nama atau telepon pelanggan..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Default General Customer option */}
                <div
                  onClick={() => {
                    setSelectedCustomer(null);
                    setIsCustomerModalOpen(false);
                  }}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                    selectedCustomer === null
                      ? "bg-indigo-50/70 border-indigo-300 text-indigo-900"
                      : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <div>
                    <h5 className="font-extrabold text-xs">Pelanggan Umum (Non-Member)</h5>
                    <p className="text-[10px] text-slate-400">Transaksi reguler tanpa pencatatan piutang</p>
                  </div>
                  {selectedCustomer === null && <Check className="w-4 h-4 text-indigo-600" />}
                </div>

                {/* Customers list */}
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {filteredCustomers.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 text-xs">
                      Tidak ada pelanggan ditemukan. Buat baru di tab "+ Pelanggan Baru".
                    </div>
                  ) : (
                    filteredCustomers.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => {
                          setSelectedCustomer(c);
                          setIsCustomerModalOpen(false);
                        }}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                          selectedCustomer?.id === c.id
                            ? "bg-indigo-50 border-indigo-400 text-indigo-900 font-bold"
                            : "bg-white border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <div>
                          <p className="text-xs font-bold text-slate-900">{c.name}</p>
                          {c.phone && <p className="text-[10px] text-slate-500">{c.phone}</p>}
                        </div>
                        {selectedCustomer?.id === c.id && <Check className="w-4 h-4 text-indigo-600" />}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveNewCustomer} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Nama Lengkap *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCustomerForm.name}
                    onChange={(e) =>
                      setNewCustomerForm({ ...newCustomerForm, name: e.target.value })
                    }
                    placeholder="Contoh: Pak Haji Bambang"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Nomor WhatsApp / HP
                  </label>
                  <input
                    type="tel"
                    value={newCustomerForm.phone}
                    onChange={(e) =>
                      setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })
                    }
                    placeholder="0812xxxx"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Alamat / Catatan
                  </label>
                  <input
                    type="text"
                    value={newCustomerForm.address}
                    onChange={(e) =>
                      setNewCustomerForm({ ...newCustomerForm, address: e.target.value })
                    }
                    placeholder="Alamat konter / rumah..."
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isCreatingCustomer}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                >
                  {isCreatingCustomer ? "Menyimpan..." : "Simpan & Pilih Pelanggan"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

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
                  <Cable className="w-3.5 h-3.5" />
                  <span>{printerConnecting ? "Menghubungkan..." : "Pilih Port Serial / Bluetooth"}</span>
                </button>
              </div>

              {/* Option 2: Web Bluetooth BLE */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-slate-700" />
                  <span className="text-xs font-extrabold text-slate-900">
                    Web Bluetooth BLE (Mobile / Android)
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Cocok untuk perangkat Android atau browser dengan dukungan native Web Bluetooth BLE.
                </p>
                <button
                  type="button"
                  onClick={handleConnectBluetoothBLE}
                  disabled={printerConnecting}
                  className="w-full mt-1 py-2.5 bg-slate-800 hover:bg-slate-900 active:scale-[0.99] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Bluetooth className="w-3.5 h-3.5" />
                  <span>{printerConnecting ? "Memindai..." : "Pindai Perangkat Bluetooth"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL STRUK TRANSAKSI SELESAI */}
      {completedSale && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl border border-slate-200 p-6 space-y-4 animate-in zoom-in-95">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="font-black text-slate-900 text-base">
                {completedSale.paymentMethod === "CREDIT"
                  ? "Nota Kredit Berhasil Dibuat!"
                  : "Transaksi Berhasil!"}
              </h3>
              <p className="text-xs text-slate-500">
                Faktur: <span className="font-mono font-bold text-slate-800">{completedSale.invoiceNumber}</span>
              </p>
            </div>

            {/* Receipt Preview Paper Container */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 font-mono text-xs space-y-2 text-slate-800">
              <div className="text-center border-b border-dashed border-slate-300 pb-2">
                <p className="font-bold text-sm text-slate-900">{storeSetting.name}</p>
                {storeSetting.tagline && (
                  <p className="text-[10px] text-slate-600 font-semibold">{storeSetting.tagline}</p>
                )}
                {storeSetting.address && <p className="text-[10px] text-slate-500">{storeSetting.address}</p>}
                {storeSetting.phone && <p className="text-[10px] text-slate-500">Telp/WA: {storeSetting.phone}</p>}
                <p className="text-[10px] text-slate-500 font-bold mt-1">{completedSale.invoiceNumber}</p>
              </div>

              <div className="flex justify-between text-[11px]">
                <span>Kasir: {completedSale.cashier?.name || cashierName}</span>
                <span>{new Date(completedSale.createdAt).toLocaleTimeString("id-ID")}</span>
              </div>

              {completedSale.customerName && (
                <div className="text-[11px] font-bold text-indigo-700">
                  Pelanggan: {completedSale.customerName}
                </div>
              )}

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
                <div className="flex justify-between font-bold text-xs text-slate-900 pt-1 border-t border-slate-200">
                  <span>TOTAL:</span>
                  <span>{formatRupiah(completedSale.finalAmount)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>
                    Metode: {completedSale.paymentMethod === "CREDIT" ? "KREDIT / NOTA" : completedSale.paymentMethod}
                  </span>
                  <span>
                    {completedSale.paymentMethod === "CREDIT" ? "DP:" : "Bayar:"}{" "}
                    {formatRupiah(completedSale.cashGiven)}
                  </span>
                </div>

                {completedSale.paymentMethod === "CREDIT" && (
                  <div className="flex justify-between font-black text-rose-600 border-t border-dashed border-amber-300 pt-1">
                    <span>SISA PIUTANG:</span>
                    <span>{formatRupiah(Math.max(0, completedSale.finalAmount - completedSale.cashGiven))}</span>
                  </div>
                )}

                {completedSale.paymentMethod === "CASH" && (
                  <div className="flex justify-between font-bold text-emerald-600">
                    <span>Kembalian:</span>
                    <span>{formatRupiah(completedSale.changeGiven)}</span>
                  </div>
                )}
              </div>

              <div className="text-center pt-2 text-[10px] text-slate-500 border-t border-dashed border-slate-300 whitespace-pre-line leading-relaxed">
                {storeSetting.receiptFooter ||
                  "Terima kasih atas kunjungan Anda!\nBarang yang dibeli tidak dapat ditukar/dikembalikan."}
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-1">
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
                <button
                  onClick={() => window.print()}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Dialog Browser</span>
                </button>

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

      {/* Floating Scan Toast Banner */}
      {scanToast && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce duration-300">
          <div
            className={`px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-3 backdrop-blur-md ${
              scanToast.type === "success"
                ? "bg-emerald-950/90 text-white border-emerald-500/50 shadow-emerald-900/30"
                : scanToast.type === "warning"
                ? "bg-amber-950/90 text-white border-amber-500/50 shadow-amber-900/30"
                : "bg-rose-950/90 text-white border-rose-500/50 shadow-rose-900/30"
            }`}
          >
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                scanToast.type === "success"
                  ? "bg-emerald-500/20 text-emerald-400"
                  : scanToast.type === "warning"
                  ? "bg-amber-500/20 text-amber-400"
                  : "bg-rose-500/20 text-rose-400"
              }`}
            >
              <ScanBarcode className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold">{scanToast.text}</p>
              {scanToast.detail && (
                <p className="text-[11px] text-slate-300 opacity-90">{scanToast.detail}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* POS Camera Barcode Scanner Modal (Continuous Mode for rapid retail checkout) */}
      <BarcodeScannerModal
        isOpen={isCameraScannerOpen}
        onClose={() => setIsCameraScannerOpen(false)}
        title="POS Live Scanner Barcode / QR"
        subtitle="Arahkan kamera ke barcode kemasan barang untuk langsung masuk keranjang"
        continuous={true}
        onScan={handleBarcodeScanned}
      />
    </div>
  );
}

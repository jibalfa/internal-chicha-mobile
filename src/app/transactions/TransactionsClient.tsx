"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  History,
  Search,
  Calendar,
  CreditCard,
  Banknote,
  QrCode,
  Printer,
  Eye,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Receipt,
  CheckCircle2,
  AlertCircle,
  X,
  Layers,
  Filter,
  ArrowUpDown,
  SmartphoneNfc,
  ShoppingCart,
  Phone,
  Cable,
  Bluetooth,
  FileText,
  Coins,
  Edit2,
  Ban,
  AlertTriangle,
  Plus,
  Minus,
  Trash2,
} from "lucide-react";
import { formatRupiah } from "@/lib/calculations";
import {
  printerManager,
  buildSaleReceiptBuffer,
  PrintSaleData,
} from "@/lib/bluetoothPrinter";
import { AuthSession } from "@/types";

interface TransactionItem {
  id: string;
  itemType?: "PRODUCT" | "VOUCHER" | string;
  productId?: string | null;
  voucherId?: string | null;
  itemName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  costPrice?: number;
  profit?: number;
}

interface TransactionRecord {
  id: string;
  trxType: "POS" | "DIGITAL";
  invoiceNumber: string;
  createdAt: string | Date;
  destinationNumber?: string | null;
  productName?: string | null;
  totalAmount: number;
  discount: number;
  finalAmount: number;
  paymentMethod: string;
  cashGiven?: number;
  changeGiven?: number;
  paymentStatus?: string;
  dueDate?: string | Date | null;
  paidAt?: string | Date | null;
  paidMethod?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  notes?: string | null;
  status?: string;
  itemsCount?: number;
  cashier?: {
    id: string;
    name: string;
    username: string;
  } | null;
  rawItems: TransactionItem[];
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface SummaryMeta {
  totalCount: number;
  totalRevenue: number;
  totalDiscount: number;
  cashAmount: number;
  transferAmount: number;
  qrisAmount: number;
  creditAmount?: number;
}

interface TransactionsClientProps {
  user: AuthSession;
  storeSetting: {
    id?: string;
    name: string;
    tagline?: string | null;
    address?: string | null;
    phone?: string | null;
    receiptFooter?: string | null;
    printCopies: number;
    paperWidth: "58mm" | "80mm" | string;
    autoPrint: boolean;
  };
}

// Helper to format Date to YYYY-MM-DD
function formatDateToInput(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function TransactionsClient({ user, storeSetting }: TransactionsClientProps) {
  // Query Filters State
  const [trxType, setTrxType] = useState<"POS" | "DIGITAL">("POS");
  const [paymentMethod, setPaymentMethod] = useState<string>("ALL");
  const [search, setSearch] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");

  // Date Range Presets: today, yesterday, 7days, 30days, thisMonth, all, custom
  const [datePreset, setDatePreset] = useState<string>("today");
  const [startDate, setStartDate] = useState<string>(formatDateToInput(new Date()));
  const [endDate, setEndDate] = useState<string>(formatDateToInput(new Date()));

  // Pagination State
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);

  // Data & Summary State
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  });
  const [summary, setSummary] = useState<SummaryMeta>({
    totalCount: 0,
    totalRevenue: 0,
    totalDiscount: 0,
    cashAmount: 0,
    transferAmount: 0,
    qrisAmount: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Detail Modal & Thermal Reprint State
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionRecord | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [isPrinterModalOpen, setIsPrinterModalOpen] = useState<boolean>(false);
  const [printing, setPrinting] = useState<boolean>(false);
  const [printFeedback, setPrintFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [printerConnected, setPrinterConnected] = useState<boolean>(false);
  const [paperWidth, setPaperWidth] = useState<"58mm" | "80mm">(
    (storeSetting.paperWidth as any) === "80mm" ? "80mm" : "58mm"
  );

  // Settle Credit/Nota state
  const [isSettleModalOpen, setIsSettleModalOpen] = useState<boolean>(false);
  const [selectedSettleTrx, setSelectedSettleTrx] = useState<TransactionRecord | null>(null);
  const [settlePaidMethod, setSettlePaidMethod] = useState<"CASH" | "TRANSFER" | "QRIS">("CASH");
  const [settleNotes, setSettleNotes] = useState<string>("");
  const [settleLoading, setSettleLoading] = useState<boolean>(false);

  // Edit Transaction state
  interface EditItemState {
    id?: string;
    itemType: "PRODUCT" | "VOUCHER";
    productId?: string | null;
    voucherId?: string | null;
    itemName: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [selectedEditTrx, setSelectedEditTrx] = useState<TransactionRecord | null>(null);
  const [editItems, setEditItems] = useState<EditItemState[]>([]);
  const [editPaymentMethod, setEditPaymentMethod] = useState<"CASH" | "TRANSFER" | "QRIS" | "CREDIT">("CASH");
  const [editDiscount, setEditDiscount] = useState<number>(0);
  const [editCashGiven, setEditCashGiven] = useState<number>(0);
  const [editCustomerName, setEditCustomerName] = useState<string>("");
  const [editCustomerPhone, setEditCustomerPhone] = useState<string>("");
  const [editNotes, setEditNotes] = useState<string>("");
  const [editLoading, setEditLoading] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Catalog for adding items in edit modal
  const [catalogProducts, setCatalogProducts] = useState<any[]>([]);
  const [catalogVouchers, setCatalogVouchers] = useState<any[]>([]);
  const [isCatalogLoaded, setIsCatalogLoaded] = useState<boolean>(false);
  const [selectedCatalogItemKey, setSelectedCatalogItemKey] = useState<string>("");

  // Cancel Transaction state
  const [isCancelModalOpen, setIsCancelModalOpen] = useState<boolean>(false);
  const [selectedCancelTrx, setSelectedCancelTrx] = useState<TransactionRecord | null>(null);
  const [cancelReason, setCancelReason] = useState<string>("");
  const [cancelLoading, setCancelLoading] = useState<boolean>(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to page 1 on search change
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Check printer auto connection on mount
  useEffect(() => {
    printerManager.tryAutoConnect().then((res) => {
      if (res.success) {
        setPrinterConnected(true);
      }
    });
  }, []);

  // Handle Date Preset Changes
  const applyDatePreset = (preset: string) => {
    setDatePreset(preset);
    setPage(1);
    const now = new Date();

    if (preset === "today") {
      const todayStr = formatDateToInput(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === "yesterday") {
      const y = new Date();
      y.setDate(now.getDate() - 1);
      const yStr = formatDateToInput(y);
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (preset === "7days") {
      const past = new Date();
      past.setDate(now.getDate() - 6);
      setStartDate(formatDateToInput(past));
      setEndDate(formatDateToInput(now));
    } else if (preset === "30days") {
      const past = new Date();
      past.setDate(now.getDate() - 29);
      setStartDate(formatDateToInput(past));
      setEndDate(formatDateToInput(now));
    } else if (preset === "thisMonth") {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(formatDateToInput(firstDay));
      setEndDate(formatDateToInput(now));
    } else if (preset === "all") {
      setStartDate("");
      setEndDate("");
    }
  };

  // Fetch Transactions API
  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      params.set("type", trxType);

      if (paymentMethod !== "ALL") {
        params.set("paymentMethod", paymentMethod);
      }

      if (debouncedSearch.trim()) {
        params.set("search", debouncedSearch.trim());
      }

      if (startDate) {
        params.set("startDate", startDate);
      }

      if (endDate) {
        params.set("endDate", endDate);
      }

      const res = await fetch(`/api/transactions?${params.toString()}`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Gagal memuat riwayat transaksi");
      }

      setTransactions(json.data || []);
      setPagination(
        json.pagination || {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        }
      );
      setSummary(
        json.summary || {
          totalCount: 0,
          totalRevenue: 0,
          totalDiscount: 0,
          cashAmount: 0,
          transferAmount: 0,
          qrisAmount: 0,
        }
      );
    } catch (err: any) {
      console.error("fetchTransactions error:", err);
      setError(err.message || "Gagal memuat data transaksi.");
    } finally {
      setLoading(false);
    }
  }, [page, limit, trxType, paymentMethod, debouncedSearch, startDate, endDate]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Handle 1-Click Thermal Receipt Reprint
  const handleReprintThermal = async (trx: TransactionRecord) => {
    if (!trx) return;

    if (!printerManager.isConnected()) {
      setIsPrinterModalOpen(true);
      return;
    }

    setPrinting(true);
    setPrintFeedback(null);

    try {
      const printData: PrintSaleData = {
        invoiceNumber: trx.invoiceNumber,
        createdAt: trx.createdAt,
        cashierName: trx.cashier?.name || user.name,
        paymentMethod: trx.paymentMethod || "CASH",
        paymentStatus: trx.paymentStatus,
        customerName: trx.customerName || undefined,
        dueDate: trx.dueDate || undefined,
        totalAmount: trx.totalAmount,
        discount: trx.discount || 0,
        finalAmount: trx.finalAmount,
        cashGiven: trx.cashGiven !== undefined ? trx.cashGiven : (trx.paymentMethod === "CREDIT" ? 0 : trx.finalAmount),
        changeGiven: trx.changeGiven || 0,
        items: (trx.rawItems || []).map((it) => ({
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
        text: `Struk #${trx.invoiceNumber} (${copies}x rangkap) berhasil dicetak ulang!`,
      });
      setTimeout(() => setPrintFeedback(null), 4000);
    } catch (err: any) {
      setPrintFeedback({ type: "error", text: err.message || "Gagal mencetak ulang struk." });
    } finally {
      setPrinting(false);
    }
  };

  const openDetailModal = (trx: TransactionRecord) => {
    setSelectedTransaction(trx);
    setIsDetailModalOpen(true);
    setPrintFeedback(null);
  };

  const openSettleModal = (trx: TransactionRecord) => {
    setSelectedSettleTrx(trx);
    setSettlePaidMethod("CASH");
    setSettleNotes("");
    setIsSettleModalOpen(true);
  };

  const handleSettleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSettleTrx || settleLoading) return;

    setSettleLoading(true);
    try {
      const res = await fetch(`/api/sales/${selectedSettleTrx.id}/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paidMethod: settlePaidMethod,
          notes: settleNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memproses pelunasan");

      setIsSettleModalOpen(false);
      setSelectedSettleTrx(null);
      setPrintFeedback({
        type: "success",
        text: `Nota #${selectedSettleTrx.invoiceNumber} berhasil dilunasi!`,
      });
      setTimeout(() => setPrintFeedback(null), 4000);

      if (selectedTransaction?.id === selectedSettleTrx.id) {
        setSelectedTransaction((prev) =>
          prev
            ? {
                ...prev,
                paymentStatus: "PAID",
                cashGiven: prev.finalAmount,
                paidAt: new Date().toISOString(),
                paidMethod: settlePaidMethod,
              }
            : null
        );
      }

      fetchTransactions();
    } catch (err: any) {
      alert(err.message || "Gagal mencatat pelunasan");
    } finally {
      setSettleLoading(false);
    }
  };

  // Load Catalog Products & Vouchers
  const loadCatalog = async () => {
    if (isCatalogLoaded) return;
    try {
      const [pRes, vRes] = await Promise.all([
        fetch("/api/products"),
        fetch("/api/vouchers"),
      ]);
      const pData = await pRes.json();
      const vData = await vRes.json();
      setCatalogProducts(pData.products || []);
      setCatalogVouchers(vData.vouchers || []);
      setIsCatalogLoaded(true);
    } catch (err) {
      console.error("Gagal memuat katalog untuk edit:", err);
    }
  };

  // Open Edit Modal
  const openEditModal = (trx: TransactionRecord) => {
    loadCatalog();
    setSelectedEditTrx(trx);
    setEditPaymentMethod(
      ["CASH", "TRANSFER", "QRIS", "CREDIT"].includes(trx.paymentMethod)
        ? (trx.paymentMethod as any)
        : "CASH"
    );
    setEditDiscount(trx.discount || 0);
    setEditCashGiven(trx.cashGiven ?? trx.finalAmount);
    setEditCustomerName(trx.customerName || "");
    setEditCustomerPhone(trx.customerPhone || "");
    setEditNotes(trx.notes || "");
    setEditError(null);

    const items: EditItemState[] = (trx.rawItems || []).map((it) => ({
      id: it.id,
      itemType: (it.itemType === "VOUCHER" ? "VOUCHER" : "PRODUCT") as "PRODUCT" | "VOUCHER",
      productId: it.productId || null,
      voucherId: it.voucherId || null,
      itemName: it.itemName,
      quantity: it.quantity || 1,
      unitPrice: it.unitPrice || 0,
      subtotal: (it.quantity || 1) * (it.unitPrice || 0),
    }));

    setEditItems(items);
    setSelectedCatalogItemKey("");
    setIsEditModalOpen(true);
  };

  // Add Item to Edit List from Catalog
  const handleAddCatalogItem = () => {
    if (!selectedCatalogItemKey) return;
    const [type, id] = selectedCatalogItemKey.split(":");
    if (type === "PRODUCT") {
      const prod = catalogProducts.find((p) => p.id === id);
      if (!prod) return;
      setEditItems((prev) => [
        ...prev,
        {
          itemType: "PRODUCT",
          productId: prod.id,
          voucherId: null,
          itemName: prod.name,
          quantity: 1,
          unitPrice: prod.sellingPrice || 0,
          subtotal: prod.sellingPrice || 0,
        },
      ]);
    } else if (type === "VOUCHER") {
      const vc = catalogVouchers.find((v) => v.id === id);
      if (!vc) return;
      setEditItems((prev) => [
        ...prev,
        {
          itemType: "VOUCHER",
          productId: null,
          voucherId: vc.id,
          itemName: `${vc.operator} ${vc.nominal}`,
          quantity: 1,
          unitPrice: vc.sellingPrice || 0,
          subtotal: vc.sellingPrice || 0,
        },
      ]);
    }
    setSelectedCatalogItemKey("");
  };

  const updateItemQuantity = (index: number, newQty: number) => {
    if (newQty < 1) return;
    setEditItems((prev) =>
      prev.map((item, idx) =>
        idx === index
          ? {
              ...item,
              quantity: newQty,
              subtotal: newQty * item.unitPrice,
            }
          : item
      )
    );
  };

  const updateItemPrice = (index: number, newPrice: number) => {
    const safePrice = isNaN(newPrice) || newPrice < 0 ? 0 : newPrice;
    setEditItems((prev) =>
      prev.map((item, idx) =>
        idx === index
          ? {
              ...item,
              unitPrice: safePrice,
              subtotal: item.quantity * safePrice,
            }
          : item
      )
    );
  };

  const removeItem = (index: number) => {
    if (editItems.length <= 1) {
      alert("Transaksi harus memiliki minimal 1 item. Jika ingin membatalkan semua, gunakan fitur Batalkan Transaksi.");
      return;
    }
    setEditItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Submit Edit Transaction
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEditTrx || editLoading) return;
    if (editItems.length === 0) {
      setEditError("Transaksi harus memiliki minimal 1 item.");
      return;
    }

    setEditLoading(true);
    setEditError(null);

    const calculatedSubtotal = editItems.reduce((acc, it) => acc + it.subtotal, 0);
    const calculatedFinal = Math.max(0, calculatedSubtotal - (editDiscount || 0));

    try {
      const payload = {
        items: editItems.map((it) => ({
          id: it.id,
          itemType: it.itemType,
          productId: it.productId,
          voucherId: it.voucherId,
          itemName: it.itemName,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
        })),
        discount: Number(editDiscount) || 0,
        paymentMethod: editPaymentMethod,
        cashGiven:
          editPaymentMethod === "CASH"
            ? Number(editCashGiven) || 0
            : editPaymentMethod === "CREDIT"
            ? Number(editCashGiven) || 0
            : calculatedFinal,
        customerName: editCustomerName.trim() || null,
        customerPhone: editCustomerPhone.trim() || null,
        notes: editNotes.trim() || null,
      };

      const res = await fetch(`/api/sales/${selectedEditTrx.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal memperbarui transaksi");
      }

      setIsEditModalOpen(false);
      setSelectedEditTrx(null);
      setPrintFeedback({
        type: "success",
        text: `Transaksi #${data.sale?.invoiceNumber || selectedEditTrx.invoiceNumber} berhasil diperbarui! Stok & laporan tersinkron.`,
      });
      setTimeout(() => setPrintFeedback(null), 4000);

      // Refresh table
      fetchTransactions();
      if (selectedTransaction?.id === selectedEditTrx.id) {
        setSelectedTransaction(null);
        setIsDetailModalOpen(false);
      }
    } catch (err: any) {
      setEditError(err.message || "Gagal memperbarui transaksi.");
    } finally {
      setEditLoading(false);
    }
  };

  // Open Cancel Modal
  const openCancelModal = (trx: TransactionRecord) => {
    setSelectedCancelTrx(trx);
    setCancelReason("");
    setCancelError(null);
    setIsCancelModalOpen(true);
  };

  // Submit Cancel Transaction
  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCancelTrx || cancelLoading) return;

    setCancelLoading(true);
    setCancelError(null);

    try {
      const res = await fetch(`/api/sales/${selectedCancelTrx.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal membatalkan transaksi");
      }

      setIsCancelModalOpen(false);
      setSelectedCancelTrx(null);
      setPrintFeedback({
        type: "success",
        text: `Transaksi #${selectedCancelTrx.invoiceNumber} berhasil DIBATALKAN. Stok telah dikembalikan ke etalase & laporan telah disesuaikan!`,
      });
      setTimeout(() => setPrintFeedback(null), 5000);

      fetchTransactions();
      if (selectedTransaction?.id === selectedCancelTrx.id) {
        setSelectedTransaction(null);
        setIsDetailModalOpen(false);
      }
    } catch (err: any) {
      setCancelError(err.message || "Gagal membatalkan transaksi.");
    } finally {
      setCancelLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 mb-1">
            <History className="w-6 h-6" />
            <span className="text-xs font-bold uppercase tracking-wider bg-indigo-50 px-2.5 py-0.5 rounded-full">
              Audit & Penjualan
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Riwayat Transaksi
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Pencatatan faktur penjualan kasir & transaksi digital dengan filter tanggal, metode bayar, dan cetak ulang struk.
          </p>
        </div>

        {/* Refresh button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchTransactions()}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 rounded-2xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-600" : ""}`} />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {/* Top Quick Tabs: POS vs Digital */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          onClick={() => {
            setTrxType("POS");
            setPage(1);
          }}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
            trxType === "POS"
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>Penjualan Kasir (POS)</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] ${
              trxType === "POS" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            {trxType === "POS" ? summary.totalCount : "POS"}
          </span>
        </button>

        <button
          onClick={() => {
            setTrxType("DIGITAL");
            setPage(1);
          }}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
            trxType === "DIGITAL"
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <SmartphoneNfc className="w-4 h-4" />
          <span>Transaksi Produk Digital</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] ${
              trxType === "DIGITAL" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            {trxType === "DIGITAL" ? summary.totalCount : "Digital"}
          </span>
        </button>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Transaksi */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Transaksi
            </span>
            <div className="w-9 h-9 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-slate-900">
              {summary.totalCount.toLocaleString("id-ID")}
            </span>
            <span className="text-xs text-slate-400 ml-1 font-semibold">Nota/Trx</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Sesuai rentang filter aktif</p>
        </div>

        {/* Card 2: Total Nilai / Omzet */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Omzet / Nilai
            </span>
            <div className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xl sm:text-2xl font-black text-emerald-700">
              {formatRupiah(summary.totalRevenue)}
            </span>
          </div>
          {summary.totalDiscount > 0 && (
            <p className="text-[11px] text-rose-500 font-medium mt-1">
              Diskon Diberikan: {formatRupiah(summary.totalDiscount)}
            </p>
          )}
          {summary.creditAmount !== undefined && summary.creditAmount > 0 && (
            <p className="text-[11px] text-amber-600 font-semibold mt-1">
              Piutang Belum Lunas: {formatRupiah(summary.creditAmount)}
            </p>
          )}
        </div>

        {/* Card 3: Tunai (CASH) */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Pembayaran Tunai (CASH)
            </span>
            <div className="w-9 h-9 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center">
              <Banknote className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xl sm:text-2xl font-black text-slate-900">
              {formatRupiah(summary.cashAmount)}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Uang fisik di laci kasir (termasuk nota tunai)</p>
        </div>

        {/* Card 4: Non-Tunai (QRIS & Transfer) */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Non-Tunai (QRIS/Bank)
            </span>
            <div className="w-9 h-9 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center">
              <QrCode className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xl sm:text-2xl font-black text-purple-900">
              {formatRupiah(summary.transferAmount + summary.qrisAmount)}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            QRIS: {formatRupiah(summary.qrisAmount)} | Transfer: {formatRupiah(summary.transferAmount)}
          </p>
        </div>
      </div>

      {/* Filter Control Box */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
        {/* Row 1: Search & Payment Method Filter */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search Bar */}
          <div className="md:col-span-7 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari no. faktur, nama pelanggan, kasir, atau produk..."
              className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-1"
              >
                ✕
              </button>
            )}
          </div>

          {/* Payment Method Selector (For POS) */}
          <div className="md:col-span-5">
            {trxType === "POS" ? (
              <div className="flex items-center gap-1.5 bg-slate-50 p-1 border border-slate-200 rounded-2xl text-xs">
                <span className="text-[11px] text-slate-400 pl-2 font-bold flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Metode:</span>
                </span>
                <button
                  onClick={() => {
                    setPaymentMethod("ALL");
                    setPage(1);
                  }}
                  className={`flex-1 py-1.5 rounded-xl font-bold transition-all text-center ${
                    paymentMethod === "ALL"
                      ? "bg-white text-slate-900 shadow-sm border border-slate-200/60"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  Semua
                </button>
                <button
                  onClick={() => {
                    setPaymentMethod("CASH");
                    setPage(1);
                  }}
                  className={`flex-1 py-1.5 rounded-xl font-bold transition-all text-center ${
                    paymentMethod === "CASH"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  Tunai
                </button>
                <button
                  onClick={() => {
                    setPaymentMethod("QRIS");
                    setPage(1);
                  }}
                  className={`flex-1 py-1.5 rounded-xl font-bold transition-all text-center ${
                    paymentMethod === "QRIS"
                      ? "bg-purple-600 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  QRIS
                </button>
                <button
                  onClick={() => {
                    setPaymentMethod("TRANSFER");
                    setPage(1);
                  }}
                  className={`flex-1 py-1.5 rounded-xl font-bold transition-all text-center ${
                    paymentMethod === "TRANSFER"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  Transfer
                </button>
                <button
                  onClick={() => {
                    setPaymentMethod("CREDIT");
                    setPage(1);
                  }}
                  className={`flex-1 py-1.5 rounded-xl font-bold transition-all text-center ${
                    paymentMethod === "CREDIT"
                      ? "bg-amber-600 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  Kredit/Nota
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-slate-50 p-1 border border-slate-200 rounded-2xl text-xs">
                <span className="text-[11px] text-slate-400 pl-2 font-bold flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Metode:</span>
                </span>
                <button
                  onClick={() => {
                    setPaymentMethod("ALL");
                    setPage(1);
                  }}
                  className={`flex-1 py-1.5 rounded-xl font-bold transition-all text-center ${
                    paymentMethod === "ALL"
                      ? "bg-white text-slate-900 shadow-sm border border-slate-200/60"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  Semua
                </button>
                <button
                  onClick={() => {
                    setPaymentMethod("CASH");
                    setPage(1);
                  }}
                  className={`flex-1 py-1.5 rounded-xl font-bold transition-all text-center ${
                    paymentMethod === "CASH"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  💵 Tunai
                </button>
                <button
                  onClick={() => {
                    setPaymentMethod("QRIS");
                    setPage(1);
                  }}
                  className={`flex-1 py-1.5 rounded-xl font-bold transition-all text-center ${
                    paymentMethod === "QRIS"
                      ? "bg-purple-600 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  📱 QRIS
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Date Filter Presets & Custom Date Range */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          {/* Quick Date Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-400 mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>Periode:</span>
            </span>

            {[
              { key: "today", label: "Hari Ini" },
              { key: "yesterday", label: "Kemarin" },
              { key: "7days", label: "7 Hari" },
              { key: "30days", label: "30 Hari" },
              { key: "thisMonth", label: "Bulan Ini" },
              { key: "all", label: "Semua Waktu" },
            ].map((p) => (
              <button
                key={p.key}
                onClick={() => applyDatePreset(p.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  datePreset === p.key
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom Date Pickers */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Dari:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDatePreset("custom");
                  setPage(1);
                }}
                className="bg-transparent border-none text-slate-800 text-xs font-semibold focus:outline-none cursor-pointer"
              />
            </div>
            <span className="text-slate-300 text-xs font-bold">-</span>
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Sampai:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDatePreset("custom");
                  setPage(1);
                }}
                className="bg-transparent border-none text-slate-800 text-xs font-semibold focus:outline-none cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Global Feedback Banner */}
      {printFeedback && (
        <div
          className={`p-4 rounded-2xl border text-xs flex items-center justify-between ${
            printFeedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {printFeedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-semibold">{printFeedback.text}</span>
          </div>
          <button
            onClick={() => setPrintFeedback(null)}
            className="text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Transactions Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        {error && (
          <div className="p-4 bg-rose-50 border-b border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-4">No. Faktur / Trx</th>
                <th className="py-3.5 px-4">Waktu Transaksi</th>
                <th className="py-3.5 px-4">Kasir</th>
                <th className="py-3.5 px-4">Kategori / Tujuan</th>
                <th className="py-3.5 px-4">Rincian Item</th>
                <th className="py-3.5 px-4">Metode Bayar</th>
                <th className="py-3.5 px-4 text-right">Total Tagihan</th>
                <th className="py-3.5 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin" />
                      <span className="font-semibold">Memuat riwayat transaksi...</span>
                    </div>
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Receipt className="w-10 h-10 text-slate-300" />
                      <p className="font-bold text-slate-700">Tidak ada transaksi ditemukan</p>
                      <p className="text-xs text-slate-400 max-w-sm">
                        Coba ubah rentang tanggal, filter metode pembayaran, atau kata kunci pencarian Anda.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                transactions.map((trx) => {
                  const date = new Date(trx.createdAt);
                  const dateStr = date.toLocaleDateString("id-ID", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  });
                  const timeStr = date.toLocaleTimeString("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <tr
                      key={trx.id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* Faktur Number */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="text-indigo-600">#</span>
                          <span>{trx.invoiceNumber}</span>
                        </div>
                      </td>

                      {/* Date & Time */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-medium text-slate-900">{dateStr}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{timeStr} WIB</div>
                        {trx.paymentMethod === "CREDIT" && trx.paidAt && trx.paymentStatus === "PAID" && (
                          <div className="text-[9px] text-emerald-600 font-semibold flex items-center gap-0.5 mt-0.5">
                            <span>Lunas:</span>
                            <span>
                              {new Date(trx.paidAt).toLocaleDateString("id-ID", {
                                day: "numeric",
                                month: "short",
                              })}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Cashier */}
                      <td className="py-3.5 px-4 font-medium text-slate-700 whitespace-nowrap">
                        {trx.cashier?.name || "Kasir"}
                      </td>

                      {/* Category / Destination */}
                      <td className="py-3.5 px-4">
                        {trx.destinationNumber ? (
                          <div className="text-xs text-indigo-700 font-mono font-bold flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            <span>{trx.destinationNumber}</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-start gap-0.5">
                            <span className="text-[11px] text-slate-600 font-semibold bg-slate-100 px-2 py-0.5 rounded-md">
                              Kasir POS
                            </span>
                            {trx.customerName && (
                              <span className="text-[10px] text-slate-500 font-medium truncate max-w-[140px]" title={trx.customerName}>
                                Pelanggan: <strong className="text-slate-800">{trx.customerName}</strong>
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Items Summary */}
                      <td className="py-3.5 px-4">
                        {trx.rawItems && trx.rawItems.length > 0 ? (
                          <div className="max-w-[200px] truncate text-slate-600" title={trx.rawItems.map(i => `${i.itemName} (x${i.quantity})`).join(", ")}>
                            <span className="font-medium text-slate-800">
                              {trx.rawItems[0]?.itemName}
                            </span>
                            {trx.rawItems.length > 1 && (
                              <span className="text-[10px] text-slate-400 ml-1 font-bold">
                                +{trx.rawItems.length - 1} item lain
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Payment Method Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {trx.paymentStatus === "CANCELLED" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-extrabold shadow-sm">
                            <Ban className="w-3 h-3" />
                            <span>DIBATALKAN</span>
                          </span>
                        ) : trx.paymentMethod === "CASH" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold">
                            <Banknote className="w-3 h-3" />
                            <span>TUNAI</span>
                          </span>
                        ) : trx.paymentMethod === "QRIS" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-extrabold">
                            <QrCode className="w-3 h-3" />
                            <span>QRIS</span>
                          </span>
                        ) : trx.paymentMethod === "CREDIT" ? (
                          <div className="flex flex-col gap-1 items-start">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-50 text-amber-800 border border-amber-300 text-[10px] font-extrabold shadow-sm">
                              <FileText className="w-3 h-3 text-amber-600" />
                              <span>KREDIT / NOTA</span>
                            </span>
                            {trx.paymentStatus === "PAID" ? (
                              <span className="text-[9px] font-bold text-emerald-600 pl-1">
                                ● Lunas {trx.paidMethod ? `(${trx.paidMethod === "CASH" ? "Tunai/Laci" : trx.paidMethod})` : "(Tunai/Laci)"}
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold text-rose-600 pl-1">
                                ● {trx.paymentStatus === "PARTIAL" ? "Sisa Sebagian" : "Belum Lunas"}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-extrabold">
                            <CreditCard className="w-3 h-3" />
                            <span>TRANSFER</span>
                          </span>
                        )}
                      </td>

                      {/* Total Amount */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap font-extrabold">
                        {trx.paymentStatus === "CANCELLED" ? (
                          <div>
                            <span className="text-slate-400 line-through text-xs">{formatRupiah(trx.finalAmount)}</span>
                            <div className="text-[10px] text-rose-600 font-bold">Dibatalkan / Void</div>
                          </div>
                        ) : (
                          <>
                            <span className="text-slate-900">{formatRupiah(trx.finalAmount)}</span>
                            {trx.discount > 0 && (
                              <div className="text-[10px] text-rose-500 font-semibold">
                                Hemat {formatRupiah(trx.discount)}
                              </div>
                            )}
                          </>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Settle button for unpaid credit sales */}
                          {trx.paymentStatus !== "CANCELLED" && trx.paymentMethod === "CREDIT" && trx.paymentStatus !== "PAID" && (
                            <button
                              type="button"
                              onClick={() => openSettleModal(trx)}
                              title="Catat Pelunasan Nota"
                              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                            >
                              <Coins className="w-3.5 h-3.5" />
                              <span>Pelunasan</span>
                            </button>
                          )}

                          {/* Detail Button */}
                          <button
                            type="button"
                            onClick={() => openDetailModal(trx)}
                            title="Lihat Nota & Rincian"
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 rounded-xl transition-all cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {trx.paymentStatus !== "CANCELLED" ? (
                            <>
                              {/* Reprint Thermal Receipt Button */}
                              <button
                                type="button"
                                onClick={() => handleReprintThermal(trx)}
                                disabled={printing}
                                title="Cetak Ulang Struk Thermal (1-Klik)"
                                className="p-1.5 bg-indigo-50 hover:bg-indigo-100 active:scale-95 text-indigo-700 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                              >
                                <Printer className="w-4 h-4" />
                              </button>

                              {/* Edit Button (POS only) */}
                              {trx.trxType === "POS" && (
                                <button
                                  type="button"
                                  onClick={() => openEditModal(trx)}
                                  title="Edit Transaksi (Item, Harga, Metode Bayar)"
                                  className="p-1.5 bg-amber-50 hover:bg-amber-100 active:scale-95 text-amber-700 rounded-xl transition-all cursor-pointer"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                              )}

                              {/* Cancel / Void Button (POS only) */}
                              {trx.trxType === "POS" && (
                                <button
                                  type="button"
                                  onClick={() => openCancelModal(trx)}
                                  title="Batalkan Transaksi / Retur Total"
                                  className="p-1.5 bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 rounded-xl transition-all cursor-pointer"
                                >
                                  <Ban className="w-4 h-4" />
                                </button>
                              )}
                            </>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-400 px-2 py-1 bg-slate-100 rounded-xl">
                              Nonaktif
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

        {/* Pagination Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-slate-100 bg-slate-50/50">
          {/* Info: Showing X to Y of Z */}
          <div className="text-xs text-slate-500 font-medium">
            Menampilkan{" "}
            <span className="font-bold text-slate-800">
              {pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1}
            </span>{" "}
            -{" "}
            <span className="font-bold text-slate-800">
              {Math.min(pagination.page * pagination.limit, pagination.total)}
            </span>{" "}
            dari <span className="font-bold text-slate-800">{pagination.total}</span> transaksi
          </div>

          {/* Limit and Page navigation */}
          <div className="flex items-center gap-3">
            {/* Limit Selector */}
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <span>Per Halaman:</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-white border border-slate-200 rounded-xl px-2 py-1 font-bold text-slate-700 text-xs focus:outline-none cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>

            {/* Prev & Next Buttons */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={!pagination.hasPrev || loading}
                className="p-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-3 py-1 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 shadow-sm">
                Halaman {pagination.page} / {pagination.totalPages || 1}
              </span>

              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={!pagination.hasNext || loading}
                className="p-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* DETAIL TRANSAKSI & STRUK MODAL */}
      {isDetailModalOpen && selectedTransaction && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            {/* Modal Top Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Rincian Transaksi</h3>
                <p className="text-xs text-slate-400 font-mono">#{selectedTransaction.invoiceNumber}</p>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 font-bold transition-all"
              >
                ✕
              </button>
            </div>

            {/* Print Feedback inside modal */}
            {printFeedback && (
              <div
                className={`p-3 rounded-2xl text-xs flex items-center gap-2 ${
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

            {/* Visual Thermal Receipt Preview */}
            <div
              id="printable-receipt"
              className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs font-mono space-y-2 text-slate-700"
            >
              {selectedTransaction.paymentStatus === "CANCELLED" && (
                <div className="p-2.5 bg-rose-100 border border-rose-300 rounded-xl text-rose-800 text-center font-bold text-xs uppercase tracking-wider mb-2">
                  ⚠️ TRANSAKSI INI TELAH DIBATALKAN (VOID)
                </div>
              )}

              {/* Receipt Store Header */}
              <div className="text-center pb-2 border-b border-dashed border-slate-300">
                <p className="font-bold text-sm text-slate-900">{storeSetting.name}</p>
                {storeSetting.tagline && (
                  <p className="text-[10px] text-slate-600 font-semibold">{storeSetting.tagline}</p>
                )}
                {storeSetting.address && (
                  <p className="text-[10px] text-slate-500">{storeSetting.address}</p>
                )}
                {storeSetting.phone && (
                  <p className="text-[10px] text-slate-500">Telp/WA: {storeSetting.phone}</p>
                )}
                <p className="text-[10px] text-slate-500 font-bold mt-1">
                  {selectedTransaction.invoiceNumber}
                </p>
              </div>

              {/* Transaction Metadata */}
              <div className="flex justify-between text-[11px]">
                <span>Kasir: {selectedTransaction.cashier?.name || user.name}</span>
                <span>
                  {new Date(selectedTransaction.createdAt).toLocaleDateString("id-ID", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}{" "}
                  {new Date(selectedTransaction.createdAt).toLocaleTimeString("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>

              {selectedTransaction.customerName && (
                <div className="flex justify-between text-[11px] font-bold text-indigo-700">
                  <span>Pelanggan:</span>
                  <span>{selectedTransaction.customerName}</span>
                </div>
              )}

              {/* Items List */}
              <div className="py-2 border-y border-dashed border-slate-300 space-y-1.5">
                {selectedTransaction.rawItems?.map((item, idx) => (
                  <div key={idx} className="space-y-0.5">
                    <div className="font-bold text-slate-800">{item.itemName}</div>
                    <div className="flex justify-between text-[11px] text-slate-600">
                      <span>
                        {item.quantity} x {formatRupiah(item.unitPrice)}
                      </span>
                      <span className="font-bold text-slate-900">{formatRupiah(item.subtotal)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals Calculation */}
              <div className="space-y-1 pt-1 text-[11px]">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{formatRupiah(selectedTransaction.totalAmount)}</span>
                </div>
                {selectedTransaction.discount > 0 && (
                  <div className="flex justify-between text-rose-600 font-semibold">
                    <span>Diskon:</span>
                    <span>-{formatRupiah(selectedTransaction.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-xs text-slate-900 pt-1 border-t border-slate-200">
                  <span>TOTAL TAGIHAN:</span>
                  <span>{formatRupiah(selectedTransaction.finalAmount)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>
                    Metode: {selectedTransaction.paymentMethod === "CREDIT" ? "KREDIT / NOTA" : selectedTransaction.paymentMethod}
                  </span>
                  <span>
                    {selectedTransaction.paymentMethod === "CREDIT"
                      ? `DP/Bayar: ${formatRupiah(selectedTransaction.cashGiven || 0)}`
                      : `Bayar: ${formatRupiah(selectedTransaction.cashGiven || selectedTransaction.finalAmount)}`}
                  </span>
                </div>
                {selectedTransaction.paymentMethod === "CREDIT" && (
                  <div className="space-y-0.5 pt-1 border-t border-slate-200">
                    {selectedTransaction.customerName && (
                      <div className="flex justify-between text-slate-700">
                        <span>Pelanggan:</span>
                        <span className="font-bold">{selectedTransaction.customerName}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-amber-800">
                      <span>Status Pembayaran:</span>
                      <span className={selectedTransaction.paymentStatus === "PAID" ? "text-emerald-700" : "text-rose-600"}>
                        {selectedTransaction.paymentStatus === "PAID" ? "LUNAS" : "BELUM LUNAS"}
                      </span>
                    </div>
                    {selectedTransaction.paymentStatus === "PAID" && (
                      <div className="flex justify-between text-slate-700 text-xs">
                        <span>Penerimaan Dana:</span>
                        <span className="font-bold text-emerald-700">
                          {(selectedTransaction.paidMethod || "CASH") === "CASH"
                            ? "TUNAI (Masuk Kas Laci)"
                            : (selectedTransaction.paidMethod || "CASH") === "QRIS"
                            ? "QRIS (Masuk Bank/E-Wallet)"
                            : `${selectedTransaction.paidMethod} (Masuk Bank)`}
                        </span>
                      </div>
                    )}
                    {selectedTransaction.paymentStatus !== "PAID" && (
                      <div className="space-y-1.5">
                        <div className="flex justify-between font-bold text-rose-600">
                          <span>Sisa Tagihan:</span>
                          <span>{formatRupiah(Math.max(0, selectedTransaction.finalAmount - (selectedTransaction.cashGiven || 0)))}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => openSettleModal(selectedTransaction)}
                          className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer mt-1"
                        >
                          <Coins className="w-3.5 h-3.5" />
                          <span>Pelunasan Nota Ini</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {selectedTransaction.paymentMethod === "CASH" && (
                  <div className="flex justify-between font-bold text-emerald-700">
                    <span>Kembalian:</span>
                    <span>{formatRupiah(selectedTransaction.changeGiven || 0)}</span>
                  </div>
                )}
              </div>

              {/* Footer Note */}
              <div className="text-center pt-2 text-[10px] text-slate-500 border-t border-dashed border-slate-300 whitespace-pre-line leading-tight">
                {storeSetting.receiptFooter || "Terima kasih atas kunjungan Anda!\nBarang yang dibeli tidak dapat ditukar/dikembalikan."}
              </div>
            </div>

            {/* Paper Width & Printer Status Selector */}
            <div className="flex items-center justify-between px-1 text-xs">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <span
                  className={`w-2 h-2 rounded-full ${
                    printerConnected ? "bg-emerald-500" : "bg-slate-300"
                  }`}
                ></span>
                <span className="truncate max-w-[160px] font-semibold">
                  {printerConnected ? "Printer Siap Cetak" : "Printer Belum Terhubung"}
                </span>
              </div>
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setPaperWidth("58mm")}
                  className={`px-1.5 py-0.5 rounded ${
                    paperWidth === "58mm" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                  }`}
                >
                  58mm
                </button>
                <button
                  type="button"
                  onClick={() => setPaperWidth("80mm")}
                  className={`px-1.5 py-0.5 rounded ${
                    paperWidth === "80mm" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                  }`}
                >
                  80mm
                </button>
              </div>
            </div>

            {/* Print Action Buttons */}
            <div className="space-y-2 pt-1">
              {selectedTransaction.paymentStatus !== "CANCELLED" && selectedTransaction.trxType === "POS" && (
                <div className="grid grid-cols-2 gap-2 pb-1">
                  <button
                    type="button"
                    onClick={() => {
                      const t = selectedTransaction;
                      setIsDetailModalOpen(false);
                      openEditModal(t);
                    }}
                    className="py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit Transaksi</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const t = selectedTransaction;
                      setIsDetailModalOpen(false);
                      openCancelModal(t);
                    }}
                    className="py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>Batalkan Transaksi</span>
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => handleReprintThermal(selectedTransaction)}
                disabled={printing}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white rounded-2xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 transition-all cursor-pointer disabled:opacity-50"
              >
                <Printer className={`w-4 h-4 ${printing ? "animate-pulse" : ""}`} />
                <span>
                  {printing
                    ? "Mengirim ke Printer..."
                    : `Cetak Ulang Struk Thermal (${storeSetting.printCopies}x Rangkap)`}
                </span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Dialog Browser</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsDetailModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PELUNASAN PIUTANG NOTA */}
      {isSettleModalOpen && selectedSettleTrx && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">Pelunasan Piutang Nota</h3>
                  <p className="text-xs text-slate-400 font-mono">{selectedSettleTrx.invoiceNumber}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSettleModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSettleSubmit} className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Nama Pelanggan:</span>
                  <span className="font-extrabold text-slate-900">{selectedSettleTrx.customerName || "Pelanggan"}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1.5 font-bold">
                  <span className="text-slate-700">Total Tagihan:</span>
                  <span>{formatRupiah(selectedSettleTrx.finalAmount)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Sudah Dibayar (DP):</span>
                  <span>{formatRupiah(selectedSettleTrx.cashGiven || 0)}</span>
                </div>
                <div className="flex justify-between text-rose-600 font-black text-sm border-t border-dashed border-rose-200 pt-1.5">
                  <span>Sisa Wajib Dibayar:</span>
                  <span>{formatRupiah(Math.max(0, selectedSettleTrx.finalAmount - (selectedSettleTrx.cashGiven || 0)))}</span>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Metode Pembayaran Pelunasan
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSettlePaidMethod("CASH")}
                    className={`py-2 px-1 rounded-xl text-xs font-bold border flex flex-col items-center gap-1 transition-all ${
                      settlePaidMethod === "CASH"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-800 shadow-sm"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Banknote className="w-4 h-4" />
                    <span>Tunai</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSettlePaidMethod("TRANSFER")}
                    className={`py-2 px-1 rounded-xl text-xs font-bold border flex flex-col items-center gap-1 transition-all ${
                      settlePaidMethod === "TRANSFER"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-800 shadow-sm"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Transfer</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSettlePaidMethod("QRIS")}
                    className={`py-2 px-1 rounded-xl text-xs font-bold border flex flex-col items-center gap-1 transition-all ${
                      settlePaidMethod === "QRIS"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-800 shadow-sm"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <QrCode className="w-4 h-4" />
                    <span>QRIS</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Catatan Pelunasan (Opsional)
                </label>
                <input
                  type="text"
                  value={settleNotes}
                  onChange={(e) => setSettleNotes(e.target.value)}
                  placeholder="Contoh: Diterima lunas oleh kasir"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsSettleModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={settleLoading}
                  className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow disabled:opacity-50 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{settleLoading ? "Memproses..." : "Konfirmasi Pelunasan"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDIT TRANSAKSI (PRODUK, HARGA, METODE BAYAR) */}
      {isEditModalOpen && selectedEditTrx && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 p-6 space-y-5 animate-in zoom-in-95 max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-lg">Edit Transaksi Kasir</h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Nota #{selectedEditTrx.invoiceNumber}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 font-bold transition-all"
              >
                ✕
              </button>
            </div>

            {/* Notice / Warning */}
            <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-xs text-amber-800">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Penyesuaian Otomatis Stok & Laporan</p>
                <p className="text-amber-700 text-[11px] mt-0.5">
                  Perubahan item produk, kuantitas, harga, dan metode pembayaran akan langsung mengembalikan stok barang lama, memotong stok baru, serta menyinkronkan laporan laba rugi dan kas laci.
                </p>
              </div>
            </div>

            {editError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-5">
              {/* Bagian 1: Daftar Item Transaksi */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <ShoppingCart className="w-4 h-4 text-indigo-600" />
                    <span>Daftar Produk / Item ({editItems.length})</span>
                  </label>
                </div>

                <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                  {editItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              item.itemType === "VOUCHER"
                                ? "bg-purple-100 text-purple-700"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {item.itemType}
                          </span>
                          <span className="font-bold text-slate-800 truncate" title={item.itemName}>
                            {item.itemName}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Stepper Quantity */}
                        <div className="flex items-center border border-slate-200 rounded-xl bg-white overflow-hidden shadow-sm">
                          <button
                            type="button"
                            onClick={() => updateItemQuantity(idx, item.quantity - 1)}
                            className="p-1.5 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                            title="Kurangi Kuantitas"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) => updateItemQuantity(idx, parseInt(e.target.value) || 1)}
                            className="w-12 text-center text-xs font-bold text-slate-800 focus:outline-none border-x border-slate-200 py-1"
                          />
                          <button
                            type="button"
                            onClick={() => updateItemQuantity(idx, item.quantity + 1)}
                            className="p-1.5 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                            title="Tambah Kuantitas"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Input Unit Price */}
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] text-slate-400 font-bold">@Rp</span>
                          <input
                            type="number"
                            min={0}
                            value={item.unitPrice}
                            onChange={(e) => updateItemPrice(idx, parseFloat(e.target.value) || 0)}
                            className="w-24 px-2 py-1 text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-right"
                            title="Harga Satuan"
                          />
                        </div>

                        {/* Subtotal */}
                        <div className="w-24 text-right font-black text-slate-900 text-xs">
                          {formatRupiah(item.subtotal)}
                        </div>

                        {/* Remove item button */}
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                          title="Hapus Item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Dropdown Tambah Item dari Katalog */}
                <div className="p-3 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex flex-col sm:flex-row items-center gap-2">
                  <div className="flex-1 w-full">
                    <select
                      value={selectedCatalogItemKey}
                      onChange={(e) => setSelectedCatalogItemKey(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">+ Tambah Produk / Voucher Lain ke Transaksi Ini...</option>
                      <optgroup label="Produk Fisik / Aksesoris">
                        {catalogProducts.map((p) => (
                          <option key={`p_${p.id}`} value={`PRODUCT:${p.id}`}>
                            {p.name} (Stok: {p.stock}) - {formatRupiah(p.sellingPrice)}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Voucher Fisik">
                        {catalogVouchers.map((v) => (
                          <option key={`v_${v.id}`} value={`VOUCHER:${v.id}`}>
                            {v.operator} {v.nominal} (Stok: {v.stock}) - {formatRupiah(v.sellingPrice)}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddCatalogItem}
                    disabled={!selectedCatalogItemKey}
                    className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambahkan</span>
                  </button>
                </div>
              </div>

              {/* Bagian 2: Rincian Diskon & Total Tagihan */}
              {(() => {
                const subtotal = editItems.reduce((acc, it) => acc + it.subtotal, 0);
                const finalAmt = Math.max(0, subtotal - (editDiscount || 0));
                const change = editPaymentMethod === "CASH" ? Math.max(0, editCashGiven - finalAmt) : 0;

                return (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2 text-xs">
                    <div className="flex justify-between items-center text-slate-600">
                      <span>Subtotal Item:</span>
                      <span className="font-bold text-slate-800">{formatRupiah(subtotal)}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Diskon Transaksi (Rp):</span>
                      <input
                        type="number"
                        min={0}
                        value={editDiscount}
                        onChange={(e) => setEditDiscount(parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="w-28 px-2 py-1 text-xs font-bold text-rose-600 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 text-right"
                      />
                    </div>

                    <div className="flex justify-between items-center border-t border-slate-200 pt-2 font-black text-sm">
                      <span className="text-slate-900">Total Tagihan Baru:</span>
                      <span className="text-indigo-700 text-base">{formatRupiah(finalAmt)}</span>
                    </div>

                    {editPaymentMethod === "CASH" && (
                      <div className="space-y-1.5 pt-2 border-t border-dashed border-slate-200">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-600">Uang Tunai Diterima:</span>
                          <input
                            type="number"
                            min={0}
                            value={editCashGiven}
                            onChange={(e) => setEditCashGiven(parseFloat(e.target.value) || 0)}
                            className="w-32 px-2 py-1 text-xs font-bold text-slate-900 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 text-right"
                          />
                        </div>
                        <div className="flex justify-between items-center text-emerald-700 font-bold">
                          <span>Kembalian Kasir:</span>
                          <span>{formatRupiah(change)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Bagian 3: Metode Pembayaran */}
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Metode Pembayaran
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { key: "CASH", label: "TUNAI (Kas Laci)", icon: Banknote },
                    { key: "QRIS", label: "QRIS", icon: QrCode },
                    { key: "TRANSFER", label: "TRANSFER", icon: CreditCard },
                    { key: "CREDIT", label: "KREDIT / NOTA", icon: FileText },
                  ].map((m) => {
                    const Icon = m.icon;
                    const isSelected = editPaymentMethod === m.key;
                    return (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => {
                          setEditPaymentMethod(m.key as any);
                          if (m.key !== "CASH" && m.key !== "CREDIT") {
                            const subtotal = editItems.reduce((acc, it) => acc + it.subtotal, 0);
                            const finalAmt = Math.max(0, subtotal - (editDiscount || 0));
                            setEditCashGiven(finalAmt);
                          }
                        }}
                        className={`p-2.5 rounded-2xl border text-xs font-extrabold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                          isSelected
                            ? "bg-slate-900 text-white border-slate-900 shadow-md"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Bagian 4: Pelanggan & Catatan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nama Pelanggan (Opsional)
                  </label>
                  <input
                    type="text"
                    value={editCustomerName}
                    onChange={(e) => setEditCustomerName(e.target.value)}
                    placeholder="Contoh: Bpk. Joko"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    No. Telepon / WA (Opsional)
                  </label>
                  <input
                    type="text"
                    value={editCustomerPhone}
                    onChange={(e) => setEditCustomerPhone(e.target.value)}
                    placeholder="Contoh: 08123456789"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Catatan Transaksi / Alasan Perubahan
                </label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Contoh: Revisi ganti item & diskon pelanggan"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-5 py-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-600/25 disabled:opacity-50 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{editLoading ? "Menyimpan Perubahan..." : "Simpan Perubahan Transaksi"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PEMBATALAN TRANSAKSI (VOID / RETUR TOTAL) */}
      {isCancelModalOpen && selectedCancelTrx && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4 animate-in zoom-in-95">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <Ban className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-lg">Batalkan Transaksi (Void)</h3>
                  <p className="text-xs text-slate-400 font-mono">#{selectedCancelTrx.invoiceNumber}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 font-bold transition-all"
              >
                ✕
              </button>
            </div>

            {/* Warning Card */}
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-2 text-xs text-rose-800">
              <div className="flex items-center gap-2 font-bold text-rose-900">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Peringatan Pembatalan Transaksi</span>
              </div>
              <p className="text-[11px] leading-relaxed text-rose-700">
                Tindakan ini akan membatalkan faktur penjualan secara permanen. Sistem akan otomatis:
              </p>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-rose-700 pl-1 font-medium">
                <li>Mengembalikan seluruh stok barang / voucher ke etalase toko.</li>
                <li>Menghapus nilai nominal transaksi ({formatRupiah(selectedCancelTrx.finalAmount)}) dari perhitungan omzet & kas laci.</li>
                <li>Menyesuaikan laporan laba rugi dan rekap harian setoran.</li>
              </ul>
            </div>

            {/* Detail Snapshot */}
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Total Tagihan:</span>
                <span className="font-extrabold text-slate-900">{formatRupiah(selectedCancelTrx.finalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Metode Bayar:</span>
                <span className="font-bold text-slate-700">{selectedCancelTrx.paymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Jumlah Item:</span>
                <span className="font-bold text-slate-700">
                  {selectedCancelTrx.rawItems?.reduce((a, b) => a + b.quantity, 0) || 1} barang
                </span>
              </div>
            </div>

            {cancelError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{cancelError}</span>
              </div>
            )}

            <form onSubmit={handleCancelSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Alasan Pembatalan Transaksi
                </label>
                <input
                  type="text"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Contoh: Pelanggan keliru bawa barang / retur total"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCancelModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={cancelLoading}
                  className="px-5 py-2.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-lg shadow-rose-600/25 disabled:opacity-50 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Ban className="w-4 h-4" />
                  <span>{cancelLoading ? "Membatalkan Transaksi..." : "Ya, Batalkan Transaksi"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default TransactionsClient;

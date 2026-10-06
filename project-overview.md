# `project-overview.md`

# Project Overview — ChiCha Mobile Management System

## 1. Project Identity

**Nama Project:** ChiCha Mobile Management System
**Nama Toko:** ChiCha Mobile
**Jenis Sistem:** Sistem manajemen operasional toko mobile phone
**Target Pengguna:** Owner, Admin/Kasir, Teknisi

---

## 2. Tujuan Project

Membangun sistem internal untuk membantu ChiCha Mobile mencatat dan mengelola aktivitas utama toko:

1. Penjualan voucher HP.
2. Transaksi produk digital seperti pulsa, token listrik, paket data, dan voucher digital.
3. Penjualan dan pengelolaan stok aksesoris.
4. Pencatatan transaksi servis HP beserta perangkat, sparepart, total biaya, dan jasa servis.
5. Pengelolaan pelanggan.
6. Pencatatan pendapatan dan keuntungan.
7. Penyediaan laporan dan analisis bisnis.

Sistem harus menjadi pusat pencatatan operasional toko tanpa membuat workflow bisnis menjadi terlalu kompleks.

---

# 3. Prinsip Utama Sistem

Setiap jenis bisnis memiliki mekanisme pencatatan yang berbeda.

## 3.1 Voucher HP

Voucher merupakan stok fisik berdasarkan jumlah.

Pencatatan:

```text
Sisa Awal
+ Stok Masuk
- Voucher Terjual
= Sisa Akhir
```

Voucher dikelola berdasarkan:

```text
Operator
Nominal
Harga Modal
Harga Jual
Jumlah Stok
```

Sistem tidak perlu mencatat kode voucher individual.

---

## 3.2 Produk Digital

Produk digital tidak memiliki stok fisik.

Contoh:

* Pulsa
* Token listrik
* Paket data
* Voucher game
* Produk digital lainnya

Sistem mencatat:

```text
Produk
Provider
Nominal
Nomor tujuan / ID pelanggan
Harga modal
Harga jual
Status
Keuntungan
Tanggal transaksi
```

Status:

```text
PENDING
SUCCESS
FAILED
REFUNDED
```

Transaksi digital yang gagal tidak dihitung sebagai penjualan berhasil.

---

## 3.3 Aksesoris

Aksesoris merupakan inventory fisik.

Formula:

```text
Stok Awal
+ Barang Masuk
- Barang Terjual
+/- Adjustment
= Stok Akhir
```

Produk aksesoris dapat memiliki:

```text
SKU
Nama
Kategori
Brand
Harga Modal
Harga Jual
Stok
Minimum Stok
Supplier
```

---

## 3.4 Servis HP

Servis merupakan transaksi jasa yang membutuhkan pencatatan perangkat dan biaya.

Servis **tidak menggunakan konsep sisa servis**.

Setiap transaksi servis minimal mencatat:

```text
Pelanggan
Perangkat / HP
Keluhan
Diagnosa
Sparepart
Biaya Sparepart
Total Biaya
Jasa Servis
Status
Tanggal
Catatan
```

### Perhitungan jasa servis

```text
Jasa Servis =
Total Biaya Servis - Total Biaya Sparepart
```

Contoh:

```text
HP              : Samsung A54

Sparepart:
LCD             : Rp350.000

Total Biaya     : Rp500.000

Jasa Servis:
Rp500.000 - Rp350.000
= Rp150.000
```

Jika terdapat beberapa sparepart:

```text
LCD             Rp350.000
IC              Rp100.000
Konektor        Rp50.000
-------------------------
Total Sparepart Rp500.000

Total Biaya     Rp750.000

Jasa Servis     Rp250.000
```

Sistem harus menghitung jasa servis secara otomatis.

---

# 4. Modul Utama

## Dashboard

Menampilkan:

* Pendapatan hari ini.
* Jumlah transaksi.
* Gross profit.
* Penjualan voucher.
* Transaksi digital.
* Penjualan aksesoris.
* Jumlah servis.
* Pendapatan servis.
* Jasa servis.
* Stok menipis.
* Produk terlaris.

---

## Voucher Management

Mengelola:

* Operator.
* Nominal.
* Harga modal.
* Harga jual.
* Stok awal.
* Stok masuk.
* Voucher terjual.
* Sisa stok.
* Riwayat stok.

---

## Digital Transaction

Mengelola:

* Produk digital.
* Provider.
* Nominal.
* Nomor tujuan.
* Harga modal.
* Harga jual.
* Status.
* Keuntungan.
* Riwayat transaksi.

---

## Product & Inventory

Mengelola:

* Produk.
* Kategori.
* Brand.
* SKU.
* Harga modal.
* Harga jual.
* Stok.
* Minimum stok.
* Supplier.
* Riwayat stok.

---

## Sales

Mencatat:

* Voucher.
* Aksesoris.
* Produk fisik lainnya.
* Pelanggan.
* Pembayaran.

---

## Service Management

Mencatat:

* Pelanggan.
* HP/perangkat.
* Keluhan.
* Diagnosa.
* Sparepart.
* Biaya sparepart.
* Total biaya servis.
* Jasa servis.
* Status servis.
* Tanggal.
* Catatan.

Status servis dapat menggunakan:

```text
BARU
DIAGNOSA
DALAM PENGERJAAN
SELESAI
DIAMBIL
DIBATALKAN
```

Status tersebut hanya menunjukkan kondisi pekerjaan servis dan **bukan untuk menghitung sisa servis harian**.

---

## Customer Management

Mencatat:

* Nama.
* Nomor telepon.
* Alamat.
* Catatan.
* Histori pembelian.
* Histori digital transaction.
* Histori servis.

---

## Reports

Laporan:

* Penjualan.
* Voucher.
* Digital transaction.
* Inventory.
* Servis.
* Pendapatan jasa servis.
* Sparepart servis.
* Profit.
* Pembelian.
* Pengeluaran.

---

## Business Analytics

Tahap awal:

* Produk terlaris.
* Produk tidak bergerak.
* Margin produk.
* Tren penjualan.
* ABC Analysis.
* FSN Analysis.
* Analisis stok.
* Analisis kontribusi keuntungan.
* Analisis servis.
* Analisis pendapatan jasa servis.

---

# 5. User Roles

## Owner

Akses seluruh modul:

* Dashboard.
* Transaksi.
* Voucher.
* Digital.
* Produk.
* Inventory.
* Servis.
* Customer.
* Laporan.
* Analytics.
* Pengaturan.

## Admin/Kasir

Akses:

* Penjualan.
* Voucher.
* Digital transaction.
* Produk.
* Inventory sesuai permission.
* Customer.
* Pencatatan servis.

## Teknisi

Akses:

* Servis.
* Detail perangkat.
* Diagnosa.
* Sparepart.
* Update status servis.
* Catatan pengerjaan.

---

# 6. Data Flow

```text
Customer
   │
   ├── Sales
   │     ├── Voucher
   │     └── Accessories
   │
   ├── Digital Transactions
   │
   └── Service
         │
         ├── Device
         ├── Spareparts
         ├── Service Cost
         └── Service Fee

Sales ───────────────► Revenue
Digital ─────────────► Revenue
Service ─────────────► Service Revenue
Accessories ─────────► Inventory Movement
Voucher ─────────────► Voucher Stock Movement

All Data
   │
   ▼
Dashboard
   │
   ▼
Reports & Analytics
```

---

# 7. MVP Priority

## P0 — Wajib

* Authentication.
* Role & permission.
* Dashboard.
* Customer.
* Product.
* Category.
* Inventory.
* Voucher.
* Sales.
* Digital transaction.
* Service management.
* Basic reports.

## P1 — Penting

* Supplier.
* Purchase.
* Expense.
* Profit calculation.
* ABC Analysis.
* FSN Analysis.
* Service analytics.

## P2 — Pengembangan

* WhatsApp Gateway.
* PPOB/provider API.
* Payment gateway.
* Thermal printer.
* Barcode scanner.
* Advanced CRM.
* Advanced analytics.

---

# 8. Non-Goals

MVP bukan:

* ERP besar.
* Accounting double-entry penuh.
* Marketplace.
* Service center enterprise.
* Sistem voucher individual-code.
* Sistem monitoring sisa servis.

Fokus sistem adalah operasional dan pencatatan bisnis ChiCha Mobile.

---


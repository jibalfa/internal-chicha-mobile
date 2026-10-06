# `prd.md`

# Product Requirements Document — ChiCha Mobile Management System

## 1. Product Overview

ChiCha Mobile Management System adalah aplikasi internal untuk mengelola operasional toko.

Sistem memiliki empat aktivitas bisnis utama:

1. Voucher HP.
2. Transaksi digital.
3. Penjualan aksesoris.
4. Servis HP.

Sistem juga menyediakan:

* Customer management.
* Inventory.
* Payment/transaction records.
* Reports.
* Profit calculation.
* Business analytics.

---

# 2. User Roles

## Owner

Memiliki akses seluruh sistem.

## Admin/Kasir

Mengelola transaksi operasional toko.

## Teknisi

Mengelola dan memperbarui data servis.

---

# 3. Functional Requirements

## FR-01 Authentication

User dapat login sesuai akun dan role.

Sistem harus menerapkan authorization berdasarkan role.

---

# FR-02 Dashboard

Dashboard menampilkan:

```text
Today's Revenue
Today's Transactions
Gross Profit
Voucher Stock
Low Stock
Digital Transactions
Service Count
Service Revenue
Service Fee
```

---

# FR-03 Voucher Management

Voucher memiliki:

```text
Operator
Nominal
Cost
Selling Price
Stock
Minimum Stock
```

Sistem harus mencatat perubahan stok.

Formula:

```text
Closing Stock =
Opening Stock + Stock In - Sold
```

---

# FR-04 Voucher Sales

Ketika voucher terjual:

1. Buat transaksi.
2. Catat quantity.
3. Kurangi stok voucher.
4. Buat inventory/stock movement.
5. Hitung revenue.
6. Hitung profit.

---

# FR-05 Digital Products

Digital product memiliki:

```text
Provider
Product Name
Nominal
Cost
Selling Price
Status
```

Contoh:

```text
Telkomsel 10K
Token PLN 50K
Mobile Legends 86 Diamonds
```

Digital product tidak mengurangi physical inventory.

---

# FR-06 Digital Transaction

Field:

```text
Date
Customer
Product
Destination Number / Customer ID
Cost
Selling Price
Status
Notes
```

Status:

```text
PENDING
SUCCESS
FAILED
REFUNDED
```

Hanya `SUCCESS` dihitung sebagai completed sales.

---

# FR-07 Accessories

Physical product memiliki:

```text
SKU
Name
Category
Brand
Cost
Selling Price
Stock
Minimum Stock
Supplier
```

---

# FR-08 Inventory

Inventory dihitung:

```text
Opening
+ Stock In
- Sold
+/- Adjustment
= Current Stock
```

Setiap perubahan harus tercatat sebagai inventory movement.

---

# FR-09 Sales

Sales dapat mencatat:

* Accessories.
* Voucher.
* Physical products lainnya.

Transaction:

```text
Invoice
Customer
Items
Quantity
Subtotal
Discount
Total
Payment
Cashier
Date
```

---

# FR-10 Customer

Customer:

```text
Name
Phone
Address
Notes
```

Sistem menampilkan histori:

* Sales.
* Digital transactions.
* Service.

---

# FR-11 Service Management

Sistem harus menyediakan pencatatan servis HP secara detail.

Setiap service record minimal memiliki:

```text
Service Number
Date
Customer
Device Brand
Device Model
IMEI / Serial Number (optional)
Complaint
Diagnosis
Status
Spareparts
Total Sparepart Cost
Total Service Cost
Service Fee
Notes
Technician
```

---

# FR-12 Service Device

Data perangkat harus mencatat minimal:

```text
Brand
Model
```

Contoh:

```text
Samsung
A54
```

IMEI/serial number bersifat opsional.

---

# FR-13 Service Spareparts

Satu service dapat memiliki banyak sparepart.

Contoh:

```text
LCD Samsung A54
Qty: 1
Cost: Rp300.000

Battery Samsung A54
Qty: 1
Cost: Rp150.000
```

Sistem menghitung:

```text
Total Sparepart Cost =
SUM(all sparepart subtotal)
```

---

# FR-14 Service Cost

Sistem harus memiliki `Total Service Cost`.

Contoh:

```text
Total Sparepart Cost : Rp450.000
Total Service Cost   : Rp700.000
```

---

# FR-15 Service Fee

Jasa servis dihitung otomatis.

Formula:

```text
Service Fee =
Total Service Cost - Total Sparepart Cost
```

Contoh:

```text
Total Service Cost   Rp700.000
Total Sparepart      Rp450.000
--------------------------------
Service Fee          Rp250.000
```

User tidak perlu menghitung jasa servis secara manual.

---

# FR-16 Service Validation

Sistem harus mencegah:

```text
Total Service Cost < Total Sparepart Cost
```

kecuali terdapat business rule khusus yang nantinya mengizinkannya.

Pada kondisi normal:

```text
Service Fee >= 0
```

---

# FR-17 Service Status

Status:

```text
BARU
DIAGNOSA
DALAM_PENGERJAAN
SELESAI
DIAMBIL
DIBATALKAN
```

Status hanya untuk progress pekerjaan.

Tidak ada konsep:

```text
Service Remaining
Service Opening
Service Incoming
```

---

# FR-18 Service Revenue

Service revenue berasal dari:

```text
Total Service Cost
```

Sedangkan jasa teknisi dihitung sebagai:

```text
Total Service Cost - Total Sparepart Cost
```

Jika sparepart merupakan inventory ChiCha Mobile, penggunaan sparepart juga harus dapat dikaitkan dengan inventory movement.

---

# FR-19 Service Report

Laporan servis harus dapat menampilkan:

```text
Tanggal
Nomor Service
Pelanggan
Perangkat
Teknisi
Status
Total Sparepart
Total Biaya
Jasa Servis
```

Laporan dapat difilter berdasarkan:

* Periode.
* Teknisi.
* Status.
* Brand perangkat.

---

# FR-20 Profit

Untuk produk:

```text
Profit =
(Selling Price - Cost) × Quantity
```

Untuk digital:

```text
Profit =
Selling Price - Cost
```

Untuk service:

```text
Service Fee =
Total Service Cost - Total Sparepart Cost
```

Jika sparepart memiliki cost inventory, service profitability dapat dianalisis lebih lanjut.

---

# FR-21 Expenses

Sistem dapat mencatat:

```text
Date
Category
Description
Amount
Notes
```

Contoh:

* Listrik.
* Internet.
* Sewa.
* Operasional.
* Transportasi.

---

# FR-22 Reports

Sistem menyediakan:

### Sales Report

* Penjualan.
* Quantity.
* Revenue.
* Profit.

### Voucher Report

* Opening.
* Incoming.
* Sold.
* Closing.

### Digital Report

* Product.
* Provider.
* Quantity.
* Revenue.
* Cost.
* Profit.
* Status.

### Inventory Report

* Current stock.
* Stock movement.
* Low stock.

### Service Report

* Service count.
* Sparepart cost.
* Total service cost.
* Service fee.
* Revenue.

---

# FR-23 Business Analytics

Sistem menyediakan:

## Product Analytics

* Best seller.
* Slow seller.
* Non-moving.
* Revenue contribution.
* Profit contribution.

## ABC Analysis

Mengelompokkan produk berdasarkan kontribusi nilai bisnis.

## FSN Analysis

```text
FAST
SLOW
NON-MOVING
```

## Service Analytics

Dapat menampilkan:

```text
Jumlah servis
Total pendapatan servis
Total sparepart
Total jasa servis
Servis berdasarkan brand
Servis berdasarkan teknisi
Servis berdasarkan periode
```

---

# 4. Core Data Model

Recommended entities:

```text
users
roles

customers

products
categories
suppliers

inventory_movements

sales
sale_items
payments

vouchers
voucher_stock_records

digital_products
digital_transactions

service_orders
service_items

expenses
```

---

# 5. Service Relationship

```text
Customer
   │
   └── Service Order
          │
          ├── Device
          │
          ├── Service Items
          │      ├── Sparepart A
          │      ├── Sparepart B
          │      └── Sparepart C
          │
          ├── Total Sparepart Cost
          ├── Total Service Cost
          └── Service Fee
```

Formula:

```text
Service Fee =
Total Service Cost - Total Sparepart Cost
```

---

# 6. MVP

MVP harus mencakup:

```text
Authentication
Role
Dashboard

Customer
Product
Category
Inventory

Voucher
Voucher Sales

Digital Product
Digital Transaction

Sales

Service Management
Service Device
Service Spareparts
Service Cost
Service Fee
Service Status

Reports
Basic Analytics
```

---

# 7. Future Scope

* PPOB API.
* WhatsApp Gateway.
* Payment Gateway.
* Thermal Printer.
* Barcode Scanner.
* Advanced CRM.
* Advanced accounting.
* Multi-branch.
* Advanced service warranty management.
* Service notification.

---

# 8. Success Criteria

Sistem dianggap berhasil jika ChiCha Mobile dapat:

1. Mencatat stok voucher.
2. Mencatat penjualan voucher.
3. Mencatat transaksi digital.
4. Mengelola stok aksesoris.
5. Mencatat servis berdasarkan HP/perangkat.
6. Mencatat sparepart yang digunakan.
7. Menghitung total biaya servis.
8. Menghitung jasa servis secara otomatis.
9. Melihat histori servis pelanggan.
10. Melihat pendapatan dan profit.
11. Melihat laporan operasional.
12. Menggunakan analisis bisnis untuk pengambilan keputusan.

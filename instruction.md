
# `instruction.md`

# Development Instructions — ChiCha Mobile

## 1. General Rule

Bangun sistem sebagai aplikasi manajemen operasional internal ChiCha Mobile.

Prioritas:

1. Business logic yang benar.
2. Data konsisten.
3. Workflow sederhana.
4. UI mudah digunakan.
5. Arsitektur maintainable.
6. Responsive.
7. Security.

Jangan menambahkan fitur yang tidak diperlukan oleh PRD.

---

# 2. Business Rules

## 2.1 Voucher

Voucher adalah inventory berdasarkan kuantitas.

```text
Sisa Awal
+ Stok Masuk
- Terjual
= Sisa Akhir
```

Dimensi:

```text
Operator
Nominal
Harga Modal
Harga Jual
Stok
```

Jangan membuat sistem kode voucher individual.

---

# 3. Digital Product

Digital product tidak menggunakan physical inventory.

Contoh:

```text
Pulsa
Token PLN
Paket Data
Voucher Game
```

Status:

```text
PENDING
SUCCESS
FAILED
REFUNDED
```

Hanya `SUCCESS` yang dianggap sebagai transaksi berhasil.

`FAILED` tidak mengurangi stok fisik.

`REFUNDED` tidak dihitung sebagai realized revenue.

---

# 4. Accessories

Accessories menggunakan inventory fisik.

```text
Stok Awal
+ Stock In
- Sold
+/- Adjustment
= Current Stock
```

Semua perubahan inventory harus membuat `inventory movement`.

Movement type dapat berupa:

```text
INITIAL_STOCK
PURCHASE
SALE
ADJUSTMENT
RETURN
```

---

# 5. Service Management

## 5.1 Service bukan inventory

Jangan membuat konsep:

```text
Service Opening
Service Incoming
Service Completed
Service Remaining
```

Tidak ada perhitungan sisa servis.

---

## 5.2 Service adalah transaksi jasa

Setiap service record minimal memiliki:

```text
Customer
Device
Complaint
Diagnosis
Spareparts
Sparepart Cost
Total Service Cost
Service Fee
Status
Date
Notes
```

---

## 5.3 Perhitungan Service Fee

Formula wajib:

```text
Service Fee =
Total Service Cost - Total Sparepart Cost
```

Contoh:

```text
Sparepart:
LCD = Rp300.000
Battery = Rp150.000

Total Sparepart = Rp450.000

Total Service Cost = Rp700.000

Service Fee =
Rp700.000 - Rp450.000
= Rp250.000
```

Jangan meminta user memasukkan `Service Fee` jika nilai tersebut dapat dihitung otomatis.

User cukup memasukkan:

```text
Spareparts
Total Service Cost
```

Kemudian sistem menghitung:

```text
Total Sparepart Cost
Service Fee
```

---

## 5.4 Multiple Spareparts

Satu service dapat memiliki banyak sparepart.

Contoh:

```text
Service #SRV001

Samsung A54

LCD             Rp300.000
Battery         Rp150.000
Connector        Rp50.000
-------------------------
Sparepart Total Rp500.000

Total Cost      Rp750.000

Service Fee     Rp250.000
```

Gunakan relasi service dan service items, bukan menyimpan seluruh sparepart sebagai satu text field.

---

## 5.5 Service Status

Status:

```text
BARU
DIAGNOSA
DALAM_PENGERJAAN
SELESAI
DIAMBIL
DIBATALKAN
```

Status hanya menunjukkan progress service.

Status tidak digunakan untuk menghitung jumlah "sisa servis".

---

# 6. Financial Rules

Bedakan:

```text
Revenue
Cost
Gross Profit
Service Fee
```

Untuk service:

```text
Service Revenue = Total Service Cost

Service Fee =
Total Service Cost - Total Sparepart Cost
```

Jika sistem belum memiliki cost sparepart yang lengkap, jangan mengarang nilai cost.

---

# 7. Inventory & Service Spareparts

Jika sparepart dicatat sebagai inventory, penggunaan sparepart dalam service harus dapat mengurangi stok.

Contoh:

```text
LCD Samsung A54
Stock = 10

Digunakan pada Service #SRV001
Qty = 1

Stock menjadi 9
```

Pengurangan stok harus memiliki inventory movement dengan reference ke service.

Jika modul sparepart inventory belum diimplementasikan pada tahap awal, jangan membuat integrasi palsu. Implementasikan sesuai scope phase saat ini.

---

# 8. Transaction Integrity

Operasi penting harus atomic.

Untuk service dengan sparepart:

```text
Create Service
      ↓
Create Service Items
      ↓
Calculate Sparepart Cost
      ↓
Calculate Service Fee
      ↓
Update Sparepart Inventory
      ↓
Create Inventory Movement
      ↓
Commit
```

Jika proses gagal, jangan meninggalkan data setengah tersimpan.

---

# 9. Database Rules

Gunakan relational model.

Minimal service structure:

```text
service_orders
service_items
```

`service_orders` menyimpan:

```text
customer_id
device information
complaint
diagnosis
total_cost
service_fee
status
date
notes
```

`service_items` menyimpan:

```text
service_order_id
product_id / sparepart_id
quantity
unit_cost
subtotal
```

`service_fee` sebaiknya dapat dihitung:

```text
total_cost - SUM(service_items.subtotal)
```

Database/server harus menjadi sumber perhitungan, bukan frontend saja.

---

# 10. UI/UX Service

Form service harus sederhana.

Contoh:

```text
Pelanggan
[ Budi ]

Perangkat
[ Samsung A54 ]

Keluhan
[ LCD pecah ]

Diagnosa
[ LCD rusak ]

Sparepart
[ LCD Samsung A54 ] [1] [Rp300.000]
[ Battery         ] [1] [Rp150.000]

Total Sparepart
Rp450.000

Total Biaya Servis
Rp700.000

Jasa Servis
Rp250.000

Status
[ Dalam Pengerjaan ]
```

`Jasa Servis` dihitung otomatis.

Jangan meminta kasir/teknisi menghitung manual.

---

# 11. Coding Rules

Gunakan:

* Reusable components.
* Modular services.
* Typed models.
* Server-side validation.
* Clear naming.
* Small components.
* Reusable business logic.

Hindari:

* Giant components.
* Duplicate calculation.
* Hardcoded business rules.
* Unnecessary dependencies.
* Unnecessary abstraction.

---

# 12. Security

Implement:

* Authentication.
* Authorization.
* Role-based access.
* Server-side validation.
* Secure environment variables.
* Protected API routes.

Jangan expose secret/API/database credentials ke client.

---

# 13. Testing

Wajib test:

### Voucher

```text
Opening + Incoming - Sold = Closing
```

### Accessories

```text
Opening + Stock In - Sold = Current Stock
```

### Digital

```text
PENDING
SUCCESS
FAILED
REFUNDED
```

### Service

Test:

```text
No sparepart
One sparepart
Multiple spareparts
Zero service fee
Positive service fee
Invalid total cost
Invalid quantity
Insufficient sparepart stock
Service cancellation
Service completion
```

### Service calculation

```text
Total Cost = Rp500.000
Sparepart = Rp350.000
Service Fee = Rp150.000
```

Harus menghasilkan nilai yang benar.

---

# 14. Development Workflow

Sebelum coding:

1. Baca `project-overview.md`.
2. Baca `instruction.md`.
3. Baca `prd.md`.
4. Inspect repository.
5. Identifikasi existing architecture.
6. Identifikasi database.
7. Identifikasi existing features.
8. Tentukan dependency.
9. Implementasi.
10. Test.
11. Review.

Jangan rewrite project tanpa alasan.

---

# 15. Definition of Done

Feature dianggap selesai jika:

* UI bekerja.
* Database bekerja.
* Validation bekerja.
* Business logic benar.
* Permission benar.
* Error handling tersedia.
* Test relevan berhasil.
* Tidak merusak fitur existing.
* Responsive.
* Tidak terdapat business logic penting yang hanya berada di frontend.

---

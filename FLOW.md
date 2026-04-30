# Flow Keseluruhan DistribusiPro

## Gambaran Bisnis
Sistem ini mengelola distribusi **Es Kristal** (dalam satuan sak) dari pabrik ke pelanggan (warung/depot/toko) melalui armada kendaraan yang beroperasi per rayon (wilayah).

---

## 1. Setup Master Data

Data yang harus ada sebelum operasional bisa jalan:

```
Rayon      → wilayah pengiriman (Utara, Selatan, Timur, dst)
Vehicle    → kendaraan beserta kapasitas (sak) & biaya operasional/hari
Driver     → supir, bisa di-assign ke kendaraan tertentu
Customer   → pelanggan (WARUNG/DEPOT/TOKO), masing-masing punya rayonId
PriceProfile → harga per customerType × channel (misal WARUNG+PREORDER = Rp15.000/sak)
```

---

## 2. Alur Operasional Harian

```
[PAGI]
  Produksi → berapa sak es yang dibuat hari ini (ProductionPlan → WarehouseStock)
      ↓
  Aktivasi Armada → operator daftarkan FleetDailyStatus:
    - pilih vehicle + driver + rayon + initialLoad (berapa sak dibawa)
      ↓
  Order Masuk → bisa dari 4 channel:
    - PREORDER    → pelanggan pesan sehari sebelumnya
    - HOTLINE     → telepon mendadak
    - CANVAS      → driver keliling, jual langsung
    - ADMIN_INPUT → input manual admin (tidak punya harga di PriceProfile, diisi manual)
      ↓
[SIANG - PENGIRIMAN]
  Driver berangkat, lakukan pengiriman
      ↓
  Delivery Log → dicatat hasil per order:
    - deliveredQty, returnedQty, returnReason
    - sistem otomatis update status Order:
        deliveredQty ≥ orderedQty  → DELIVERED
        deliveredQty > 0           → PARTIAL
        returnedQty > 0 saja       → RETURNED
        sisanya                    → CANCELLED
      ↓
[SORE/MALAM]
  VehicleCost       → dicatat biaya operasional hari itu (BBM, supir, helper, dll)
  DriverAttendance  → absensi driver
  DriverPerformance → efisiensi driver (delivered vs returned)
```

---

## 3. Status Pesanan (Order Lifecycle)

```
CREATED → CONFIRMED → ASSIGNED → LOADED → DELIVERED
                                         → PARTIAL
                                         → RETURNED
                                         → CANCELLED
                      → REJECTED
```

Status berubah **otomatis** saat Delivery Log dibuat (via `POST /api/delivery-logs`).

Aturan derivasi status:
| Kondisi | Status |
|---------|--------|
| `deliveredQty >= orderedQty` | DELIVERED |
| `deliveredQty > 0` | PARTIAL |
| `returnedQty > 0` (delivered = 0) | RETURNED |
| selainnya | CANCELLED |

Order yang sudah DELIVERED / CANCELLED / REJECTED **tidak bisa** ditambah delivery log lagi.

---

## 4. Laporan & Analitik

| Modul | Sumber Data | Fungsi |
|-------|-------------|--------|
| **Dashboard** | Order + FleetDailyStatus + WarehouseStock | Ringkasan harian, alert stok & return rate |
| **Finance** | VIEW `revenue_summary` | Gross revenue − biaya kendaraan = net revenue, per rayon/hari |
| **Produksi** | Order history (PREORDER + CANVAS + HOTLINE 7 hari) | Rekomendasi produksi esok hari + 5% buffer |

Alert otomatis pada Dashboard:
- Return rate > 10%
- Stok gudang < 50 sak

---

## 5. Algoritma Rekomendasi Produksi

```
Rekomendasi = PreOrder terkonfirmasi (besok)
            + rata-rata Canvas 7 hari terakhir
            + rata-rata Hotline 7 hari terakhir
            + 5% buffer risiko
```

Hasilnya dibandingkan dengan:
- Kapasitas total armada aktif (sum `Vehicle.capacitySak`)
- Stok gudang saat ini (`WarehouseStock.closingStock`)

Warning muncul jika rekomendasi > kapasitas armada atau stok gudang < 50% rekomendasi.

---

## 6. Keuangan (Revenue Summary)

Dihitung dari VIEW `revenue_summary` (SQL di `prisma/views.sql`):

```
Gross Revenue  = SUM(deliveredQty × pricePerUnit)  per rayon per hari
Vehicle Cost   = SUM(fuel + driver + helper + maintenance + depreciation)
Net Revenue    = Gross Revenue − Vehicle Cost
```

Hanya order berstatus DELIVERED atau PARTIAL yang masuk perhitungan.

---

## 7. Relasi Antar Entitas

```
Rayon ──< Customer ──< Order >── Vehicle >── FleetDailyStatus
                        │                        │
                        └──< DeliveryLog >────────┘
                                    │
                                  Driver
```

Relasi lain:
- `Vehicle` ──< `VehicleCost` (biaya harian)
- `Vehicle` ──< `VehicleMaintenance` (riwayat servis)
- `Vehicle` ──< `VehicleLoad` (muatan harian)
- `Driver`  ──< `DriverAttendance` (absensi harian)
- `Driver`  ──< `DriverPerformance` (performa harian)
- `Rayon`   ──< `PriceProfile` (harga per tipe pelanggan & channel; rayonId opsional — null = berlaku semua rayon)

---

## 8. Role & Akses (RBAC)

| Role | Dashboard | Pesanan | Armada | Pelanggan | Keuangan | Produksi |
|------|:---------:|:-------:|:------:|:---------:|:--------:|:--------:|
| **ADMIN** | ✅ | ✅ baca+tulis | ✅ | ✅ | ✅ | ✅ |
| **SUPERVISOR** | ✅ | 👁 read-only | 👁 read-only | 👁 read-only | ✅ | 👁 read-only |
| **OPERATOR** | ✅ | ✅ buat order | 👁 read-only | 👁 read-only | ❌ | ❌ |

RBAC diterapkan di dua lapis:
1. **API** — middleware cek JWT + role sebelum proses request
2. **UI** — tombol create/edit disembunyikan per role

---

## 9. API Endpoints

| Endpoint | Methods | Catatan |
|----------|---------|---------|
| `/api/orders` | GET, POST | Filter date/status/channel/rayon/vehicle/customer + pagination |
| `/api/orders/[id]` | GET, PATCH, DELETE | Soft delete (`deletedAt`) |
| `/api/fleet` | GET, POST | Filter by date; conflict check vehicle & driver |
| `/api/fleet/[id]` | PATCH, DELETE | |
| `/api/delivery-logs` | GET, POST | Auto-update order status via transaksi Prisma |
| `/api/customers` | GET, POST | Search + filter |
| `/api/customers/[id]` | GET, PATCH, DELETE | Include order history |
| `/api/vehicles` | GET, POST | |
| `/api/drivers` | GET, POST | |
| `/api/rayons` | GET, POST | |
| `/api/price-profiles` | GET, POST | Filter customerType/channel/rayonId; ADMIN only untuk write |
| `/api/price-profiles/[id]` | PATCH, DELETE | Hard delete (tidak ada soft delete) |
| `/api/dashboard/summary` | GET | 6 agregasi paralel |
| `/api/finance/revenue` | GET | Raw SQL JOIN via VIEW |
| `/api/production/recommendation` | GET | Forecast algorithm |

Semua endpoint: JWT auth + rate limit 120 req/menit/IP.

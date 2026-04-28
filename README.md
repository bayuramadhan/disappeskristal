# DistribusiPro

Sistem manajemen distribusi FMCG untuk produk **Es Kristal** (satuan: sak).

## Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 14 App Router + TypeScript |
| Database | PostgreSQL 16 via Prisma ORM v5 |
| Auth | NextAuth.js v4 (JWT + CredentialsProvider) |
| UI | Tailwind CSS + shadcn/ui (Radix UI) |
| State | SWR (client-side data fetching) |
| Validasi | Zod |

---

## Setup dari Awal

### Prasyarat

- Node.js 20+
- PostgreSQL 16 (atau Docker)

### 1. Install dependencies

```bash
npm install
```

### 2. Konfigurasi environment

```bash
cp .env.example .env
```

Edit `.env` — sesuaikan database credentials dan generate secret:

```bash
openssl rand -base64 32   # pakai hasilnya untuk NEXTAUTH_SECRET
```

### 3. Jalankan database (Docker)

```bash
# Hanya PostgreSQL untuk development
docker compose up postgres -d
```

### 4. Setup database

```bash
npm run db:push    # push schema ke database
npm run db:seed    # isi data awal (user, rayon, kendaraan, pelanggan, pesanan)
```

Akun default setelah seed:
- **Admin**: `admin@distribusipro.com` / `admin123`
- **Operator**: `operator@distribusipro.com` / `operator123`

### 5. Jalankan development server

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000)

---

## Menjalankan dengan Docker (Production)

```bash
# Build & jalankan semua service (app + postgres)
docker compose up -d --build

# Lihat log
docker compose logs -f app
```

App tersedia di [http://localhost:3000](http://localhost:3000)

---

## Scripts

| Command | Deskripsi |
|---------|-----------|
| `npm run dev` | Development server (hot reload) |
| `npm run build` | Build production |
| `npm run start` | Jalankan production build |
| `npm run db:push` | Push schema Prisma ke database |
| `npm run db:migrate` | Buat migration baru |
| `npm run db:seed` | Isi data awal |
| `npm run db:studio` | Buka Prisma Studio (GUI database) |

---

## Role & Akses

| Role | Dashboard | Pesanan | Armada | Pelanggan | Keuangan | Produksi |
|------|:---------:|:-------:|:------:|:---------:|:--------:|:--------:|
| **ADMIN** | ✅ | ✅ baca+tulis | ✅ | ✅ | ✅ | ✅ |
| **SUPERVISOR** | ✅ | 👁 read-only | 👁 read-only | 👁 read-only | ✅ | 👁 read-only |
| **OPERATOR** | ✅ | ✅ buat order | 👁 read-only | 👁 read-only | ❌ | ❌ |

RBAC diterapkan di level **middleware** (API routes) dan **UI** (tombol create/edit disembunyikan).

---

## Modul

### Dashboard (`/dashboard`)
Ringkasan harian: total pesanan, pendapatan bersih, armada aktif, stok gudang.
**Alert otomatis** muncul bila:
- Return rate > 10%
- Stok gudang < 50 sak

### Pesanan (`/orders`)
Daftar pesanan dengan filter tanggal/status/channel/pelanggan, drawer detail + log pengiriman.
- Buat pesanan baru — ADMIN & OPERATOR
- **Export CSV** — semua role

### Armada (`/fleet`)
Status kendaraan harian dengan progress bar muatan tersisa.
- Aktivasi armada + assign driver — ADMIN & OPERATOR

### Pelanggan (`/customers`)
Daftar pelanggan (WARUNG/DEPOT/TOKO) per rayon + halaman detail dengan statistik dan riwayat 20 pesanan terakhir.

### Keuangan (`/finance`)
Laporan revenue dengan grouping per hari/kendaraan/rayon, date range picker, baris total.
- **Export Excel (.xlsx)** — ADMIN & SUPERVISOR

### Produksi (`/production`)
Rekomendasi jumlah produksi otomatis:
```
Rekomendasi = PreOrder terkonfirmasi
            + Avg Canvas 7 hari
            + Avg Hotline 7 hari
            + 5% buffer risiko
```
Perbandingan vs kapasitas armada dan stok gudang.

---

## API Endpoints

| Endpoint | Methods | Catatan |
|----------|---------|---------|
| `/api/orders` | GET, POST | Filter + pagination |
| `/api/orders/[id]` | GET, PATCH, DELETE | Soft delete |
| `/api/fleet` | GET, POST | Filter by date |
| `/api/fleet/[id]` | PATCH, DELETE | |
| `/api/delivery-logs` | GET, POST | Auto-update order status |
| `/api/customers` | GET, POST | Search + filter |
| `/api/customers/[id]` | GET, PATCH, DELETE | Include order history |
| `/api/vehicles` | GET, POST | |
| `/api/drivers` | GET, POST | |
| `/api/rayons` | GET, POST | |
| `/api/dashboard/summary` | GET | Aggregasi paralel |
| `/api/finance/revenue` | GET | Raw SQL JOIN multi-tabel |
| `/api/production/recommendation` | GET | Forecast algorithm |

Semua endpoint: JWT auth + rate limit 120 req/menit/IP + RBAC.

---

## Struktur Folder

```
app/
  (main)/           # Layout sidebar + topbar
    dashboard/
    orders/
    fleet/
    customers/[id]/
    finance/
    production/
  api/              # API routes
  login/
components/
  ui/               # shadcn/ui components
  shared/           # StatusBadge, ChannelTag, PageHeader, dll
  layout/           # Sidebar (collapsible, dark), Topbar
hooks/              # SWR hooks + useRole + use-toast
lib/                # Prisma, NextAuth, Zod schemas, utils, fetcher
prisma/
  schema.prisma     # 16 tabel + RevenueSummary VIEW
  seed.ts           # Data awal
```
# 📋 Panduan Operasional — Distribusi Es Kristal

> **Untuk siapa:** Operator & Admin yang mengelola pesanan dan pengiriman harian.
> **Dibaca dari atas ke bawah** mengikuti alur kerja nyata dari pagi sampai sore.

---

## Daftar Isi

1. [Pesanan Masuk via WhatsApp](#1-pesanan-masuk-via-whatsapp)
2. [Pesanan Manual (Input Langsung)](#2-pesanan-manual-input-langsung)
3. [Kelola Pesanan — Menu Pesanan](#3-kelola-pesanan--menu-pesanan)
4. [Menu Armada — Assign & Catat Pengiriman](#4-menu-armada--assign--catat-pengiriman)
5. [Alur Lengkap Hari Ini](#5-alur-lengkap-hari-ini)
6. [Status Pesanan — Artinya Apa?](#6-status-pesanan--artinya-apa)
7. [Pertanyaan Umum (FAQ)](#7-pertanyaan-umum-faq)

---

## 1. Pesanan Masuk via WhatsApp

### Bagaimana caranya?

Pelanggan cukup **kirim pesan WA** ke nomor bisnis. Sistem akan membaca pesannya secara otomatis.

### Contoh pesan yang bisa dipahami sistem

```
Warung Sedap mau pesan 10 sak besok
```
```
dari Toko Maju, order 5 sak tanggal 15 Mei
```
```
pesan 8 sak untuk hari Selasa, catatan: titip di depan gang
```
```
ini Pak Budi, butuh 12 sak buat lusa
```

### Apa yang dibaca otomatis?

| Info | Contoh |
|------|--------|
| **Jumlah** | "10 sak", "pesan 5", "butuh 8 karung" |
| **Tanggal kirim** | "besok", "lusa", "Selasa", "tanggal 15 Mei", "15/05" |
| **Nama pelanggan** | "dari Warung Sedap", "ini Pak Budi", "Toko Maju pesan..." |
| **Catatan** | "catatan: titip di depan gang" |

> **Tips untuk pelanggan:** Semakin jelas pesannya, semakin cepat diproses. Minimal sebutkan **jumlah sak** dan **tanggal kirim**.

---

### Dua kemungkinan yang terjadi

#### ✅ Pesanan langsung terbuat (otomatis)

Ini terjadi jika:
- Nomor WA pengirim **sudah terdaftar** di data pelanggan, **DAN**
- Jumlah sak dan tanggal kirim **terbaca jelas**, **DAN**
- **Harga** untuk pelanggan tersebut **sudah ada** di sistem

Pelanggan otomatis menerima **konfirmasi WA** seperti ini:
```
✅ Pesanan diterima!

🏪 Warung Sedap
📦 10 sak es kristal
📅 Tanggal kirim: 16/05/2026
💰 Rp 15.000/sak × 10 = Rp 150.000
🔖 No. Pesanan: ORD-20260516-001

Terima kasih sudah memesan! 🙏
```

#### 📝 Tersimpan sebagai Draft (perlu review operator)

Ini terjadi jika:
- Nomor WA tidak dikenali, atau nama pelanggan tidak cocok → **pelanggan belum terdaftar**
- Harga untuk pelanggan tersebut belum diatur di sistem
- Informasi pesanan tidak lengkap

Operator perlu membuka menu **Pesanan → tab WA Draft** untuk menyelesaikan.

---

### Cara review Draft WA

1. Buka menu **Pesanan**
2. Klik tab **WA Draft**
3. Cari draft yang belum diproses (badge angka di tab menunjukkan jumlahnya)
4. Klik draft → lengkapi informasi yang kosong:
   - Pilih pelanggan (jika belum terisi)
   - Periksa jumlah sak & tanggal kirim
   - Tambah catatan jika perlu
5. Klik **Buat Pesanan** — pesanan langsung masuk ke antrian

---

## 2. Pesanan Manual (Input Langsung)

Gunakan ini untuk pesanan via telepon, walk-in, atau ketika ingin input langsung tanpa menunggu WA.

### Langkah-langkah

1. Buka menu **Pesanan**
2. Klik tombol **+ Buat Pesanan** (pojok kanan atas)
3. Isi form:

| Field | Keterangan |
|-------|------------|
| **Pelanggan** | Ketik nama → pilih dari daftar |
| **Lokasi Pengiriman** | Otomatis terisi lokasi default pelanggan. Bisa diganti jika ada lokasi lain |
| **Tanggal Kirim** | Kapan es dikirim ke pelanggan |
| **Jumlah (sak)** | Berapa sak yang dipesan |
| **Channel** | PREORDER (pesan sehari sebelumnya), HOTLINE (telepon), CANVAS (langsung), ADMIN |
| **Catatan** | Info tambahan untuk driver |

4. Klik **Simpan** → pesanan masuk ke daftar dengan status **CREATED**

> 💡 **Harga otomatis terisi** berdasarkan tipe pelanggan + channel yang dipilih. Jika harga tidak ditemukan, akan muncul peringatan.

---

## 3. Kelola Pesanan — Menu Pesanan

### Tampilan daftar pesanan

Daftar menampilkan pesanan berdasarkan **tanggal kirim** (bukan tanggal input). Gunakan filter di atas tabel untuk menyaring:

- 📅 **Tanggal** — lihat pesanan untuk hari tertentu
- 🔵 **Status** — filter berdasarkan status pesanan
- 📢 **Channel** — PREORDER / HOTLINE / CANVAS / ADMIN
- 🗺️ **Rayon** — wilayah pengiriman

### Aksi yang bisa dilakukan pada pesanan

| Aksi | Kapan dipakai |
|------|--------------|
| **Lihat Detail** | Klik baris pesanan — lihat info lengkap termasuk riwayat pengiriman |
| **Edit Status** | Ubah status pesanan secara manual (misal konfirmasi pesanan) |
| **Hapus** | Hanya Admin. Pesanan dihapus soft-delete, status jadi CANCELLED |

### Tab Log Aktivitas

Di bagian bawah halaman Pesanan ada tab **Log Aktivitas** — menampilkan rekam jejak setiap perubahan:
- Siapa yang membuat/mengubah pesanan
- Jam berapa
- Perubahan apa yang terjadi (status lama → status baru, qty terkirim, dll)

Berguna untuk audit jika ada dispute dengan pelanggan.

---

## 4. Menu Armada — Assign & Catat Pengiriman

Menu Armada adalah pusat kendali pengiriman harian. Di sini operator assign pesanan ke kendaraan dan driver mencatat hasil pengiriman.

### Tampilan Menu Armada

Halaman menampilkan **kartu per armada** yang aktif hari ini. Setiap kartu berisi:
- Nama kendaraan & plat nomor
- Driver yang bertugas
- Rayon pengiriman
- Kapasitas & jumlah sak yang sudah di-assign
- Jam berangkat
- Daftar pesanan yang di-assign ke armada ini

Di atas kartu-kartu ada **panel Antrian Pesanan** — daftar semua pesanan hari ini beserta status alokasinya, sebagai referensi saat assign.

---

### Langkah 1 — Buka Slot Armada

Klik tombol **"Slot"** atau nama armada untuk membuka panel detail armada.

Panel ini menampilkan:
- Info armada (driver, rayon, kapasitas)
- Input jam berangkat (bisa langsung diisi di sini)
- Daftar pesanan yang sudah di-assign
- Tombol untuk assign pesanan baru

---

### Langkah 2 — Set Jam Berangkat

Di dalam panel armada, ada input **Jam Berangkat** di bagian atas:

1. Klik kolom jam → ketik jam (misal `07:30`)
2. Klik di luar kolom atau tekan Tab → jam tersimpan otomatis
3. Untuk menghapus jam, klik tombol **✕** di sebelah input

> Jam berangkat tersimpan di log aktivitas armada.

---

### Langkah 3 — Assign Pesanan ke Armada

1. Di panel armada, klik **"+ Assign Pesanan"**
2. Muncul daftar pesanan yang **belum ter-assign penuh** untuk hari ini
   - Termasuk pesanan dengan status PARTIAL (masih ada sisa yang belum di-deliver)
3. Pilih pesanan yang ingin di-assign
4. Masukkan **jumlah sak** yang akan dibawa armada ini
   - Pesanan bisa dibagi ke beberapa armada (split delivery)
   - Misal: pesanan 20 sak bisa dibagi: armada A bawa 12 sak, armada B bawa 8 sak
5. Klik **Assign**

> ⚠️ **Perhatian kapasitas:** Sistem akan mengingatkan jika total sak melebihi kapasitas kendaraan.

---

### Langkah 4 — Unassign Pesanan (jika salah)

Jika terjadi kesalahan assign:

1. Di panel armada, cari pesanan yang ingin di-unassign
2. Klik ikon **✕** di baris pesanan tersebut
3. Konfirmasi → pesanan kembali ke antrian, bisa di-assign ulang ke armada lain

---

### Langkah 5 — Catat Hasil Pengiriman

Setelah driver selesai mengantar, operator (atau driver via HP) mencatat hasilnya:

1. Di panel armada, temukan pesanan yang sudah diantar
2. Klik tombol **"Catat"** di baris pesanan
3. Isi form pengiriman:

| Field | Keterangan |
|-------|------------|
| **Terkirim (sak)** | Berapa sak yang berhasil diterima pelanggan |
| **Dikembalikan (sak)** | Berapa sak yang dibawa balik (tidak laku/ditolak) |
| **Alasan Return** | Wajib diisi jika ada sak yang dikembalikan |

4. Klik **Simpan**

> Status pesanan otomatis berubah sesuai hasil:
> - Semua terkirim → **DELIVERED** ✅
> - Sebagian terkirim → **PARTIAL** 🔶
> - Semua dikembalikan → **RETURNED** 🔴

Setelah semua sak (terkirim + dikembalikan = qty assigned) tercatat, tombol **"Catat"** hilang dan muncul badge **"Selesai"** di baris pesanan.

---

### Tab Log Aktivitas di Menu Armada

Di bawah daftar kartu armada ada tab **Log Aktivitas** yang mencatat:
- Armada mana yang di-assign pesanan apa
- Siapa operator yang melakukan assign/unassign
- Kapan pengiriman dicatat

---

### Panel Antrian Pesanan (referensi)

Di atas halaman Armada ada panel **Antrian Pesanan** yang bisa dibuka/ditutup. Panel ini menampilkan:

- Semua pesanan hari ini beserta progress alokasi
- **Bar hijau** = sudah ter-assign sepenuhnya
- **Bar kuning** = sebagian ter-assign (perlu dilengkapi)
- **Bar abu** = belum di-assign sama sekali
- Badge angka di header: berapa pesanan yang belum penuh ter-assign

Gunakan ini sebagai panduan saat memutuskan armada mana yang perlu dibebani pesanan tambahan.

---

## 5. Alur Lengkap Hari Ini

```
PAGI
  │
  ├─ Cek WA Draft → review & konfirmasi pesanan dari WA semalam
  │
  ├─ Input pesanan manual (telepon/hotline pagi hari)
  │
  ├─ Buka menu Armada
  │   ├─ Set jam berangkat per armada
  │   └─ Assign pesanan ke masing-masing armada
  │
SIANG (setelah driver berangkat)
  │
  ├─ Driver antar pesanan
  │
SORE (driver pulang)
  │
  └─ Catat hasil pengiriman di menu Armada
      ├─ Isi qty terkirim & dikembalikan per pesanan
      └─ Status pesanan otomatis terupdate
```

---

## 6. Status Pesanan — Artinya Apa?

| Status | Ikon | Artinya |
|--------|------|---------|
| **CREATED** | 🔵 | Pesanan baru masuk, belum diproses |
| **CONFIRMED** | 🟣 | Pesanan sudah dikonfirmasi admin/operator |
| **ASSIGNED** | 🟠 | Sudah di-assign ke armada, menunggu pengiriman |
| **LOADED** | 🟡 | Barang sudah dimuat ke kendaraan |
| **DELIVERED** | 🟢 | Semua sak berhasil terkirim |
| **PARTIAL** | 🟠 | Sebagian terkirim — sisa masih bisa dikirim via armada lain |
| **RETURNED** | 🔴 | Semua sak dikembalikan (tidak ada yang terkirim) |
| **CANCELLED** | ⚫ | Pesanan dibatalkan |
| **REJECTED** | ⛔ | Pesanan ditolak |

### Pesanan PARTIAL — bagaimana lanjutannya?

Jika pesanan berstatus **PARTIAL** (sebagian terkirim), sisa pesanan masih bisa dikirim:

1. Pesanan PARTIAL akan muncul kembali di **daftar pilihan assign** di panel armada
2. Assign sisa sak ke armada lain (atau armada yang sama untuk trip berikutnya)
3. Catat pengiriman sisa → jika semua sak sudah tercatat, status otomatis jadi **DELIVERED**

---

## 7. Pertanyaan Umum (FAQ)

**Q: Pelanggan kirim WA tapi tidak ada konfirmasi balasan?**

Kemungkinan pesannya masuk sebagai draft karena nomor belum terdaftar atau informasi tidak lengkap. Cek menu **Pesanan → WA Draft**.

---

**Q: Saya salah assign pesanan ke armada yang salah. Bagaimana?**

Klik ikon **✕** di baris pesanan dalam panel armada untuk unassign, lalu assign ulang ke armada yang benar.

---

**Q: Bisa satu pesanan dibawa oleh dua armada sekaligus?**

Ya, ini disebut **split delivery**. Saat assign, masukkan jumlah sak yang dibawa masing-masing armada (tidak harus semuanya). Sistem akan melacak progress per armada secara terpisah.

---

**Q: Driver sudah catat pengiriman tapi qty salah. Bisa diedit?**

Untuk saat ini, delivery log tidak bisa diedit setelah tersimpan. Hubungi Admin untuk koreksi data.

---

**Q: Pesanan dari WA tidak terbaca harganya — kenapa?**

Harga ditentukan berdasarkan **tipe pelanggan** (Warung/Depot/Toko) dan **channel** (HOTLINE). Jika harga belum diatur untuk kombinasi tersebut, pesanan masuk sebagai draft. Admin perlu menambahkan harga di menu **Price Profile**.

---

**Q: Bisa lihat siapa yang ubah pesanan?**

Ya. Di halaman **Pesanan**, buka tab **Log Aktivitas** — semua perubahan tercatat lengkap dengan nama operator dan waktu.

---

**Q: Bagaimana cara tambah pelanggan baru?**

Buka menu **Pelanggan → + Tambah Pelanggan**. Isi nama, tipe (Warung/Depot/Toko), rayon, dan lokasi pengiriman. Setelah tersimpan, nomor WA PIC pelanggan bisa ditambahkan agar pesanan WA bisa dikenali otomatis.

---

*Panduan ini berlaku untuk versi sistem saat ini. Untuk pertanyaan teknis, hubungi administrator sistem.*

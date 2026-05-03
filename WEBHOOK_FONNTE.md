# Webhook Fonnte Integration

Endpoint webhook untuk integrasi otomatis dengan Fonnte WhatsApp API.

## Setup

1. **Environment Variables**
   Tambahkan `FONNTE_TOKEN` ke environment variables Anda:
   ```
   FONNTE_TOKEN=your_fonnte_token_here
   ```

2. **Konfigurasi Webhook di Fonnte**
   - Masuk ke dashboard Fonnte
   - Pergi ke Settings > Webhook
   - Set URL webhook ke: `https://yourdomain.com/api/webhook/fonnte`
   - Pilih format: JSON
   - Enable webhook

## Cara Kerja

1. **Pesan Masuk**: Ketika pelanggan mengirim pesan WA, Fonnte akan forward ke webhook
2. **Parsing Otomatis**: Sistem akan parsing pesan untuk ekstrak:
   - Nama pelanggan
   - Jumlah pesanan (sak)
   - Tanggal pengiriman
   - Catatan tambahan
3. **Pencarian Pelanggan**: Sistem akan cari pelanggan berdasarkan nama atau nomor telepon
4. **Pembuatan Order Otomatis**: Jika semua data lengkap (pelanggan ditemukan, harga tersedia), order akan dibuat otomatis
5. **Konfirmasi**: Sistem akan kirim balasan konfirmasi ke pelanggan via WA
6. **Draft**: Jika data tidak lengkap, pesan akan disimpan sebagai draft untuk review manual

## Format Pesan yang Didukung

```
"Halo, ini Pak Budi dari Warung Segar. Pesan 10 sak es kristal untuk besok ya. Terima kasih"
"Halo, saya mau pesan 5 sak es untuk hari ini"
"Pesan 20 sak es kristal tgl 15 Mei"
```

## API Endpoints

### POST /api/webhook/fonnte
Endpoint utama webhook yang dipanggil oleh Fonnte.

**Request Body:**
```json
{
  "sender": "6281234567890",
  "message": "Halo, pesan 10 sak es kristal untuk besok"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "action": "order_created",
    "orderId": "abc123",
    "customer": "Warung Segar",
    "qty": 10
  }
}
```

### POST /api/webhook/fonnte/send
Endpoint untuk mengirim pesan WA (internal use).

**Request Body:**
```json
{
  "target": "6281234567890",
  "message": "Pesanan Anda telah diterima!"
}
```

## Testing

Untuk test webhook tanpa Fonnte, bisa gunakan curl:

```bash
curl -X POST http://localhost:3000/api/webhook/fonnte \
  -H "Content-Type: application/json" \
  -d '{
    "sender": "6281234567890",
    "message": "Halo, pesan 5 sak es kristal untuk besok"
  }'
```
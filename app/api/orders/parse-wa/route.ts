import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/api/auth'
import { apiSuccess, apiError, apiServerError } from '@/lib/api/response'

function fmt(d: Date) { return d.toISOString().slice(0, 10) }

// ─── Rule-based WA message parser ────────────────────────────────────────────
function parseWAMessage(message: string) {
  const text = message.trim()
  const lower = text.toLowerCase()

  const today    = new Date()
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  const dayAfter = new Date(today); dayAfter.setDate(today.getDate() + 2)

  // ── Qty + Unit ────────────────────────────────────────────────────────────
  // Pola: angka lalu unit, atau kata pesan/order lalu angka
  // Kembalikan juga uomHint (singkatan unit yang terdeteksi) untuk dicocokkan ke tabel Unit
  const unitPatterns: { pat: RegExp; uom: string }[] = [
    // ton / tonne
    { pat: /(\d+(?:[.,]\d+)?)\s*(?:ton|tonne)\b/i,                 uom: 'ton' },
    // kilogram / kg
    { pat: /(\d+(?:[.,]\d+)?)\s*(?:kilogram|kilogramme|kg)\b/i,    uom: 'kg' },
    // sak / karung / bag / koli
    { pat: /(\d+(?:[.,]\d+)?)\s*(?:sak|karung|bag|koli|pcs|unit)\b/i, uom: 'sak' },
  ]

  let orderedQty: number | null = null
  let uomHint: string | null    = null

  for (const { pat, uom } of unitPatterns) {
    const m = text.match(pat)
    if (m) {
      orderedQty = parseFloat(m[1].replace(',', '.'))
      uomHint    = uom
      break
    }
  }

  // Fallback: kata pesan/order lalu angka (tanpa unit eksplisit → anggap sak)
  if (orderedQty === null) {
    const verbFirst = text.match(/(?:pesan|order|minta|beli|butuh|mau|request|mesen|ambil|kirim|antar)\s+(\d+(?:[.,]\d+)?)/i)
    if (verbFirst) {
      orderedQty = parseFloat(verbFirst[1].replace(',', '.'))
      uomHint    = 'sak'
    }
  }

  // ── Date ─────────────────────────────────────────────────────────────────
  // "besok", "hari ini", "lusa", "tgl 5", "tanggal 15 Mei", "5/5", "2026-05-05"
  let deliveryDate: string = fmt(tomorrow) // default besok
  if (/hari\s*ini|sekarang|today/i.test(lower)) {
    deliveryDate = fmt(today)
  } else if (/lusa|overmorgen/i.test(lower)) {
    deliveryDate = fmt(dayAfter)
  } else if (/besok|tomorrow/i.test(lower)) {
    deliveryDate = fmt(tomorrow)
  } else {
    // "tgl 15" / "tanggal 5 Mei" / "5 Mei" / "15/5" / "2026-05-15"
    const isoMatch = text.match(/(\d{4}-\d{2}-\d{2})/)
    if (isoMatch) {
      deliveryDate = isoMatch[1]
    } else {
      const months: Record<string, number> = {
        jan:1, feb:2, mar:3, apr:4, mei:5, jun:6,
        jul:7, agu:8, sep:9, okt:10, nov:11, des:12,
        may:5, aug:8, oct:10, dec:12,
      }
      const longDate = text.match(/(?:tgl|tanggal)?\s*(\d{1,2})\s+([a-zA-Z]{3,})/i)
      if (longDate) {
        const day   = parseInt(longDate[1])
        const month = months[longDate[2].toLowerCase().slice(0, 3)]
        if (month) {
          const year = today.getFullYear()
          const d    = new Date(year, month - 1, day)
          // If date already passed this year, assume next year
          if (d < today) d.setFullYear(year + 1)
          deliveryDate = fmt(d)
        }
      } else {
        // "5/5" or "15/05"
        const slashDate = text.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/)
        if (slashDate) {
          const day   = parseInt(slashDate[1])
          const month = parseInt(slashDate[2])
          const year  = slashDate[3] ? parseInt(slashDate[3]) : today.getFullYear()
          const fullYear = year < 100 ? 2000 + year : year
          deliveryDate = fmt(new Date(fullYear, month - 1, day))
        }
      }
    }
  }

  // ── Phone ─────────────────────────────────────────────────────────────────
  const phoneMatch = text.match(/(?:\+62|62|0)[\s-]?8[\d\s-]{8,13}/)
  const customerPhone = phoneMatch
    ? phoneMatch[0].replace(/[\s-]/g, '')
    : null

  // ── Customer name ─────────────────────────────────────────────────────────
  // Priority: "dari [Toko]" beats "ini [Orang] dari [Toko]" — store name after "dari"
  const namePatterns = [
    /\bdari\s+([A-Z][a-zA-Z\s]{2,30})/,                          // "dari Warung Sedap" / "Pak Budi dari Warung Sedap"
    /(?:nama[:\s]+|customer[:\s]+)\s*([A-Z][a-zA-Z\s]{2,30})/,  // "nama: Warung Segar"
    /(?:ini|saya|kami)\s+([A-Z][a-zA-Z\s]{2,20})/,              // "ini Pak Budi" (fallback — orang, bukan toko)
    /^([A-Z][a-zA-Z\s]{2,20})(?:\s+(?:mau|pesan|order|beli|minta))/, // "Warung Segar mau pesan..."
  ]
  let customerName: string | null = null
  for (const pat of namePatterns) {
    const m = text.match(pat)
    if (m) { customerName = m[1].trim(); break }
  }

  // ── Notes ─────────────────────────────────────────────────────────────────
  // Anything after "catatan:", "note:", "keterangan:", or "ps:"
  const notesMatch = text.match(/(?:catatan|note|keterangan|ps)[:\s]+(.+)/i)
  const notes = notesMatch ? notesMatch[1].trim() : null

  return { customerName, customerPhone, orderedQty, uomHint, deliveryDate, notes }
}

// ─── POST /api/orders/parse-wa ────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const { message } = await req.json()
    if (!message?.trim()) {
      return apiError('Pesan tidak boleh kosong', 400)
    }

    const result = parseWAMessage(message)
    return apiSuccess(result)
  } catch (err) {
    return apiServerError(err)
  }
}

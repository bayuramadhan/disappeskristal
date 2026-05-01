import { NextRequest } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { requireAuth } from '@/lib/api/auth'
import { apiSuccess, apiError, apiServerError } from '@/lib/api/response'

const PROMPT = `Kamu adalah asisten yang membantu mengekstrak informasi pesanan es kristal dari pesan WhatsApp.

Ekstrak informasi berikut dari pesan di bawah dan kembalikan dalam format JSON:
- customerName: nama pelanggan (string, wajib)
- customerPhone: nomor telepon jika ada (string atau null)
- orderedQty: jumlah pesanan dalam sak (number, wajib — jika tidak disebutkan anggap null)
- deliveryDate: tanggal pengiriman format YYYY-MM-DD (string atau null — hari ini: {TODAY}, besok: {TOMORROW})
- notes: catatan tambahan jika ada (string atau null)

Aturan:
- Jika pesan menyebut "besok" gunakan tanggal besok, "hari ini" gunakan tanggal hari ini
- Jika ada angka yang jelas untuk jumlah sak, gunakan itu
- Nama pelanggan bisa dari teks seperti "ini [nama]", "dari [nama]", atau awalan pesan
- Kembalikan HANYA JSON valid, tanpa penjelasan lain

Pesan WhatsApp:
{MESSAGE}`

export async function POST(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  if (!process.env.GEMINI_API_KEY) {
    return apiError('GEMINI_API_KEY belum dikonfigurasi', 503)
  }

  try {
    const { message } = await req.json()
    if (!message?.trim()) {
      return apiError('Pesan tidak boleh kosong', 400)
    }

    const today    = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const fmt = (d: Date) => d.toISOString().slice(0, 10)

    const prompt = PROMPT
      .replace('{TODAY}',    fmt(today))
      .replace('{TOMORROW}', fmt(tomorrow))
      .replace('{MESSAGE}',  message.trim())

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
    const result = await model.generateContent(prompt)
    const text   = result.response.text().trim()

    // Strip markdown code fences if present
    const json = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/, '').trim()

    let parsed: {
      customerName:  string | null
      customerPhone: string | null
      orderedQty:    number | null
      deliveryDate:  string | null
      notes:         string | null
    }

    try {
      parsed = JSON.parse(json)
    } catch {
      return apiError('Gagal memparse respons AI. Coba lagi atau periksa format pesan.', 422)
    }

    return apiSuccess({
      customerName:  parsed.customerName  ?? null,
      customerPhone: parsed.customerPhone ?? null,
      orderedQty:    parsed.orderedQty    ?? null,
      deliveryDate:  parsed.deliveryDate  ?? fmt(tomorrow),
      notes:         parsed.notes         ?? null,
    })
  } catch (err) {
    return apiServerError(err)
  }
}

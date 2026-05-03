import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { apiSuccess, apiError } from '@/lib/api/response'

function fmt(d: Date) { return d.toISOString().slice(0, 10) }

// ─── Rule-based WA message parser ────────────────────────────────────────────
function parseWAMessage(message: string) {
  const text = message.trim()
  const lower = text.toLowerCase()

  const today    = new Date()
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  const dayAfter = new Date(today); dayAfter.setDate(today.getDate() + 2)

  // ── Qty ───────────────────────────────────────────────────────────────────
  // Match patterns: "10 sak", "pesan 5", "order 20 karung", "minta 3sak"
  const qtyPatterns = [
    /(\d+)\s*(?:sak|karung|bag|pcs|unit)/i,
    /(?:pesan|order|minta|beli|butuh|mau|request)\s+(\d+)/i,
    /(\d+)\s+(?:sak|karung)/i,
  ]
  let orderedQty: number | null = null
  for (const pat of qtyPatterns) {
    const m = text.match(pat)
    if (m) { orderedQty = parseInt(m[1]); break }
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

  return { customerName, customerPhone, orderedQty, deliveryDate, notes }
}

// ─── POST /api/webhook/fonnte ───────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { sender, message } = body

    if (!message?.trim()) {
      return apiError('Pesan kosong', 400)
    }

    console.log('Webhook Fonnte:', { sender, message })

    // Parse pesan WA
    const parsed = parseWAMessage(message)
    console.log('Parsed:', parsed)

    // Cari customer berdasarkan nama atau phone
    let customer = null
    if (parsed.customerName || parsed.customerPhone) {
      const where: any = {}
      if (parsed.customerName) {
        where.name = { contains: parsed.customerName, mode: 'insensitive' }
      }
      if (parsed.customerPhone) {
        where.phone = { contains: parsed.customerPhone }
      }

      customer = await prisma.customer.findFirst({
        where,
        include: { rayon: true }
      })
    }

    // Jika semua data lengkap, coba buat order otomatis
    if (customer && parsed.orderedQty) {
      // Cari harga dari PriceProfile
      const priceProfiles = await prisma.priceProfile.findMany({
        where: {
          customerType: customer.customerType,
          channel: 'HOTLINE',
          validFrom: { lte: new Date(parsed.deliveryDate) },
          validUntil: { gte: new Date(parsed.deliveryDate) },
          OR: [
            { rayonId: customer.rayonId },
            { rayonId: null } // semua rayon
          ]
        },
        orderBy: { rayonId: 'desc' } // prefer spesifik rayon
      })

      const priceProfile = priceProfiles[0]
      if (priceProfile) {
        // Buat order langsung
        const order = await prisma.order.create({
          data: {
            customerId: customer.id,
            orderChannel: 'HOTLINE',
            deliveryDate: new Date(parsed.deliveryDate),
            orderedQty: parsed.orderedQty,
            pricePerUnit: priceProfile.price,
            notes: parsed.notes,
            status: 'CREATED'
          }
        })

        console.log('Order created:', order.id)

        // Kirim konfirmasi ke pelanggan
        try {
          await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/webhook/fonnte/send`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              // Internal call - no auth needed
            },
            body: JSON.stringify({
              target: sender,
              message: `✅ Pesanan Anda telah diterima!\n\n📦 ${parsed.orderedQty} sak es kristal\n📅 Pengiriman: ${parsed.deliveryDate}\n💰 Harga: Rp ${priceProfile.price.toLocaleString('id-ID')}/sak\n🏪 ${customer.name}\n\nTerima kasih telah memesan!`
            })
          })
        } catch (sendErr) {
          console.error('Failed to send confirmation:', sendErr)
        }

        return apiSuccess({
          action: 'order_created',
          orderId: order.id,
          customer: customer.name,
          qty: parsed.orderedQty
        })
      }
    }

    // Jika tidak bisa buat order otomatis, simpan sebagai draft
    const draft = await prisma.waDraft.create({
      data: {
        rawMessage: message,
        sender: sender,
        customerNameHint: parsed.customerName,
        customerId: customer?.id ?? null,
        orderedQty: parsed.orderedQty,
        deliveryDate: parsed.deliveryDate,
        notes: parsed.notes,
      }
    })

    console.log('Draft created:', draft.id)
    return apiSuccess({
      action: 'draft_created',
      draftId: draft.id,
      reason: customer ? 'price_not_found' : 'customer_not_found'
    })

  } catch (err) {
    console.error('Webhook error:', err)
    return apiError('Internal server error', 500)
  }
}
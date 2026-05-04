import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { apiSuccess, apiError } from '@/lib/api/response'

function fmt(d: Date) { return d.toISOString().slice(0, 10) }

// ─── Rule-based WA message parser ────────────────────────────────────────────
function parseWAMessage(message: string) {
  const text  = message.trim()
  const lower = text.toLowerCase()

  const today    = new Date()
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  const dayAfter = new Date(today); dayAfter.setDate(today.getDate() + 2)

  // ── Qty ───────────────────────────────────────────────────────────────────
  const qtyPatterns = [
    /(\d+)\s*(?:sak|karung|bag|pcs|unit|koli)/i,
    /(?:pesan|order|minta|beli|butuh|mau|ambil|kirim|antar|request|mesen)\s+(\d+)/i,
    /(\d+)\s+(?:sak|karung|bag)/i,
  ]
  let orderedQty: number | null = null
  for (const pat of qtyPatterns) {
    const m = text.match(pat)
    if (m) { orderedQty = parseInt(m[1]); break }
  }

  // ── Date ─────────────────────────────────────────────────────────────────
  let deliveryDate: string = fmt(tomorrow) // default besok

  const days: Record<string, number> = {
    minggu:0, ahad:0, sunday:0,
    senin:1, monday:1,
    selasa:2, tuesday:2,
    rabu:3, wednesday:3,
    kamis:4, thursday:4,
    jumat:5, jum:5, friday:5,
    sabtu:6, saturday:6,
  }
  const months: Record<string, number> = {
    jan:1, feb:2, mar:3, apr:4, mei:5, jun:6,
    jul:7, agu:8, sep:9, okt:10, nov:11, des:12,
    may:5, aug:8, oct:10, dec:12,
  }

  if (/hari\s*ini|sekarang|today/i.test(lower)) {
    deliveryDate = fmt(today)
  } else if (/lusa|overmorgen/i.test(lower)) {
    deliveryDate = fmt(dayAfter)
  } else if (/besok|tomorrow/i.test(lower)) {
    deliveryDate = fmt(tomorrow)
  } else {
    // ISO: 2026-05-15
    const isoMatch = text.match(/(\d{4}-\d{2}-\d{2})/)
    if (isoMatch) {
      deliveryDate = isoMatch[1]
    } else {
      // "tanggal 15 Mei" / "tgl 5 jun" / "5 Mei"
      const longDate = text.match(/(?:tgl\.?|tanggal)?\s*(\d{1,2})\s+([a-zA-Z]{3,})/i)
      if (longDate) {
        const day   = parseInt(longDate[1])
        const mon   = months[longDate[2].toLowerCase().slice(0, 3)]
        if (mon) {
          const year = today.getFullYear()
          const d    = new Date(year, mon - 1, day)
          if (d < today) d.setFullYear(year + 1)
          deliveryDate = fmt(d)
        }
      } else {
        // "5/5" / "15/05" / "15/05/26"
        const slashDate = text.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/)
        if (slashDate) {
          const day  = parseInt(slashDate[1])
          const mon  = parseInt(slashDate[2])
          const yr   = slashDate[3] ? parseInt(slashDate[3]) : today.getFullYear()
          deliveryDate = fmt(new Date(yr < 100 ? 2000 + yr : yr, mon - 1, day))
        } else {
          // "hari Senin" / "Selasa depan"
          for (const [name, dow] of Object.entries(days)) {
            if (lower.includes(name)) {
              const d   = new Date(today)
              const cur = d.getDay()
              let diff  = dow - cur
              if (diff <= 0) diff += 7   // selalu ke depan
              d.setDate(d.getDate() + diff)
              deliveryDate = fmt(d)
              break
            }
          }
        }
      }
    }
  }

  // ── Customer name ─────────────────────────────────────────────────────────
  // Case-insensitive — banyak orang WA tidak pakai huruf kapital
  const namePatterns: RegExp[] = [
    /\bdari\s+([a-zA-Z][a-zA-Z\s]{2,30})/i,                       // "dari Warung Sedap"
    /(?:nama|customer)[:\s]+([a-zA-Z][a-zA-Z\s]{2,30})/i,         // "nama: Warung Segar"
    /(?:toko|warung|depot|kios)\s+([a-zA-Z][a-zA-Z\s]{1,25})/i,   // "toko Maju Jaya"
    /(?:ini|saya|kami)\s+([a-zA-Z][a-zA-Z\s]{2,25})/i,            // "ini Pak Budi"
    /^([a-zA-Z][a-zA-Z\s]{2,25})\s+(?:mau|pesan|order|beli|minta|butuh)/i, // "Warung Segar mau..."
  ]
  let customerName: string | null = null
  for (const pat of namePatterns) {
    const m = text.match(pat)
    if (m) { customerName = m[1].trim(); break }
  }

  // ── Notes ─────────────────────────────────────────────────────────────────
  const notesMatch = text.match(/(?:catatan|note|keterangan|ps|info)[:\s]+(.+)/i)
  const notes      = notesMatch ? notesMatch[1].trim() : null

  return { customerName, orderedQty, deliveryDate, notes }
}

// ─── Normalize phone untuk matching ──────────────────────────────────────────
function normalizePhone(raw: string): string {
  let p = raw.replace(/[\s\-().+]/g, '')
  if (p.startsWith('62')) p = '0' + p.slice(2)
  return p
}

// ─── POST /api/webhook/fonnte ───────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { sender, message } = body

    if (!message?.trim()) return apiError('Pesan kosong', 400)

    console.log('Webhook Fonnte:', { sender, message })

    const parsed = parseWAMessage(message)
    console.log('Parsed:', parsed)

    // ── Customer lookup: sender phone number first (paling reliable), lalu nama ──
    let customer = null

    if (sender) {
      const normalized = normalizePhone(String(sender))
      customer = await prisma.customer.findFirst({
        where:   { phone: { contains: normalized.slice(-8) } }, // 8 digit akhir
        include: { rayon: true },
      })
    }

    if (!customer && parsed.customerName) {
      customer = await prisma.customer.findFirst({
        where:   { name: { contains: parsed.customerName, mode: 'insensitive' } },
        include: { rayon: true },
      })
    }

    // ── Auto-create order jika semua data lengkap ─────────────────────────────
    if (customer && parsed.orderedQty) {
      const priceProfiles = await prisma.priceProfile.findMany({
        where: {
          customerType: customer.customerType,
          channel:      'HOTLINE',
          validFrom:    { lte: new Date(parsed.deliveryDate) },
          validUntil:   { gte: new Date(parsed.deliveryDate) },
          OR: [{ rayonId: customer.rayonId }, { rayonId: null }],
        },
        orderBy: { rayonId: 'desc' },
      })

      const priceProfile = priceProfiles[0]
      if (priceProfile) {
        const dateStr     = new Date(parsed.deliveryDate).toISOString().slice(0, 10).replace(/-/g, '')
        const todayCount  = await prisma.order.count({ where: { orderNumber: { startsWith: `ORD-${dateStr}-` } } })
        const orderNumber = `ORD-${dateStr}-${String(todayCount + 1).padStart(3, '0')}`

        const order = await prisma.order.create({
          data: {
            orderNumber,
            customerId:   customer.id,
            orderChannel: 'HOTLINE',
            deliveryDate: new Date(parsed.deliveryDate),
            orderedQty:   parsed.orderedQty,
            pricePerUnit: priceProfile.price,
            notes:        parsed.notes,
            status:       'CREATED',
          },
        })

        console.log('Order created:', order.id)

        try {
          await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/webhook/fonnte/send`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              target:  sender,
              message: `✅ Pesanan Anda telah diterima!\n\n📦 ${parsed.orderedQty} sak es kristal\n📅 Pengiriman: ${parsed.deliveryDate}\n💰 Harga: Rp ${priceProfile.price.toLocaleString('id-ID')}/sak\n🏪 ${customer.name}\n\nTerima kasih telah memesan!`,
            }),
          })
        } catch (sendErr) {
          console.error('Failed to send confirmation:', sendErr)
        }

        return apiSuccess({ action: 'order_created', orderId: order.id, customer: customer.name, qty: parsed.orderedQty })
      }
    }

    // ── Simpan sebagai draft ──────────────────────────────────────────────────
    const draft = await prisma.waDraft.create({
      data: {
        rawMessage:       message,
        sender:           sender ?? null,
        customerNameHint: parsed.customerName,
        customerId:       customer?.id ?? null,
        orderedQty:       parsed.orderedQty,
        deliveryDate:     parsed.deliveryDate,
        notes:            parsed.notes,
      },
    })

    console.log('Draft created:', draft.id)
    return apiSuccess({
      action: 'draft_created',
      draftId: draft.id,
      reason:  customer ? 'price_not_found' : 'customer_not_found',
    })

  } catch (err) {
    console.error('Webhook error:', err)
    return apiError('Internal server error', 500)
  }
}

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

  // ── Qty + Unit ────────────────────────────────────────────────────────────
  const unitPatterns: { pat: RegExp; uom: string }[] = [
    { pat: /(\d+(?:[.,]\d+)?)\s*(?:ton|tonne)\b/i,                    uom: 'ton' },
    { pat: /(\d+(?:[.,]\d+)?)\s*(?:kilogram|kilogramme|kg)\b/i,       uom: 'kg'  },
    { pat: /(\d+(?:[.,]\d+)?)\s*(?:sak|karung|bag|koli|pcs|unit)\b/i, uom: 'sak' },
  ]
  let orderedQty: number | null = null
  let uomHint: string | null    = null
  for (const { pat, uom } of unitPatterns) {
    const m = text.match(pat)
    if (m) { orderedQty = parseFloat(m[1].replace(',', '.')); uomHint = uom; break }
  }
  if (orderedQty === null) {
    const m = text.match(/(?:pesan|order|minta|beli|butuh|mau|ambil|kirim|antar|request|mesen)\s+(\d+(?:[.,]\d+)?)/i)
    if (m) { orderedQty = parseFloat(m[1].replace(',', '.')); uomHint = 'sak' }
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

  return { customerName, orderedQty, uomHint, deliveryDate, notes }
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
    console.log('UOM hint:', parsed.uomHint, '| orderedQty:', parsed.orderedQty)

    // ── Customer lookup: cari via PIC phone dulu, lalu nama customer ────────────
    const customerInclude = {
      locations: {
        where:   { isDefault: true, deletedAt: null as null },
        take:    1,
        select:  { id: true, rayonId: true, namaLokasi: true },
      },
    }

    let customer = null

    if (sender) {
      const normalized = normalizePhone(String(sender))
      const suffix8    = normalized.slice(-8)

      // Cari lewat PIC aktif yang phone-nya cocok
      const pic = await prisma.customerPIC.findFirst({
        where: {
          phone:     { contains: suffix8 },
          isActive:  true,
          deletedAt: null,
        },
        select: { customerId: true },
      })

      if (pic) {
        customer = await prisma.customer.findFirst({
          where:   { id: pic.customerId, deletedAt: null },
          include: customerInclude,
        })
      }
    }

    if (!customer && parsed.customerName) {
      customer = await prisma.customer.findFirst({
        where:   { name: { contains: parsed.customerName, mode: 'insensitive' } },
        include: customerInclude,
      })
    }

    // ── Resolve unit dari uomHint ─────────────────────────────────────────────
    // Cari Unit record berdasarkan singkatan yang terdeteksi parser
    // null = sak (base unit), tidak perlu dicari
    let resolvedUnit: { id: string; abbreviation: string; unitsPerSak: number } | null = null
    if (parsed.uomHint && parsed.uomHint !== 'sak') {
      resolvedUnit = await prisma.unit.findUnique({
        where:  { abbreviation: parsed.uomHint },
        select: { id: true, abbreviation: true, unitsPerSak: true },
      }) ?? null
    }
    const uomId        = resolvedUnit?.id ?? null
    const uomLabel     = resolvedUnit?.abbreviation ?? 'sak'
    const unitsPerSak  = resolvedUnit?.unitsPerSak ?? 1
    console.log('Resolved unit:', resolvedUnit, '| uomLabel:', uomLabel, '| unitsPerSak:', unitsPerSak)

    // ── Auto-create order jika semua data lengkap ─────────────────────────────
    if (customer && parsed.orderedQty) {
      const defaultLocation = customer.locations[0]
      const customerRayonId = defaultLocation?.rayonId ?? null

      const priceProfiles = await prisma.priceProfile.findMany({
        where: {
          customerType: customer.customerType,
          channel:      'HOTLINE',
          validFrom:    { lte: new Date(parsed.deliveryDate) },
          validUntil:   { gte: new Date(parsed.deliveryDate) },
          OR: [{ rayonId: customerRayonId }, { rayonId: null }],
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
            customerId:         customer.id,
            deliveryLocationId: defaultLocation?.id ?? null,
            rayonId:            customerRayonId,
            orderChannel:       'HOTLINE',
            deliveryDate:       new Date(parsed.deliveryDate),
            orderedQty:         parsed.orderedQty,
            uomId,
            pricePerUnit:       priceProfile.price,
            notes:              parsed.notes,
            status:             'CREATED',
          },
        })

        console.log('Order created:', order.id)

        // Tulis ActivityLog — source adalah Fonnte webhook, bukan operator manual
        prisma.activityLog.create({
          data: {
            action:    'ORDER_CREATED',
            userName:  'Fonnte (WA)',
            userEmail: sender ? String(sender) : null,
            orderId:   order.id,
            date:      new Date(parsed.deliveryDate),
            meta: {
              orderNumber,
              customerName: customer.name,
              orderedQty:   parsed.orderedQty,
              uom:          uomLabel,
              pricePerUnit: priceProfile.price,
              orderChannel: 'HOTLINE',
              source:       'fonnte_webhook',
              sender:       sender ?? null,
            } as any,
          },
        }).catch(() => null)

        try {
          const [yyyy, mm, dd] = parsed.deliveryDate.split('-')
          const tglFmt  = `${dd}/${mm}/${yyyy}`
          // Harga selalu /sak, konversi qty ke sak untuk hitung total
          const qtySak  = parsed.orderedQty / unitsPerSak
          const total   = (qtySak * priceProfile.price).toLocaleString('id-ID')
          // Tampilkan qty dalam unit yang dipesan pelanggan
          const qtyDisp = Number.isInteger(parsed.orderedQty)
            ? parsed.orderedQty
            : parseFloat(parsed.orderedQty.toFixed(2))
          // Baris konversi (hanya tampil jika bukan sak)
          const konversi = uomLabel !== 'sak'
            ? `\n⚖️ ${qtyDisp} ${uomLabel} = ${parseFloat(qtySak.toFixed(2))} sak`
            : ''

          await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/webhook/fonnte/send`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              target:  sender,
              message: `✅ Pesanan diterima!\n\n🏪 ${customer.name}\n📦 ${qtyDisp} ${uomLabel} es kristal${konversi}\n📅 Tanggal kirim: ${tglFmt}\n💰 ${priceProfile.price.toLocaleString('id-ID')}/sak × ${parseFloat(qtySak.toFixed(2))} sak = Rp ${total}\n🔖 No. Pesanan: ${orderNumber}\n\nTerima kasih sudah memesan! 🙏`,
            }),
          })
        } catch (sendErr) {
          console.error('Failed to send confirmation:', sendErr)
        }

        return apiSuccess({ action: 'order_created', orderId: order.id, customer: customer.name, qty: parsed.orderedQty, uom: uomLabel })
      }
    }

    // ── Simpan sebagai draft ──────────────────────────────────────────────────
    const draftLocationId = customer?.locations?.[0]?.id ?? null

    const draft = await prisma.waDraft.create({
      data: {
        rawMessage:         message,
        sender:             sender ?? null,
        customerNameHint:   parsed.customerName,
        customerId:         customer?.id ?? null,
        deliveryLocationId: draftLocationId,
        orderedQty:         parsed.orderedQty,
        uomId,
        deliveryDate:       parsed.deliveryDate,
        notes:              parsed.notes,
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

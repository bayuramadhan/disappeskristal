import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/api/auth'
import {
  apiSuccess, apiCreated, apiError, apiServerError,
  parsePagination, makeMeta, parseDate, todayDate,
} from '@/lib/api/response'
import { orderSchema } from '@/lib/validations'

// ─── GET /api/orders ──────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const sp     = req.nextUrl.searchParams
    const { page, limit, skip } = parsePagination(sp)

    // ── Filters
    const dateParam  = sp.get('date')
    const status     = sp.get('status')
    const channel    = sp.get('channel')
    const rayonId    = sp.get('rayonId')
    const vehicleId  = sp.get('vehicleId')
    const customerId = sp.get('customerId')
    const search     = sp.get('search')

    const where: Record<string, unknown> = { deletedAt: null }

    if (dateParam) where.deliveryDate = parseDate(dateParam, todayDate())
    if (status) {
      // Support comma-separated: status=CONFIRMED,ASSIGNED
      const statuses = status.split(',').map((s: string) => s.trim()).filter(Boolean)
      where.status = statuses.length === 1 ? statuses[0] : { in: statuses }
    }
    if (channel)   where.orderChannel = channel
    if (rayonId)   where.rayonId      = rayonId
    if (vehicleId) where.vehicleId    = vehicleId
    if (customerId) where.customerId  = customerId
    if (search) {
      where.customer = { name: { contains: search, mode: 'insensitive' } }
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take:    limit,
        orderBy: [{ deliveryDate: 'desc' }, { createdAt: 'desc' }],
        include: {
          customer:         { select: { id: true, name: true, customerType: true } },
          deliveryLocation: { select: { id: true, namaLokasi: true, alamat: true } },
          vehicle:          { select: { id: true, plateNumber: true } },
          rayon:            { select: { id: true, name: true } },
          uom:              { select: { id: true, name: true, abbreviation: true, unitsPerSak: true } },
          _count:           { select: { deliveryLogs: true } },
          vehicleAssignments: {
            where:  { deletedAt: null },
            select: { vehicleId: true, qty: true },
          },
        },
      }),
      prisma.order.count({ where }),
    ])

    // Enrich: tambahkan totalAllocated & remainingQty per pesanan
    const enriched = orders.map(o => {
      const totalAllocated = o.vehicleAssignments.reduce((s, a) => s + a.qty, 0)
      return { ...o, totalAllocated, remainingQty: o.orderedQty - totalAllocated }
    })

    return apiSuccess(enriched, undefined, makeMeta(page, limit, total))
  } catch (err) {
    return apiServerError(err)
  }
}

// ─── POST /api/orders ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth()
  if (error) return error

  try {
    const body   = await req.json()
    const parsed = orderSchema.safeParse(body)
    if (!parsed.success) {
      return apiError('Validasi gagal', 400, parsed.error.flatten().fieldErrors)
    }

    const { customerId, deliveryLocationId, vehicleId, rayonId, orderChannel, orderType,
            orderedQty, uomId, pricePerUnit, deliveryDate, notes } = parsed.data

    // Resolve deliveryLocation: gunakan yang dikirim, atau fallback ke default customer
    const location = deliveryLocationId
      ? await prisma.customerLocation.findFirst({
          where:  { id: deliveryLocationId, customerId, deletedAt: null },
          select: { id: true, rayonId: true },
        })
      : await prisma.customerLocation.findFirst({
          where:   { customerId, deletedAt: null, isDefault: true },
          select:  { id: true, rayonId: true },
        })

    if (!location) return apiError('Lokasi pengiriman tidak ditemukan', 404)

    const resolvedRayonId    = rayonId ?? location.rayonId ?? undefined
    const resolvedLocationId = location.id

    // Generate orderNumber: ORD-YYYYMMDD-XXX
    const dateStr    = new Date(deliveryDate).toISOString().slice(0, 10).replace(/-/g, '')
    const todayCount = await prisma.order.count({
      where: { orderNumber: { startsWith: `ORD-${dateStr}-` } },
    })
    const orderNumber = `ORD-${dateStr}-${String(todayCount + 1).padStart(3, '0')}`

    const order = await prisma.order.create({
      data: {
        orderNumber,
        customerId,
        deliveryLocationId: resolvedLocationId,
        vehicleId:    vehicleId ?? null,
        rayonId:      resolvedRayonId ?? null,
        orderChannel: orderChannel as any,
        orderType:    orderType ?? 'ES_KRISTAL',
        orderedQty,
        uomId:        uomId ?? null,
        pricePerUnit,
        deliveryDate: new Date(deliveryDate),
        notes:        notes ?? null,
      },
      include: {
        customer:         { select: { id: true, name: true } },
        deliveryLocation: { select: { id: true, namaLokasi: true, alamat: true } },
        vehicle:          { select: { id: true, plateNumber: true } },
        rayon:            { select: { id: true, name: true } },
        uom:              { select: { id: true, name: true, abbreviation: true, unitsPerSak: true } },
      },
    })

    // Tulis activity log (non-blocking)
    prisma.activityLog.create({
      data: {
        action:    'ORDER_CREATED',
        userId:    user!.id,
        userName:  user!.name,
        userEmail: user!.email,
        orderId:   order.id,
        date:      new Date(deliveryDate),
        meta: {
          orderNumber:  order.orderNumber,
          customerName: order.customer?.name,
          orderedQty,
          pricePerUnit,
          orderChannel,
        } as any,
      },
    }).catch(() => null)

    return apiCreated(order, 'Order berhasil dibuat')
  } catch (err) {
    return apiServerError(err)
  }
}

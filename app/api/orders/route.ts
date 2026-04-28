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
    if (status)    where.status       = status
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
          customer: { select: { id: true, name: true, phone: true, customerType: true } },
          vehicle:  { select: { id: true, plateNumber: true } },
          rayon:    { select: { id: true, name: true } },
          _count:   { select: { deliveryLogs: true } },
        },
      }),
      prisma.order.count({ where }),
    ])

    return apiSuccess(orders, undefined, makeMeta(page, limit, total))
  } catch (err) {
    return apiServerError(err)
  }
}

// ─── POST /api/orders ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const body   = await req.json()
    const parsed = orderSchema.safeParse(body)
    if (!parsed.success) {
      return apiError('Validasi gagal', 400, parsed.error.flatten().fieldErrors)
    }

    const { customerId, vehicleId, rayonId, orderChannel, orderType,
            orderedQty, pricePerUnit, deliveryDate, notes } = parsed.data

    // Auto-resolve rayonId from customer if not provided
    let resolvedRayonId = rayonId
    if (!resolvedRayonId) {
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { rayonId: true },
      })
      if (!customer) return apiError('Customer tidak ditemukan', 404)
      resolvedRayonId = customer.rayonId ?? undefined
    }

    const order = await prisma.order.create({
      data: {
        customerId,
        vehicleId:    vehicleId ?? null,
        rayonId:      resolvedRayonId ?? null,
        orderChannel: orderChannel as any,
        orderType:    orderType ?? 'ES_KRISTAL',
        orderedQty,
        pricePerUnit,
        deliveryDate: new Date(deliveryDate),
        notes:        notes ?? null,
      },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        vehicle:  { select: { id: true, plateNumber: true } },
        rayon:    { select: { id: true, name: true } },
      },
    })

    return apiCreated(order, 'Order berhasil dibuat')
  } catch (err) {
    return apiServerError(err)
  }
}

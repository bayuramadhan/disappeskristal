import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/api/auth'
import {
  apiSuccess, apiCreated, apiError, apiNotFound, apiServerError,
  parsePagination, makeMeta, parseDate, todayDate,
} from '@/lib/api/response'
import { deliveryLogSchema } from '@/lib/validations'

// ─── Derived order status from qty ───────────────────────────────────────────
function deriveOrderStatus(
  orderedQty: number,
  deliveredQty: number,
  returnedQty: number,
): 'DELIVERED' | 'PARTIAL' | 'RETURNED' | 'CANCELLED' {
  if (deliveredQty >= orderedQty)          return 'DELIVERED'
  if (deliveredQty > 0)                    return 'PARTIAL'
  if (returnedQty  > 0)                    return 'RETURNED'
  return 'CANCELLED'
}

// ─── GET /api/delivery-logs ───────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const sp = req.nextUrl.searchParams
    const { page, limit, skip } = parsePagination(sp)

    const dateParam = sp.get('date')
    const vehicleId = sp.get('vehicleId')
    const driverId  = sp.get('driverId')
    const orderId   = sp.get('orderId')

    const where: Record<string, unknown> = {}
    if (vehicleId) where.vehicleId = vehicleId
    if (driverId)  where.driverId  = driverId
    if (orderId)   where.orderId   = orderId
    if (dateParam) {
      const date    = parseDate(dateParam, todayDate())
      const nextDay = new Date(date)
      nextDay.setDate(nextDay.getDate() + 1)
      where.timestamp = { gte: date, lt: nextDay }
    }

    const [logs, total] = await Promise.all([
      prisma.deliveryLog.findMany({
        where,
        skip,
        take:    limit,
        orderBy: { timestamp: 'desc' },
        include: {
          order: {
            select: {
              id: true, orderedQty: true, deliveredQty: true,
              returnedQty: true, pricePerUnit: true, status: true,
              customer: { select: { id: true, name: true, phone: true } },
            },
          },
          vehicle: { select: { id: true, plateNumber: true } },
          driver:  { select: { id: true, name: true } },
        },
      }),
      prisma.deliveryLog.count({ where }),
    ])

    return apiSuccess(logs, undefined, makeMeta(page, limit, total))
  } catch (err) {
    return apiServerError(err)
  }
}

// ─── POST /api/delivery-logs ──────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const body   = await req.json()
    const parsed = deliveryLogSchema.safeParse(body)
    if (!parsed.success) {
      return apiError('Validasi gagal', 400, parsed.error.flatten().fieldErrors)
    }

    const { orderId, vehicleId, driverId, deliveredQty, returnedQty, returnReason, timestamp } = parsed.data

    // Validate order exists and isn't already finalised
    const order = await prisma.order.findFirst({
      where: { id: orderId, deletedAt: null },
    })
    if (!order) return apiNotFound('Order')

    if (['DELIVERED', 'CANCELLED', 'REJECTED'].includes(order.status)) {
      return apiError(`Order sudah berstatus ${order.status}, tidak dapat menambah log pengiriman`, 409)
    }

    // Validate vehicle & driver exist
    const [vehicle, driver] = await Promise.all([
      prisma.vehicle.findFirst({ where: { id: vehicleId, deletedAt: null } }),
      prisma.driver.findFirst({ where: { id: driverId, deletedAt: null } }),
    ])
    if (!vehicle) return apiError('Kendaraan tidak ditemukan', 404)
    if (!driver)  return apiError('Driver tidak ditemukan', 404)

    // Determine new order status
    const newOrderStatus = deriveOrderStatus(order.orderedQty, deliveredQty, returnedQty ?? 0)

    // Find active fleet entry for this vehicle on delivery date
    const deliveryDate = new Date(order.deliveryDate)
    const fleet = await prisma.fleetDailyStatus.findFirst({
      where: { vehicleId, date: deliveryDate, deletedAt: null },
    })

    // Net qty leaving the vehicle = delivered - returned (returned comes back)
    const netOut = deliveredQty - (returnedQty ?? 0)

    // Validate net qty doesn't exceed remaining load
    if (fleet && netOut > (fleet.remainingLoad ?? 0)) {
      return apiError(
        `Jumlah terkirim melebihi sisa muatan armada (sisa: ${fleet.remainingLoad} sak)`,
        400,
      )
    }

    // Run in transaction: create log + update order + update fleet remaining load
    const [log] = await prisma.$transaction([
      prisma.deliveryLog.create({
        data: {
          orderId,
          vehicleId,
          driverId,
          deliveredQty,
          returnedQty:  returnedQty ?? 0,
          returnReason: returnReason as any ?? null,
          timestamp:    timestamp ? new Date(timestamp) : new Date(),
        },
      }),
      prisma.order.update({
        where: { id: orderId },
        data: {
          deliveredQty,
          returnedQty:  returnedQty ?? 0,
          status:       newOrderStatus as any,
        },
      }),
      ...(fleet ? [
        prisma.fleetDailyStatus.update({
          where: { id: fleet.id },
          data: {
            remainingLoad: { decrement: netOut < 0 ? 0 : netOut },
          },
        }),
      ] : []),
    ])

    const fullLog = await prisma.deliveryLog.findUnique({
      where: { id: log.id },
      include: {
        order:   { select: { id: true, status: true, orderedQty: true, deliveredQty: true } },
        vehicle: { select: { id: true, plateNumber: true } },
        driver:  { select: { id: true, name: true } },
      },
    })

    return apiCreated(
      { ...fullLog, orderStatusUpdatedTo: newOrderStatus },
      `Log pengiriman dibuat. Status order diperbarui ke ${newOrderStatus}`,
    )
  } catch (err) {
    return apiServerError(err)
  }
}

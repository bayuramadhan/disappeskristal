import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/api/auth'
import { apiSuccess, apiCreated, apiError, apiServerError, parseDate, todayDate } from '@/lib/api/response'
import { fleetDailyStatusSchema } from '@/lib/validations'

// ─── GET /api/fleet ───────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const sp = req.nextUrl.searchParams
    const date      = parseDate(sp.get('date'), todayDate())
    const vehicleId = sp.get('vehicleId')
    const rayonId   = sp.get('rayonId')
    const driverId  = sp.get('driverId')

    const where: Record<string, unknown> = { date, deletedAt: null }
    if (vehicleId) where.vehicleId = vehicleId
    if (rayonId)   where.rayonId   = rayonId
    if (driverId)  where.driverId  = driverId

    const fleet = await prisma.fleetDailyStatus.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: {
        vehicle: { select: { id: true, plateNumber: true, capacitySak: true, status: true } },
        driver:  { select: { id: true, name: true, phone: true, status: true } },
        rayon:   { select: { id: true, name: true } },
      },
    })

    // Attach order counts for each fleet entry
    const fleetWithStats = await Promise.all(
      fleet.map(async (f) => {
        const [totalOrders, deliveredOrders] = await Promise.all([
          prisma.order.count({
            where: { vehicleId: f.vehicleId, rayonId: f.rayonId, deliveryDate: date, deletedAt: null },
          }),
          prisma.order.count({
            where: {
              vehicleId: f.vehicleId, rayonId: f.rayonId, deliveryDate: date, deletedAt: null,
              status: { in: ['DELIVERED', 'PARTIAL'] },
            },
          }),
        ])
        return { ...f, stats: { totalOrders, deliveredOrders, pendingOrders: totalOrders - deliveredOrders } }
      })
    )

    return apiSuccess(fleetWithStats, `${fleet.length} armada aktif pada ${date.toISOString().slice(0, 10)}`)
  } catch (err) {
    return apiServerError(err)
  }
}

// ─── POST /api/fleet ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const body   = await req.json()
    const parsed = fleetDailyStatusSchema.safeParse(body)
    if (!parsed.success) {
      return apiError('Validasi gagal', 400, parsed.error.flatten().fieldErrors)
    }

    const { date, vehicleId, driverId, rayonId, helperName, initialLoad } = parsed.data
    const fleetDate = new Date(date)

    // Check vehicle & driver availability on this date
    const [vehicleConflict, driverConflict] = await Promise.all([
      prisma.fleetDailyStatus.findFirst({
        where: { vehicleId, date: fleetDate, deletedAt: null },
      }),
      prisma.fleetDailyStatus.findFirst({
        where: { driverId, date: fleetDate, deletedAt: null },
      }),
    ])

    if (vehicleConflict) {
      return apiError('Kendaraan sudah diaktivasi pada tanggal ini', 409)
    }
    if (driverConflict) {
      return apiError('Driver sudah ditugaskan pada tanggal ini', 409)
    }

    const fleet = await prisma.fleetDailyStatus.create({
      data: {
        date:         fleetDate,
        vehicleId,
        driverId,
        rayonId,
        helperName:   helperName ?? null,
        initialLoad:  initialLoad ?? 0,
        remainingLoad: initialLoad ?? 0,
        activeStatus: true,
      },
      include: {
        vehicle: { select: { id: true, plateNumber: true } },
        driver:  { select: { id: true, name: true } },
        rayon:   { select: { id: true, name: true } },
      },
    })

    return apiCreated(fleet, 'Armada berhasil diaktivasi')
  } catch (err) {
    return apiServerError(err)
  }
}

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/api/auth'
import { apiSuccess, apiServerError, parseDate, todayDate } from '@/lib/api/response'

// ─── GET /api/armada/daily?date= ─────────────────────────────────────────────
// Mengembalikan semua vehicle ACTIVE beserta FleetDailyStatus untuk tanggal tsb.
// Jika FleetDailyStatus belum ada untuk vehicle+driver aktif, auto-create.
export async function GET(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const sp   = req.nextUrl.searchParams
    const date = parseDate(sp.get('date'), todayDate())

    // Ambil semua vehicle aktif beserta driver yang ditugaskan
    const vehicles = await prisma.vehicle.findMany({
      where:   { status: 'ACTIVE', deletedAt: null },
      orderBy: { plateNumber: 'asc' },
      include: {
        drivers: {
          where:  { deletedAt: null, status: 'ACTIVE' },
          select: { id: true, name: true, phone: true },
          take:   1,
        },
      },
    })

    // Cari rayon fallback (rayon pertama aktif) untuk auto-create
    const defaultRayon = await prisma.rayon.findFirst({
      where:   { deletedAt: null, activeStatus: true },
      orderBy: { name: 'asc' },
      select:  { id: true },
    })

    // Auto-create FleetDailyStatus jika belum ada untuk vehicle + driver aktif
    await Promise.all(
      vehicles.map(async (v) => {
        const driver = v.drivers[0]
        if (!driver) return // skip vehicle tanpa driver aktif

        const existing = await prisma.fleetDailyStatus.findFirst({
          where: { vehicleId: v.id, date, deletedAt: null },
        })
        if (existing) return

        // Ambil rayon terakhir yang pernah dipakai vehicle ini
        const lastStatus = await prisma.fleetDailyStatus.findFirst({
          where:   { vehicleId: v.id, deletedAt: null },
          orderBy: { date: 'desc' },
          select:  { rayonId: true },
        })
        const rayonId = lastStatus?.rayonId ?? defaultRayon?.id
        if (!rayonId) return // tidak bisa create tanpa rayon

        await prisma.fleetDailyStatus.create({
          data: {
            date,
            vehicleId:    v.id,
            driverId:     driver.id,
            rayonId,
            initialLoad:  v.capacitySak,
            remainingLoad: v.capacitySak,
            activeStatus: true,
          },
        })
      })
    )

    // Fetch final fleet status untuk tanggal ini
    const fleet = await prisma.fleetDailyStatus.findMany({
      where:   { date, deletedAt: null, vehicle: { status: 'ACTIVE', deletedAt: null } },
      orderBy: { createdAt: 'asc' },
      include: {
        vehicle: { select: { id: true, plateNumber: true, capacitySak: true } },
        driver:  { select: { id: true, name: true, phone: true } },
        rayon:   { select: { id: true, name: true } },
      },
    })

    // Attach pesanan yang sudah diassign ke masing-masing armada
    const result = await Promise.all(
      fleet.map(async (f) => {
        const orders = await prisma.order.findMany({
          where: {
            vehicleId:    f.vehicleId,
            deliveryDate: date,
            deletedAt:    null,
            status:       { notIn: ['CANCELLED', 'REJECTED'] },
          },
          select: {
            id: true, orderNumber: true, orderedQty: true, deliveredQty: true,
            status: true, pricePerUnit: true,
            customer:         { select: { id: true, name: true, customerType: true } },
            deliveryLocation: { select: { id: true, namaLokasi: true, alamat: true } },
            rayon:            { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'asc' },
        })

        const totalAssigned  = orders.reduce((s, o) => s + o.orderedQty, 0)
        const totalDelivered = orders.reduce((s, o) => s + (o.deliveredQty ?? 0), 0)
        const capacitySak    = f.vehicle?.capacitySak ?? 0

        return {
          ...f,
          orders,
          stats: {
            totalOrders:  orders.length,
            totalAssigned,
            totalDelivered,
            capacitySak,
            sisaSlot:     Math.max(0, capacitySak - totalAssigned),
            pctFull:      capacitySak > 0 ? Math.round((totalAssigned / capacitySak) * 100) : 0,
          },
        }
      })
    )

    return apiSuccess(result)
  } catch (err) {
    return apiServerError(err)
  }
}

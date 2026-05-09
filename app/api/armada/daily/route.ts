import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/api/auth'
import { apiSuccess, apiServerError, parseDate, todayDate } from '@/lib/api/response'

// ─── GET /api/armada/daily?date= ─────────────────────────────────────────────
// Mengembalikan semua Armada aktif beserta FleetDailyStatus untuk tanggal tsb.
// Jika FleetDailyStatus belum ada, auto-create dari data master Armada.
export async function GET(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const sp   = req.nextUrl.searchParams
    const date = parseDate(sp.get('date'), todayDate())

    // Ambil semua Armada aktif (vehicle ACTIVE, belum dihapus)
    const armadas = await prisma.armada.findMany({
      where: {
        activeStatus: true,
        deletedAt:    null,
        vehicle:      { status: 'ACTIVE', deletedAt: null },
        driver:       { status: 'ACTIVE', deletedAt: null },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        vehicle: { select: { id: true, plateNumber: true, capacitySak: true } },
        driver:  { select: { id: true, name: true, phone: true } },
        rayon:   { select: { id: true, name: true } },
      },
    })

    // Auto-create FleetDailyStatus untuk setiap armada yang belum punya entry hari ini
    await Promise.all(
      armadas.map(async (a) => {
        const existing = await prisma.fleetDailyStatus.findFirst({
          where: { vehicleId: a.vehicleId, date, deletedAt: null },
        })
        if (existing) return

        await prisma.fleetDailyStatus.create({
          data: {
            date,
            vehicleId:    a.vehicleId,
            driverId:     a.driverId,
            rayonId:      a.rayonId ?? '',   // rayonId wajib di schema — fallback ke empty string jika belum diset
            helperName:   a.helperName ?? null,
            initialLoad:  a.vehicle.capacitySak,
            remainingLoad: a.vehicle.capacitySak,
            activeStatus: true,
          },
        }).catch(() => null)               // skip jika gagal (mis. rayonId kosong & constraint)
      })
    )

    // Fetch final FleetDailyStatus untuk tanggal ini, filter hanya armada aktif
    const armadaVehicleIds = armadas.map(a => a.vehicleId)

    const fleet = await prisma.fleetDailyStatus.findMany({
      where: {
        date,
        deletedAt: null,
        vehicleId: { in: armadaVehicleIds },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        vehicle: { select: { id: true, plateNumber: true, capacitySak: true } },
        driver:  { select: { id: true, name: true, phone: true } },
        rayon:   { select: { id: true, name: true } },
      },
    })

    // Enrich: sertakan data armada master (helper, rayon default) + pesanan hari ini
    const result = await Promise.all(
      fleet.map(async (f) => {
        // Cari armada master yang bersesuaian
        const masterArmada = armadas.find(a => a.vehicleId === f.vehicleId)

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
          // Override helper/rayon dari master armada jika FleetDailyStatus belum diupdate
          helperName: f.helperName ?? masterArmada?.helperName ?? null,
          armadaId:   masterArmada?.id ?? null,
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

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

    // Enrich: gunakan OrderVehicleAssignment untuk kapasitas & daftar pesanan
    const result = await Promise.all(
      fleet.map(async (f) => {
        const masterArmada = armadas.find(a => a.vehicleId === f.vehicleId)

        // Ambil semua assignment untuk vehicle ini pada tanggal ini
        const assignments = await prisma.orderVehicleAssignment.findMany({
          where: {
            vehicleId: f.vehicleId,
            deletedAt: null,
            order: {
              deliveryDate: date,
              deletedAt:    null,
              status:       { notIn: ['CANCELLED', 'REJECTED'] },
            },
          },
          include: {
            order: {
              select: {
                id: true, orderNumber: true, orderedQty: true, deliveredQty: true,
                status: true, pricePerUnit: true,
                customer:         { select: { id: true, name: true, customerType: true } },
                deliveryLocation: { select: { id: true, namaLokasi: true, alamat: true } },
                rayon:            { select: { id: true, name: true } },
                uom:              { select: { abbreviation: true, unitsPerSak: true } },
                // Total alokasi pesanan ini ke SEMUA vehicle (untuk tampilkan split info)
                vehicleAssignments: {
                  where:  { deletedAt: null },
                  select: { vehicleId: true, qty: true },
                },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        })

        // Aggregate delivery logs per orderId untuk vehicle ini
        const orderIds = assignments.map(a => a.orderId)
        const vehicleLogs = orderIds.length > 0
          ? await prisma.deliveryLog.groupBy({
              by:    ['orderId'],
              where: { vehicleId: f.vehicleId, orderId: { in: orderIds } },
              _sum:  { deliveredQty: true, returnedQty: true },
            })
          : []
        const vehicleLogMap = new Map(vehicleLogs.map(l => [l.orderId, l._sum]))

        // Transform: setiap assignment → baris order enriched dengan assignedQty
        const orders = assignments.map(a => {
          const vLog               = vehicleLogMap.get(a.orderId)
          const vehicleDeliveredQty = vLog?.deliveredQty ?? 0
          const vehicleReturnedQty  = vLog?.returnedQty  ?? 0
          const vehicleFullyLogged  = (vehicleDeliveredQty + vehicleReturnedQty) >= a.qty
          return {
            ...a.order,
            assignedQty:        a.qty,          // qty yang dialokasikan ke vehicle INI
            assignmentId:       a.id,
            isSplit:            a.order.orderedQty !== a.qty,  // true jika pesanan dibagi
            totalAllocated:     a.order.vehicleAssignments.reduce((s, x) => s + x.qty, 0),
            vehicleDeliveredQty,                // sudah terkirim oleh vehicle INI
            vehicleReturnedQty,                 // sudah diretur oleh vehicle INI
            vehicleFullyLogged,                 // true → jatah armada ini sudah dicatat semua
          }
        })

        const totalAssigned  = assignments.reduce((s, a) => s + a.qty, 0)
        const totalDelivered = orders.reduce((s, o) => s + (o.deliveredQty ?? 0), 0)
        const capacitySak    = f.vehicle?.capacitySak ?? 0

        return {
          ...f,
          helperName:           f.helperName ?? masterArmada?.helperName ?? null,
          armadaId:             masterArmada?.id ?? null,
          masterArmadaDriverId: masterArmada?.driverId   ?? null,
          masterArmadaRayonId:  masterArmada?.rayonId    ?? null,
          masterArmadaHelper:   masterArmada?.helperName ?? null,
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

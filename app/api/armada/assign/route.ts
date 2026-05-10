import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/api/auth'
import { apiSuccess, apiError, apiNotFound, apiServerError } from '@/lib/api/response'
import { toSak } from '@/lib/uom'

// ─── POST /api/armada/assign ──────────────────────────────────────────────────
// Assign:   { orderId, vehicleId, qty }      → alokasikan qty sak ke vehicle
// Unassign: { orderId, vehicleId, qty: 0 }   → hapus alokasi vehicle ini
// Unassign all: { orderId, vehicleId: null } → hapus semua alokasi
export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth()
  if (error) return error

  try {
    const { orderId, vehicleId, qty } = await req.json()
    if (!orderId) return apiError('orderId wajib diisi', 400)

    const order = await prisma.order.findFirst({
      where:  { id: orderId, deletedAt: null },
      select: {
        id: true, orderedQty: true, status: true, vehicleId: true, deliveryDate: true,
        orderNumber: true,
        uom: { select: { unitsPerSak: true, abbreviation: true } },
        customer: { select: { id: true, name: true } },
        vehicleAssignments: {
          where:  { deletedAt: null },
          select: { id: true, vehicleId: true, qty: true },
        },
      },
    })
    if (!order) return apiNotFound('Order')

    const finalStatuses = ['DELIVERED', 'CANCELLED', 'REJECTED', 'RETURNED']
    if (finalStatuses.includes(order.status)) {
      return apiError(`Pesanan berstatus ${order.status} tidak dapat diubah`, 409)
    }

    // ── Helper: tulis activity log (non-blocking) ─────────────────────────────
    const logActivity = (action: 'ORDER_ASSIGNED' | 'ORDER_UNASSIGNED', vid: string | null, meta: Record<string, unknown>) => {
      prisma.activityLog.create({
        data: {
          action,
          userId:    user!.id,
          userName:  user!.name,
          userEmail: user!.email,
          vehicleId: vid ?? undefined,
          orderId,
          date:      order!.deliveryDate,
          meta:      meta as any,
        },
      }).catch(() => null)
    }

    // ── UNASSIGN ALL ──────────────────────────────────────────────────────────
    if (!vehicleId) {
      await prisma.orderVehicleAssignment.updateMany({
        where: { orderId, deletedAt: null },
        data:  { deletedAt: new Date() },
      })
      const updated = await prisma.order.update({
        where: { id: orderId },
        data:  {
          vehicleId: null,
          status:    order.status === 'ASSIGNED' ? 'CONFIRMED' : order.status as any,
        },
        select: { id: true, orderNumber: true, status: true, vehicleId: true, orderedQty: true,
                  customer: { select: { id: true, name: true } } },
      })
      logActivity('ORDER_UNASSIGNED', null, {
        orderNumber:  order.orderNumber,
        customerName: order.customer.name,
        note:         'dikeluarkan dari semua armada',
      })
      return apiSuccess(updated, 'Pesanan dikeluarkan dari semua armada')
    }

    // ── UNASSIGN SPECIFIC VEHICLE (qty = 0) ───────────────────────────────────
    if (qty === 0) {
      // Ambil plateNumber untuk meta
      const veh = await prisma.vehicle.findFirst({ where: { id: vehicleId }, select: { plateNumber: true } })
      await prisma.orderVehicleAssignment.updateMany({
        where: { orderId, vehicleId, deletedAt: null },
        data:  { deletedAt: new Date() },
      })
      // Cek apakah masih ada assignment lain
      const remaining = await prisma.orderVehicleAssignment.count({
        where: { orderId, deletedAt: null },
      })
      const newVehicleId = remaining > 0
        ? (order.vehicleAssignments.find(a => a.vehicleId !== vehicleId)?.vehicleId ?? null)
        : null
      const newStatus = remaining === 0 && order.status === 'ASSIGNED' ? 'CONFIRMED' : order.status
      const updated = await prisma.order.update({
        where: { id: orderId },
        data:  { vehicleId: newVehicleId, status: newStatus as any },
        select: { id: true, orderNumber: true, status: true, vehicleId: true,
                  customer: { select: { id: true, name: true } } },
      })
      logActivity('ORDER_UNASSIGNED', vehicleId, {
        orderNumber:  order.orderNumber,
        customerName: order.customer.name,
        plateNumber:  veh?.plateNumber,
      })
      return apiSuccess(updated, 'Pesanan dikeluarkan dari armada')
    }

    // ── ASSIGN ────────────────────────────────────────────────────────────────
    if (!qty || qty <= 0) return apiError('qty harus lebih dari 0', 400)

    const vehicle = await prisma.vehicle.findFirst({
      where:  { id: vehicleId, status: 'ACTIVE', deletedAt: null },
      select: { id: true, capacitySak: true, plateNumber: true },
    })
    if (!vehicle) return apiError('Armada tidak ditemukan atau tidak aktif', 404)

    // unitsPerSak untuk konversi ke sak (kapasitas kendaraan selalu dalam sak)
    const unitsPerSak = order.uom?.unitsPerSak ?? 1
    const uomLabel    = order.uom?.abbreviation ?? 'sak'

    // Validasi 1: qty yang diminta tidak melebihi sisa orderedQty yang belum dialokasikan
    const alreadyAssigned = order.vehicleAssignments
      .filter(a => a.vehicleId !== vehicleId)  // exclude vehicle ini (kalau update)
      .reduce((s, a) => s + a.qty, 0)
    const maxQty = order.orderedQty - alreadyAssigned
    if (qty > maxQty) {
      return apiError(
        `Qty melebihi sisa pesanan yang belum dialokasikan (maks ${maxQty} ${uomLabel})`, 400
      )
    }

    // Validasi 2: kapasitas vehicle (dalam sak) untuk tanggal itu
    // Semua assignment dikumpulkan lalu dikonversi ke sak sesuai unit masing-masing order
    const otherAssignments = await prisma.orderVehicleAssignment.findMany({
      where: {
        vehicleId,
        deletedAt: null,
        orderId:   { not: orderId },
        order: {
          deliveryDate: order.deliveryDate,
          deletedAt:    null,
          status:       { notIn: ['CANCELLED', 'REJECTED'] },
        },
      },
      select: { qty: true, order: { select: { uom: { select: { unitsPerSak: true } } } } },
    })
    const usedCapacitySak = otherAssignments.reduce((sum, a) => {
      return sum + toSak(a.qty, a.order.uom?.unitsPerSak)
    }, 0)
    const newQtySak = toSak(qty, unitsPerSak)
    if (usedCapacitySak + newQtySak > vehicle.capacitySak) {
      const sisaSak = vehicle.capacitySak - usedCapacitySak
      return apiError(
        `Kapasitas ${vehicle.plateNumber} tidak cukup. ` +
        `Sisa: ${sisaSak.toFixed(1)} sak, diminta: ${newQtySak.toFixed(1)} sak`,
        409,
      )
    }

    // Upsert assignment: update jika sudah ada, insert jika belum
    const existingAssignment = order.vehicleAssignments.find(a => a.vehicleId === vehicleId)
    if (existingAssignment) {
      await prisma.orderVehicleAssignment.update({
        where: { id: existingAssignment.id },
        data:  { qty, deletedAt: null },
      })
    } else {
      await prisma.orderVehicleAssignment.create({
        data: { orderId, vehicleId, qty },
      })
    }

    // Update order: vehicleId = vehicle pertama yang assign (compat), status ASSIGNED
    const newStatus = ['CREATED', 'CONFIRMED'].includes(order.status) ? 'ASSIGNED' : order.status
    const updated = await prisma.order.update({
      where: { id: orderId },
      data:  {
        vehicleId: order.vehicleId ?? vehicleId,  // pertahankan vehicleId lama jika sudah ada
        status:    newStatus as any,
      },
      select: {
        id: true, orderNumber: true, status: true, vehicleId: true, orderedQty: true,
        customer: { select: { id: true, name: true } },
      },
    })

    logActivity('ORDER_ASSIGNED', vehicleId, {
      orderNumber:  order.orderNumber,
      customerName: order.customer.name,
      plateNumber:  vehicle.plateNumber,
      qty,
      qtySak: Math.ceil(newQtySak),
      uom: uomLabel,
    })
    return apiSuccess(updated, `${qty} ${uomLabel} dialokasikan ke armada`)
  } catch (err) {
    return apiServerError(err)
  }
}

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/api/auth'
import { apiSuccess, apiError, apiNotFound, apiServerError } from '@/lib/api/response'

// ─── POST /api/armada/assign ──────────────────────────────────────────────────
// Assign:   { orderId, vehicleId, qty }      → alokasikan qty sak ke vehicle
// Unassign: { orderId, vehicleId, qty: 0 }   → hapus alokasi vehicle ini
// Unassign all: { orderId, vehicleId: null } → hapus semua alokasi
export async function POST(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const { orderId, vehicleId, qty } = await req.json()
    if (!orderId) return apiError('orderId wajib diisi', 400)

    const order = await prisma.order.findFirst({
      where:  { id: orderId, deletedAt: null },
      select: {
        id: true, orderedQty: true, status: true, vehicleId: true, deliveryDate: true,
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
      return apiSuccess(updated, 'Pesanan dikeluarkan dari semua armada')
    }

    // ── UNASSIGN SPECIFIC VEHICLE (qty = 0) ───────────────────────────────────
    if (qty === 0) {
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
      return apiSuccess(updated, 'Pesanan dikeluarkan dari armada')
    }

    // ── ASSIGN ────────────────────────────────────────────────────────────────
    if (!qty || qty <= 0) return apiError('qty harus lebih dari 0', 400)

    const vehicle = await prisma.vehicle.findFirst({
      where:  { id: vehicleId, status: 'ACTIVE', deletedAt: null },
      select: { id: true, capacitySak: true, plateNumber: true },
    })
    if (!vehicle) return apiError('Armada tidak ditemukan atau tidak aktif', 404)

    // Validasi 1: qty yang diminta tidak melebihi sisa orderedQty yang belum dialokasikan
    const alreadyAssigned = order.vehicleAssignments
      .filter(a => a.vehicleId !== vehicleId)  // exclude vehicle ini (kalau update)
      .reduce((s, a) => s + a.qty, 0)
    const maxQty = order.orderedQty - alreadyAssigned
    if (qty > maxQty) {
      return apiError(
        `Qty melebihi sisa pesanan yang belum dialokasikan (maks ${maxQty} sak)`, 400
      )
    }

    // Validasi 2: kapasitas vehicle untuk tanggal itu
    const usedCapacityResult = await prisma.orderVehicleAssignment.aggregate({
      where: {
        vehicleId,
        deletedAt: null,
        orderId:   { not: orderId },   // exclude assignment lain dari pesanan ini
        order: {
          deliveryDate: order.deliveryDate,
          deletedAt:    null,
          status:       { notIn: ['CANCELLED', 'REJECTED'] },
        },
      },
      _sum: { qty: true },
    })
    const usedCapacity = usedCapacityResult._sum.qty ?? 0
    if (usedCapacity + qty > vehicle.capacitySak) {
      const sisa = vehicle.capacitySak - usedCapacity
      return apiError(
        `Kapasitas ${vehicle.plateNumber} tidak cukup. ` +
        `Sisa slot: ${sisa} sak, diminta: ${qty} sak`,
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

    return apiSuccess(updated, `${qty} sak dialokasikan ke armada`)
  } catch (err) {
    return apiServerError(err)
  }
}

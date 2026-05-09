import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/api/auth'
import { apiSuccess, apiError, apiNotFound, apiServerError } from '@/lib/api/response'

// ─── POST /api/armada/assign ──────────────────────────────────────────────────
// Body: { orderId, vehicleId }  → assign pesanan ke armada
// Body: { orderId, vehicleId: null } → unassign pesanan dari armada
export async function POST(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const { orderId, vehicleId } = await req.json()

    if (!orderId) return apiError('orderId wajib diisi', 400)

    const order = await prisma.order.findFirst({
      where:  { id: orderId, deletedAt: null },
      select: { id: true, orderedQty: true, status: true, vehicleId: true, deliveryDate: true },
    })
    if (!order) return apiNotFound('Order')

    // Tidak bisa re-assign pesanan yang sudah final
    const finalStatuses = ['DELIVERED', 'CANCELLED', 'REJECTED', 'RETURNED']
    if (finalStatuses.includes(order.status)) {
      return apiError(`Pesanan berstatus ${order.status} tidak dapat dipindahkan`, 409)
    }

    if (vehicleId) {
      // Validate vehicle
      const vehicle = await prisma.vehicle.findFirst({
        where:  { id: vehicleId, status: 'ACTIVE', deletedAt: null },
        select: { id: true, capacitySak: true, plateNumber: true },
      })
      if (!vehicle) return apiError('Armada tidak ditemukan atau tidak aktif', 404)

      // Cek kapasitas: total orderedQty pesanan yang sudah diassign ke vehicle ini pada hari tsb
      const existingTotal = await prisma.order.aggregate({
        where: {
          vehicleId,
          deliveryDate: order.deliveryDate,
          deletedAt:    null,
          status:       { notIn: ['CANCELLED', 'REJECTED'] },
          id:           { not: orderId }, // exclude pesanan ini sendiri kalau sudah assign
        },
        _sum: { orderedQty: true },
      })
      const usedCapacity = existingTotal._sum.orderedQty ?? 0
      if (usedCapacity + order.orderedQty > vehicle.capacitySak) {
        return apiError(
          `Kapasitas armada ${vehicle.plateNumber} tidak cukup. ` +
          `Terpakai: ${usedCapacity}/${vehicle.capacitySak} sak, pesanan: ${order.orderedQty} sak`,
          409,
        )
      }
    }

    // Update order: set vehicleId dan naikkan status ke ASSIGNED jika masih CONFIRMED/CREATED
    const newStatus = vehicleId && ['CREATED', 'CONFIRMED'].includes(order.status)
      ? 'ASSIGNED'
      : (!vehicleId && order.status === 'ASSIGNED' ? 'CONFIRMED' : order.status)

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        vehicleId: vehicleId ?? null,
        status:    newStatus as any,
      },
      select: {
        id: true, orderNumber: true, status: true, vehicleId: true, orderedQty: true,
        customer: { select: { id: true, name: true } },
      },
    })

    const action = vehicleId ? 'assigned' : 'unassigned'
    return apiSuccess(updated, `Pesanan berhasil ${action === 'assigned' ? 'dimasukkan ke armada' : 'dikeluarkan dari armada'}`)
  } catch (err) {
    return apiServerError(err)
  }
}

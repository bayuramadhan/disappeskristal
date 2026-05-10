import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/api/auth'
import { apiSuccess, apiError, apiNotFound, apiServerError } from '@/lib/api/response'
import { updateOrderStatusSchema } from '@/lib/validations'

type Params = { params: { id: string } }

// ─── GET /api/orders/[id] ─────────────────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: Params) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const order = await prisma.order.findFirst({
      where: { id: params.id, deletedAt: null },
      include: {
        customer:         { select: { id: true, name: true, customerType: true } },
        deliveryLocation: { select: { id: true, namaLokasi: true, alamat: true, rayonId: true,
                                      rayon: { select: { id: true, name: true } } } },
        vehicle:      { select: { id: true, plateNumber: true, capacitySak: true } },
        rayon:        { select: { id: true, name: true, coverageArea: true } },
        deliveryLogs: {
          include: {
            driver:  { select: { id: true, name: true, phone: true } },
            vehicle: { select: { id: true, plateNumber: true } },
          },
          orderBy: { timestamp: 'desc' },
        },
      },
    })

    if (!order) return apiNotFound('Order')
    return apiSuccess(order)
  } catch (err) {
    return apiServerError(err)
  }
}

// ─── PATCH /api/orders/[id] ───────────────────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: Params) {
  const { user, error } = await requireAuth()
  if (error) return error

  try {
    const body   = await req.json()
    const parsed = updateOrderStatusSchema.safeParse(body)
    if (!parsed.success) {
      return apiError('Validasi gagal', 400, parsed.error.flatten().fieldErrors)
    }

    const existing = await prisma.order.findFirst({
      where: { id: params.id, deletedAt: null },
    })
    if (!existing) return apiNotFound('Order')

    // Guard: cannot un-cancel or un-reject via this endpoint
    const finalStatuses = ['CANCELLED', 'REJECTED']
    if (finalStatuses.includes(existing.status) && !['CANCELLED', 'REJECTED'].includes(parsed.data.status)) {
      return apiError(`Order berstatus ${existing.status} tidak bisa diubah`, 409)
    }

    const { status, deliveredQty, returnedQty, returnReason } = parsed.data

    const updated = await prisma.order.update({
      where: { id: params.id },
      data: {
        status: status as any,
        ...(deliveredQty !== undefined && { deliveredQty }),
        ...(returnedQty  !== undefined && { returnedQty }),
      },
      include: {
        customer: { select: { id: true, name: true } },
        vehicle:  { select: { id: true, plateNumber: true } },
        rayon:    { select: { id: true, name: true } },
      },
    })

    // Tulis activity log (non-blocking)
    prisma.activityLog.create({
      data: {
        action:    'ORDER_STATUS_CHANGED',
        userId:    user!.id,
        userName:  user!.name,
        userEmail: user!.email,
        orderId:   params.id,
        date:      existing.deliveryDate,
        meta: {
          orderNumber:  existing.orderNumber,
          customerName: updated.customer?.name ?? null,
          fromStatus:   existing.status,
          toStatus:     status,
          deliveredQty: deliveredQty ?? null,
          returnedQty:  returnedQty  ?? null,
          returnReason: returnReason ?? null,
        } as any,
      },
    }).catch(() => null)

    return apiSuccess(updated, 'Status order berhasil diperbarui')
  } catch (err) {
    return apiServerError(err)
  }
}

// ─── DELETE /api/orders/[id] — soft delete ────────────────────────────────────
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { user, error } = await requireAuth()
  if (error) return error

  // Only ADMIN can delete
  if (user.role !== 'ADMIN') {
    return apiError('Akses ditolak', 403)
  }

  try {
    const existing = await prisma.order.findFirst({
      where: { id: params.id, deletedAt: null },
    })
    if (!existing) return apiNotFound('Order')

    await prisma.order.update({
      where: { id: params.id },
      data: { deletedAt: new Date(), status: 'CANCELLED' as any },
    })

    // Tulis activity log (non-blocking)
    prisma.activityLog.create({
      data: {
        action:    'ORDER_DELETED',
        userId:    user.id,
        userName:  user.name,
        userEmail: user.email,
        orderId:   params.id,
        date:      existing.deliveryDate,
        meta: {
          orderNumber:  existing.orderNumber,
          orderedQty:   existing.orderedQty,
          fromStatus:   existing.status,
        } as any,
      },
    }).catch(() => null)

    return apiSuccess(null, 'Order berhasil dihapus')
  } catch (err) {
    return apiServerError(err)
  }
}

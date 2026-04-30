import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/api/auth'
import { apiSuccess, apiError, apiNotFound, apiServerError } from '@/lib/api/response'
import { customerSchema } from '@/lib/validations'

type Params = { params: { id: string } }

// ─── GET /api/customers/[id] ──────────────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: Params) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const customer = await prisma.customer.findFirst({
      where: { id: params.id, deletedAt: null },
      include: {
        rayon: { select: { id: true, name: true, coverageArea: true } },
      },
    })
    if (!customer) return apiNotFound('Customer')

    // Last 20 orders
    const [recentOrders, orderStats] = await Promise.all([
      prisma.order.findMany({
        where:   { customerId: params.id, deletedAt: null },
        orderBy: { deliveryDate: 'desc' },
        take:    20,
        select: {
          id: true, deliveryDate: true, orderChannel: true, orderedQty: true,
          deliveredQty: true, returnedQty: true, pricePerUnit: true,
          status: true, notes: true, createdAt: true,
          vehicle: { select: { id: true, plateNumber: true } },
        },
      }),
      prisma.order.aggregate({
        where: { customerId: params.id, deletedAt: null, status: { in: ['DELIVERED', 'PARTIAL'] } },
        _sum:   { deliveredQty: true, returnedQty: true },
        _count: { id: true },
      }),
    ])

    return apiSuccess({
      ...customer,
      recentOrders,
      stats: {
        totalOrders:       orderStats._count.id,
        totalDeliveredQty: orderStats._sum.deliveredQty ?? 0,
        totalReturnedQty:  orderStats._sum.returnedQty  ?? 0,
        totalRevenue:      recentOrders
          .filter(o => ['DELIVERED', 'PARTIAL'].includes(o.status))
          .reduce((sum, o) => sum + o.deliveredQty * o.pricePerUnit, 0),
      },
    })
  } catch (err) {
    return apiServerError(err)
  }
}

// ─── PATCH /api/customers/[id] ────────────────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: Params) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const body   = await req.json()
    const parsed = customerSchema.partial().safeParse(body)
    if (!parsed.success) {
      return apiError('Validasi gagal', 400, parsed.error.flatten().fieldErrors)
    }

    const existing = await prisma.customer.findFirst({
      where: { id: params.id, deletedAt: null },
    })
    if (!existing) return apiNotFound('Customer')

    const updated = await prisma.customer.update({
      where: { id: params.id },
      data: {
        ...parsed.data,
        ...(parsed.data.customerType && { customerType: parsed.data.customerType as any }),
      },
      include: { rayon: { select: { id: true, name: true } } },
    })

    return apiSuccess(updated, 'Customer berhasil diperbarui')
  } catch (err) {
    return apiServerError(err)
  }
}

// ─── DELETE /api/customers/[id] — soft delete ─────────────────────────────────
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { user, error } = await requireAuth()
  if (error) return error

  if (user.role !== 'ADMIN') return apiError('Akses ditolak', 403)

  try {
    const existing = await prisma.customer.findFirst({
      where: { id: params.id, deletedAt: null },
    })
    if (!existing) return apiNotFound('Customer')

    // Check active orders
    const activeOrders = await prisma.order.count({
      where: {
        customerId: params.id,
        deletedAt:  null,
        status:     { notIn: ['DELIVERED', 'CANCELLED', 'REJECTED', 'RETURNED'] },
      },
    })
    if (activeOrders > 0) {
      return apiError(`Customer masih memiliki ${activeOrders} order aktif`, 409)
    }

    await prisma.customer.update({
      where: { id: params.id },
      data:  { deletedAt: new Date(), activeStatus: false },
    })

    return apiSuccess(null, 'Customer berhasil dinonaktifkan')
  } catch (err) {
    return apiServerError(err)
  }
}

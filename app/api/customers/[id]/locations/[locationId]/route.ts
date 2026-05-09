import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/api/auth'
import { apiSuccess, apiError, apiNotFound, apiServerError } from '@/lib/api/response'
import { customerLocationSchema } from '@/lib/validations'

type Params = { params: { id: string; locationId: string } }

// ─── PATCH /api/customers/[id]/locations/[locationId] ────────────────────────
export async function PATCH(req: NextRequest, { params }: Params) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const existing = await prisma.customerLocation.findFirst({
      where: { id: params.locationId, customerId: params.id, deletedAt: null },
    })
    if (!existing) return apiNotFound('Lokasi')

    const body   = await req.json()
    const parsed = customerLocationSchema.partial().safeParse(body)
    if (!parsed.success) {
      return apiError('Validasi gagal', 400, parsed.error.flatten().fieldErrors)
    }

    const updated = await prisma.$transaction(async tx => {
      // Jika di-set sebagai default, reset lokasi lain dulu
      if (parsed.data.isDefault) {
        await tx.customerLocation.updateMany({
          where: { customerId: params.id, deletedAt: null, id: { not: params.locationId } },
          data:  { isDefault: false },
        })
      }
      return tx.customerLocation.update({
        where:   { id: params.locationId },
        data:    parsed.data,
        include: { rayon: { select: { id: true, name: true } } },
      })
    })

    return apiSuccess(updated, 'Lokasi berhasil diperbarui')
  } catch (err) {
    return apiServerError(err)
  }
}

// ─── DELETE /api/customers/[id]/locations/[locationId] ───────────────────────
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const existing = await prisma.customerLocation.findFirst({
      where: { id: params.locationId, customerId: params.id, deletedAt: null },
    })
    if (!existing) return apiNotFound('Lokasi')

    // Jangan hapus jika satu-satunya lokasi
    const totalLocations = await prisma.customerLocation.count({
      where: { customerId: params.id, deletedAt: null },
    })
    if (totalLocations <= 1) {
      return apiError('Customer harus memiliki minimal 1 lokasi', 409)
    }

    // Jangan hapus jika masih ada order aktif di lokasi ini
    const activeOrders = await prisma.order.count({
      where: {
        deliveryLocationId: params.locationId,
        deletedAt:          null,
        status:             { notIn: ['DELIVERED', 'CANCELLED', 'REJECTED', 'RETURNED'] },
      },
    })
    if (activeOrders > 0) {
      return apiError(`Lokasi masih memiliki ${activeOrders} order aktif`, 409)
    }

    await prisma.$transaction(async tx => {
      await tx.customerLocation.update({
        where: { id: params.locationId },
        data:  { deletedAt: new Date(), activeStatus: false },
      })
      // Jika yang dihapus adalah default, set lokasi pertama lainnya jadi default
      if (existing.isDefault) {
        const next = await tx.customerLocation.findFirst({
          where:   { customerId: params.id, deletedAt: null },
          orderBy: { createdAt: 'asc' },
        })
        if (next) {
          await tx.customerLocation.update({
            where: { id: next.id },
            data:  { isDefault: true },
          })
        }
      }
    })

    return apiSuccess(null, 'Lokasi berhasil dihapus')
  } catch (err) {
    return apiServerError(err)
  }
}

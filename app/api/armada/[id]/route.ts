import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/api/auth'
import { apiSuccess, apiError, apiNotFound, apiServerError } from '@/lib/api/response'
import { armadaSchema } from '@/lib/validations'

type Params = { params: { id: string } }

const armadaInclude = {
  vehicle: { select: { id: true, plateNumber: true, capacitySak: true, status: true } },
  driver:  { select: { id: true, name: true, phone: true, status: true } },
  rayon:   { select: { id: true, name: true } },
}

// ─── PATCH /api/armada/[id] ───────────────────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: Params) {
  const { user, error } = await requireAuth()
  if (error) return error
  if (!['ADMIN', 'OPERATOR'].includes(user.role)) return apiError('Akses ditolak', 403)

  try {
    const existing = await prisma.armada.findFirst({
      where: { id: params.id, deletedAt: null },
    })
    if (!existing) return apiNotFound('Armada')

    const body   = await req.json()
    const parsed = armadaSchema.partial().safeParse(body)
    if (!parsed.success) return apiError('Validasi gagal', 400, parsed.error.flatten().fieldErrors)

    const { vehicleId, driverId, helperName, rayonId, activeStatus, notes } = parsed.data

    // Jika ganti vehicle/driver, cek konflik dengan armada aktif lain
    if (vehicleId && vehicleId !== existing.vehicleId) {
      const conflict = await prisma.armada.findFirst({
        where: { vehicleId, activeStatus: true, deletedAt: null, id: { not: params.id } },
      })
      if (conflict) return apiError('Kendaraan sudah terdaftar di armada aktif lain', 409)
    }
    if (driverId && driverId !== existing.driverId) {
      const conflict = await prisma.armada.findFirst({
        where: { driverId, activeStatus: true, deletedAt: null, id: { not: params.id } },
      })
      if (conflict) return apiError('Driver sudah terdaftar di armada aktif lain', 409)
    }

    const updated = await prisma.armada.update({
      where: { id: params.id },
      data: {
        ...(vehicleId    !== undefined && { vehicleId }),
        ...(driverId     !== undefined && { driverId }),
        ...(helperName   !== undefined && { helperName: helperName || null }),
        ...(rayonId      !== undefined && { rayonId:    rayonId    || null }),
        ...(activeStatus !== undefined && { activeStatus }),
        ...(notes        !== undefined && { notes:      notes      || null }),
      },
      include: armadaInclude,
    })

    return apiSuccess(updated, 'Armada berhasil diperbarui')
  } catch (err) {
    return apiServerError(err)
  }
}

// ─── DELETE /api/armada/[id] — soft delete ────────────────────────────────────
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { user, error } = await requireAuth()
  if (error) return error
  if (!['ADMIN'].includes(user.role)) return apiError('Akses ditolak', 403)

  try {
    const existing = await prisma.armada.findFirst({
      where: { id: params.id, deletedAt: null },
    })
    if (!existing) return apiNotFound('Armada')

    await prisma.armada.update({
      where: { id: params.id },
      data:  { deletedAt: new Date(), activeStatus: false },
    })

    return apiSuccess(null, 'Armada berhasil dihapus')
  } catch (err) {
    return apiServerError(err)
  }
}

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/api/auth'
import { apiSuccess, apiError, apiNotFound, apiServerError } from '@/lib/api/response'
import { z } from 'zod'

type Params = { params: { id: string } }

const patchSchema = z.object({
  name:        z.string().min(1).max(50).optional(),
  unitsPerSak: z.number().positive().optional(),
  isActive:    z.boolean().optional(),
})

// ─── PATCH /api/units/[id] ────────────────────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: Params) {
  const { user, error } = await requireAuth()
  if (error) return error
  if (user.role !== 'ADMIN') return apiError('Akses ditolak', 403)

  try {
    const existing = await prisma.unit.findUnique({ where: { id: params.id } })
    if (!existing) return apiNotFound('Unit')

    const body   = await req.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) return apiError('Validasi gagal', 400, parsed.error.flatten().fieldErrors)

    // Tidak boleh ubah isBase unit (sak)
    if (existing.isBase && parsed.data.isActive === false)
      return apiError('Unit dasar (sak) tidak bisa dinonaktifkan', 400)

    const unit = await prisma.unit.update({
      where: { id: params.id },
      data:  parsed.data,
    })
    return apiSuccess(unit, 'Unit berhasil diperbarui')
  } catch (err) {
    return apiServerError(err)
  }
}

// ─── DELETE /api/units/[id] ───────────────────────────────────────────────────
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { user, error } = await requireAuth()
  if (error) return error
  if (user.role !== 'ADMIN') return apiError('Akses ditolak', 403)

  try {
    const existing = await prisma.unit.findUnique({ where: { id: params.id } })
    if (!existing) return apiNotFound('Unit')
    if (existing.isBase) return apiError('Unit dasar (sak) tidak bisa dihapus', 400)

    const inUse = await prisma.order.count({ where: { uomId: params.id } })
    if (inUse > 0) return apiError(`Unit masih dipakai oleh ${inUse} pesanan`, 409)

    await prisma.unit.delete({ where: { id: params.id } })
    return apiSuccess(null, 'Unit berhasil dihapus')
  } catch (err) {
    return apiServerError(err)
  }
}

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/api/auth'
import { apiSuccess, apiError, apiNotFound, apiServerError } from '@/lib/api/response'
import { rayonSchema } from '@/lib/validations'

type Params = { params: { id: string } }

// ─── GET /api/rayons/[id] ─────────────────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: Params) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const rayon = await prisma.rayon.findFirst({
      where: { id: params.id, deletedAt: null },
      include: {
        customers: {
          where:   { deletedAt: null, activeStatus: true },
          select:  { id: true, name: true, phone: true, customerType: true },
          orderBy: { name: 'asc' },
        },
        _count: { select: { customers: true, orders: true } },
      },
    })
    if (!rayon) return apiNotFound('Rayon')

    return apiSuccess(rayon)
  } catch (err) {
    return apiServerError(err)
  }
}

// ─── PATCH /api/rayons/[id] ───────────────────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: Params) {
  const { user, error } = await requireAuth()
  if (error) return error
  if (!['ADMIN', 'OPERATOR'].includes(user.role)) return apiError('Akses ditolak', 403)

  try {
    const body   = await req.json()
    const parsed = rayonSchema.partial().safeParse(body)
    if (!parsed.success) {
      return apiError('Validasi gagal', 400, parsed.error.flatten().fieldErrors)
    }

    const existing = await prisma.rayon.findFirst({
      where: { id: params.id, deletedAt: null },
    })
    if (!existing) return apiNotFound('Rayon')

    const updated = await prisma.rayon.update({
      where: { id: params.id },
      data:  parsed.data,
    })

    return apiSuccess(updated, 'Rayon berhasil diperbarui')
  } catch (err) {
    return apiServerError(err)
  }
}

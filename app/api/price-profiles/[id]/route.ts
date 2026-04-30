import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/api/auth'
import { apiSuccess, apiError, apiNotFound, apiServerError } from '@/lib/api/response'
import { priceProfileSchema } from '@/lib/validations'

type Params = { params: { id: string } }

// ─── PATCH /api/price-profiles/[id] ──────────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: Params) {
  const { user, error } = await requireAuth()
  if (error) return error
  if (user.role !== 'ADMIN') return apiError('Akses ditolak', 403)

  try {
    const body   = await req.json()
    const parsed = priceProfileSchema.partial().safeParse(body)
    if (!parsed.success) {
      return apiError('Validasi gagal', 400, parsed.error.flatten().fieldErrors)
    }

    const existing = await prisma.priceProfile.findUnique({ where: { id: params.id } })
    if (!existing) return apiNotFound('Harga')

    const { validFrom, validUntil, customerType, channel, rayonId, price } = parsed.data
    const newValidFrom  = validFrom  ? new Date(validFrom)  : existing.validFrom
    const newValidUntil = validUntil ? new Date(validUntil) : existing.validUntil

    if (newValidUntil < newValidFrom) {
      return apiError('Tanggal akhir harus setelah tanggal mulai', 400)
    }

    const updated = await prisma.priceProfile.update({
      where: { id: params.id },
      data: {
        ...(customerType !== undefined && { customerType: customerType as any }),
        ...(channel      !== undefined && { channel:      channel      as any }),
        ...(rayonId      !== undefined && { rayonId:      rayonId || null }),
        ...(price        !== undefined && { price }),
        ...(validFrom    !== undefined && { validFrom:    newValidFrom }),
        ...(validUntil   !== undefined && { validUntil:   newValidUntil }),
      },
      include: { rayon: { select: { id: true, name: true } } },
    })

    return apiSuccess(updated, 'Harga berhasil diperbarui')
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return apiError('Kombinasi tipe, channel, rayon, dan tanggal mulai sudah ada', 409)
    }
    return apiServerError(err)
  }
}

// ─── DELETE /api/price-profiles/[id] ─────────────────────────────────────────
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { user, error } = await requireAuth()
  if (error) return error
  if (user.role !== 'ADMIN') return apiError('Akses ditolak', 403)

  try {
    const existing = await prisma.priceProfile.findUnique({ where: { id: params.id } })
    if (!existing) return apiNotFound('Harga')

    await prisma.priceProfile.delete({ where: { id: params.id } })
    return apiSuccess(null, 'Harga berhasil dihapus')
  } catch (err) {
    return apiServerError(err)
  }
}

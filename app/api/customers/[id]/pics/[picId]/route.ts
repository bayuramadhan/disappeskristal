import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/api/auth'
import { apiSuccess, apiError, apiNotFound, apiServerError } from '@/lib/api/response'
import { customerPICSchema } from '@/lib/validations'

type Params = { params: { id: string; picId: string } }

// ─── PATCH /api/customers/[id]/pics/[picId] ───────────────────────────────────
export async function PATCH(req: NextRequest, { params }: Params) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const existing = await prisma.customerPIC.findFirst({
      where: { id: params.picId, customerId: params.id, deletedAt: null },
    })
    if (!existing) return apiNotFound('PIC')

    const body   = await req.json()
    const parsed = customerPICSchema.partial().safeParse(body)
    if (!parsed.success) {
      return apiError('Validasi gagal', 400, parsed.error.flatten().fieldErrors)
    }

    const updated = await prisma.customerPIC.update({
      where: { id: params.picId },
      data:  parsed.data,
    })

    return apiSuccess(updated, 'PIC berhasil diperbarui')
  } catch (err) {
    return apiServerError(err)
  }
}

// ─── DELETE /api/customers/[id]/pics/[picId] — soft delete ───────────────────
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const existing = await prisma.customerPIC.findFirst({
      where: { id: params.picId, customerId: params.id, deletedAt: null },
    })
    if (!existing) return apiNotFound('PIC')

    await prisma.customerPIC.update({
      where: { id: params.picId },
      data:  { deletedAt: new Date(), isActive: false },
    })

    return apiSuccess(null, 'PIC berhasil dihapus')
  } catch (err) {
    return apiServerError(err)
  }
}

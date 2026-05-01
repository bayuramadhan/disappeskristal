import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/api/auth'
import { apiSuccess, apiError, apiServerError } from '@/lib/api/response'

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const draft = await prisma.waDraft.findUnique({ where: { id: params.id } })
    if (!draft) return apiError('Draft tidak ditemukan', 404)
    await prisma.waDraft.delete({ where: { id: params.id } })
    return apiSuccess({ deleted: true })
  } catch (err) {
    return apiServerError(err)
  }
}

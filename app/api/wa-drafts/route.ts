import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/api/auth'
import { apiSuccess, apiCreated, apiError, apiServerError } from '@/lib/api/response'

export async function GET() {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const drafts = await prisma.waDraft.findMany({
      orderBy: { createdAt: 'desc' },
      include: { customer: { select: { id: true, name: true, customerType: true, rayonId: true } } },
    })
    return apiSuccess(drafts)
  } catch (err) {
    return apiServerError(err)
  }
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const body = await req.json()
    const { rawMessage, customerNameHint, customerId, orderedQty, deliveryDate, notes } = body

    if (!rawMessage?.trim()) return apiError('rawMessage wajib diisi', 400)

    const draft = await prisma.waDraft.create({
      data: { rawMessage, customerNameHint, customerId: customerId || null, orderedQty: orderedQty ?? null, deliveryDate: deliveryDate || null, notes: notes || null },
    })
    return apiCreated(draft)
  } catch (err) {
    return apiServerError(err)
  }
}

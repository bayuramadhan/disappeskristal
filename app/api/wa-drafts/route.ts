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
      include: {
        customer:         { select: { id: true, name: true, customerType: true } },
        deliveryLocation: { select: { id: true, namaLokasi: true, alamat: true,
                                      rayon: { select: { id: true, name: true } } } },
        uom:              { select: { id: true, abbreviation: true, unitsPerSak: true } },
      },
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
    const { rawMessage, customerNameHint, customerId, deliveryLocationId,
            orderedQty, deliveryDate, notes } = body

    if (!rawMessage?.trim()) return apiError('rawMessage wajib diisi', 400)

    // Jika customerId ada tapi deliveryLocationId tidak, pakai default location
    let resolvedLocationId: string | null = deliveryLocationId || null
    if (customerId && !resolvedLocationId) {
      const defaultLoc = await prisma.customerLocation.findFirst({
        where:  { customerId, deletedAt: null, isDefault: true },
        select: { id: true },
      })
      resolvedLocationId = defaultLoc?.id ?? null
    }

    const draft = await prisma.waDraft.create({
      data: {
        rawMessage,
        customerNameHint:   customerNameHint  || null,
        customerId:         customerId        || null,
        deliveryLocationId: resolvedLocationId,
        orderedQty:         orderedQty        ?? null,
        deliveryDate:       deliveryDate      || null,
        notes:              notes             || null,
      },
      include: {
        customer:         { select: { id: true, name: true, customerType: true } },
        deliveryLocation: { select: { id: true, namaLokasi: true, alamat: true } },
      },
    })
    return apiCreated(draft)
  } catch (err) {
    return apiServerError(err)
  }
}

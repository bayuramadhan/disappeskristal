import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/api/auth'
import { apiSuccess, apiCreated, apiError, apiServerError } from '@/lib/api/response'
import { priceProfileSchema } from '@/lib/validations'

// ─── GET /api/price-profiles ──────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const sp           = req.nextUrl.searchParams
    const customerType = sp.get('customerType') ?? undefined
    const channel      = sp.get('channel')      ?? undefined
    const rayonId      = sp.get('rayonId')      ?? undefined

    const where: Record<string, unknown> = {}
    if (customerType) where.customerType = customerType
    if (channel)      where.channel      = channel
    if (rayonId)      where.rayonId      = rayonId

    const profiles = await prisma.priceProfile.findMany({
      where,
      orderBy: [{ validFrom: 'desc' }, { customerType: 'asc' }],
      include: { rayon: { select: { id: true, name: true } } },
    })

    return apiSuccess(profiles)
  } catch (err) {
    return apiServerError(err)
  }
}

// ─── POST /api/price-profiles ─────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth()
  if (error) return error
  if (user.role !== 'ADMIN') return apiError('Akses ditolak', 403)

  try {
    const body   = await req.json()
    const parsed = priceProfileSchema.safeParse(body)
    if (!parsed.success) {
      return apiError('Validasi gagal', 400, parsed.error.flatten().fieldErrors)
    }

    const { customerType, channel, rayonId, price, validFrom, validUntil } = parsed.data

    if (new Date(validUntil) < new Date(validFrom)) {
      return apiError('Tanggal akhir harus setelah tanggal mulai', 400)
    }

    const profile = await prisma.priceProfile.create({
      data: {
        customerType: customerType as any,
        channel:      channel as any,
        rayonId:      rayonId || null,
        price,
        validFrom:    new Date(validFrom),
        validUntil:   new Date(validUntil),
      },
      include: { rayon: { select: { id: true, name: true } } },
    })

    return apiCreated(profile, 'Harga berhasil ditambahkan')
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return apiError('Kombinasi tipe, channel, rayon, dan tanggal mulai sudah ada', 409)
    }
    return apiServerError(err)
  }
}

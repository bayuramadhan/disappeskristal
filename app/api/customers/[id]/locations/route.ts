import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/api/auth'
import { apiSuccess, apiCreated, apiError, apiNotFound, apiServerError } from '@/lib/api/response'
import { customerLocationSchema } from '@/lib/validations'

type Params = { params: { id: string } }

// ─── GET /api/customers/[id]/locations ───────────────────────────────────────
export async function GET(_req: NextRequest, { params }: Params) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const locations = await prisma.customerLocation.findMany({
      where:   { customerId: params.id, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      include: { rayon: { select: { id: true, name: true } } },
    })
    return apiSuccess(locations)
  } catch (err) {
    return apiServerError(err)
  }
}

// ─── POST /api/customers/[id]/locations ──────────────────────────────────────
export async function POST(req: NextRequest, { params }: Params) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const customer = await prisma.customer.findFirst({
      where: { id: params.id, deletedAt: null },
    })
    if (!customer) return apiNotFound('Customer')

    const body   = await req.json()
    const parsed = customerLocationSchema.safeParse(body)
    if (!parsed.success) {
      return apiError('Validasi gagal', 400, parsed.error.flatten().fieldErrors)
    }

    // Jika isDefault = true, reset semua lokasi lain menjadi false dulu
    const location = await prisma.$transaction(async tx => {
      if (parsed.data.isDefault) {
        await tx.customerLocation.updateMany({
          where: { customerId: params.id, deletedAt: null },
          data:  { isDefault: false },
        })
      }
      return tx.customerLocation.create({
        data: {
          ...parsed.data,
          customerId: params.id,
        },
        include: { rayon: { select: { id: true, name: true } } },
      })
    })

    return apiCreated(location, 'Lokasi berhasil ditambahkan')
  } catch (err) {
    return apiServerError(err)
  }
}

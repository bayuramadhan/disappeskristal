import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/api/auth'
import { apiSuccess, apiCreated, apiError, apiNotFound, apiServerError } from '@/lib/api/response'
import { customerPICSchema } from '@/lib/validations'

type Params = { params: { id: string } }

// ─── GET /api/customers/[id]/pics ────────────────────────────────────────────
export async function GET(req: NextRequest, { params }: Params) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const sp         = req.nextUrl.searchParams
    const activeOnly = sp.get('activeOnly') !== 'false' // default: hanya aktif

    const pics = await prisma.customerPIC.findMany({
      where: {
        customerId: params.id,
        deletedAt:  null,
        ...(activeOnly ? { isActive: true } : {}),
      },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
    })
    return apiSuccess(pics)
  } catch (err) {
    return apiServerError(err)
  }
}

// ─── POST /api/customers/[id]/pics ───────────────────────────────────────────
export async function POST(req: NextRequest, { params }: Params) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const customer = await prisma.customer.findFirst({
      where: { id: params.id, deletedAt: null },
    })
    if (!customer) return apiNotFound('Customer')

    const body   = await req.json()
    const parsed = customerPICSchema.safeParse(body)
    if (!parsed.success) {
      return apiError('Validasi gagal', 400, parsed.error.flatten().fieldErrors)
    }

    const pic = await prisma.customerPIC.create({
      data: { ...parsed.data, customerId: params.id },
    })

    return apiCreated(pic, 'PIC berhasil ditambahkan')
  } catch (err) {
    return apiServerError(err)
  }
}

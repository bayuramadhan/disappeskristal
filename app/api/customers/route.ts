import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/api/auth'
import {
  apiSuccess, apiCreated, apiError, apiServerError,
  parsePagination, makeMeta,
} from '@/lib/api/response'
import { customerSchema } from '@/lib/validations'

// ─── GET /api/customers ───────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const sp = req.nextUrl.searchParams
    const { page, limit, skip } = parsePagination(sp)

    const rayonId      = sp.get('rayonId')
    const customerType = sp.get('customerType')
    const activeStatus = sp.get('activeStatus')
    const search       = sp.get('search')

    const where: Record<string, unknown> = { deletedAt: null }

    if (rayonId)      where.rayonId      = rayonId
    if (customerType) where.customerType = customerType
    if (activeStatus !== null && activeStatus !== undefined) {
      where.activeStatus = activeStatus === 'true'
    }
    if (search) {
      where.OR = [
        { name:    { contains: search, mode: 'insensitive' } },
        { phone:   { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take:    limit,
        orderBy: { name: 'asc' },
        include: {
          rayon:  { select: { id: true, name: true } },
          _count: { select: { orders: true } },
        },
      }),
      prisma.customer.count({ where }),
    ])

    return apiSuccess(customers, undefined, makeMeta(page, limit, total))
  } catch (err) {
    return apiServerError(err)
  }
}

// ─── POST /api/customers ──────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const body   = await req.json()
    const parsed = customerSchema.safeParse(body)
    if (!parsed.success) {
      return apiError('Validasi gagal', 400, parsed.error.flatten().fieldErrors)
    }

    const customer = await prisma.customer.create({
      data: {
        ...parsed.data,
        customerType: parsed.data.customerType as any,
        rayonId: parsed.data.rayonId ?? null,
      },
      include: { rayon: { select: { id: true, name: true } } },
    })

    return apiCreated(customer, 'Customer berhasil ditambahkan')
  } catch (err) {
    return apiServerError(err)
  }
}

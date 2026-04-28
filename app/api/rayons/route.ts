import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/api/auth'
import {
  apiSuccess, apiCreated, apiError, apiServerError,
  parsePagination, makeMeta,
} from '@/lib/api/response'
import { rayonSchema } from '@/lib/validations'

// ─── GET /api/rayons ──────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const sp = req.nextUrl.searchParams
    const { page, limit, skip } = parsePagination(sp)
    const activeStatus = sp.get('activeStatus')
    const search       = sp.get('search')

    const where: Record<string, unknown> = { deletedAt: null }
    if (activeStatus !== null && activeStatus !== undefined) {
      where.activeStatus = activeStatus === 'true'
    }
    if (search) where.name = { contains: search, mode: 'insensitive' }

    const [rayons, total] = await Promise.all([
      prisma.rayon.findMany({
        where,
        skip,
        take:    limit,
        orderBy: { name: 'asc' },
        include: {
          _count: { select: { customers: true, orders: true } },
        },
      }),
      prisma.rayon.count({ where }),
    ])

    return apiSuccess(rayons, undefined, makeMeta(page, limit, total))
  } catch (err) {
    return apiServerError(err)
  }
}

// ─── POST /api/rayons ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth()
  if (error) return error
  if (!['ADMIN', 'OPERATOR'].includes(user.role)) return apiError('Akses ditolak', 403)

  try {
    const body   = await req.json()
    const parsed = rayonSchema.safeParse(body)
    if (!parsed.success) {
      return apiError('Validasi gagal', 400, parsed.error.flatten().fieldErrors)
    }

    const existing = await prisma.rayon.findFirst({
      where: { name: { equals: parsed.data.name, mode: 'insensitive' }, deletedAt: null },
    })
    if (existing) return apiError('Nama rayon sudah ada', 409)

    const rayon = await prisma.rayon.create({ data: parsed.data })
    return apiCreated(rayon, 'Rayon berhasil ditambahkan')
  } catch (err) {
    return apiServerError(err)
  }
}

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/api/auth'
import {
  apiSuccess, apiCreated, apiError, apiServerError,
  parsePagination, makeMeta,
} from '@/lib/api/response'
import { vehicleSchema } from '@/lib/validations'

// ─── GET /api/vehicles ────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const sp = req.nextUrl.searchParams
    const { page, limit, skip } = parsePagination(sp)
    const status = sp.get('status')
    const search = sp.get('search')

    const where: Record<string, unknown> = { deletedAt: null }
    if (status) where.status = status
    if (search) where.plateNumber = { contains: search, mode: 'insensitive' }

    const [vehicles, total] = await Promise.all([
      prisma.vehicle.findMany({
        where,
        skip,
        take:    limit,
        orderBy: { plateNumber: 'asc' },
        include: {
          _count: { select: { orders: true, drivers: true } },
          drivers: {
            where:  { deletedAt: null, status: 'ACTIVE' },
            select: { id: true, name: true, phone: true, status: true },
            take:   1,
          },
        },
      }),
      prisma.vehicle.count({ where }),
    ])

    return apiSuccess(vehicles, undefined, makeMeta(page, limit, total))
  } catch (err) {
    return apiServerError(err)
  }
}

// ─── POST /api/vehicles ───────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth()
  if (error) return error
  if (!['ADMIN', 'OPERATOR'].includes(user.role)) return apiError('Akses ditolak', 403)

  try {
    const body   = await req.json()
    const parsed = vehicleSchema.safeParse(body)
    if (!parsed.success) {
      return apiError('Validasi gagal', 400, parsed.error.flatten().fieldErrors)
    }

    const existing = await prisma.vehicle.findFirst({
      where: { plateNumber: parsed.data.plateNumber, deletedAt: null },
    })
    if (existing) return apiError('Nomor plat sudah terdaftar', 409)

    const vehicle = await prisma.vehicle.create({
      data: {
        ...parsed.data,
        status: (parsed.data.status ?? 'ACTIVE') as any,
      },
    })

    return apiCreated(vehicle, 'Kendaraan berhasil ditambahkan')
  } catch (err) {
    return apiServerError(err)
  }
}

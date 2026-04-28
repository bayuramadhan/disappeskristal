import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/api/auth'
import {
  apiSuccess, apiCreated, apiError, apiServerError,
  parsePagination, makeMeta,
} from '@/lib/api/response'
import { driverSchema } from '@/lib/validations'

// ─── GET /api/drivers ─────────────────────────────────────────────────────────
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
    if (search) {
      where.OR = [
        { name:  { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [drivers, total] = await Promise.all([
      prisma.driver.findMany({
        where,
        skip,
        take:    limit,
        orderBy: { name: 'asc' },
        include: {
          assignedVehicle: { select: { id: true, plateNumber: true, status: true } },
          _count:          { select: { deliveryLogs: true } },
        },
      }),
      prisma.driver.count({ where }),
    ])

    return apiSuccess(drivers, undefined, makeMeta(page, limit, total))
  } catch (err) {
    return apiServerError(err)
  }
}

// ─── POST /api/drivers ────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth()
  if (error) return error
  if (!['ADMIN', 'OPERATOR'].includes(user.role)) return apiError('Akses ditolak', 403)

  try {
    const body   = await req.json()
    const parsed = driverSchema.safeParse(body)
    if (!parsed.success) {
      return apiError('Validasi gagal', 400, parsed.error.flatten().fieldErrors)
    }

    // Check vehicle availability
    if (parsed.data.assignedVehicleId) {
      const vehicle = await prisma.vehicle.findFirst({
        where: { id: parsed.data.assignedVehicleId, deletedAt: null },
      })
      if (!vehicle) return apiError('Kendaraan tidak ditemukan', 404)
    }

    const driver = await prisma.driver.create({
      data: {
        ...parsed.data,
        status:           (parsed.data.status ?? 'ACTIVE') as any,
        assignedVehicleId: parsed.data.assignedVehicleId ?? null,
      },
      include: {
        assignedVehicle: { select: { id: true, plateNumber: true } },
      },
    })

    return apiCreated(driver, 'Driver berhasil ditambahkan')
  } catch (err) {
    return apiServerError(err)
  }
}

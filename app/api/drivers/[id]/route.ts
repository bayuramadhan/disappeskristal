import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/api/auth'
import { apiSuccess, apiError, apiNotFound, apiServerError } from '@/lib/api/response'
import { driverSchema } from '@/lib/validations'

type Params = { params: { id: string } }

// ─── GET /api/drivers/[id] ────────────────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: Params) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const driver = await prisma.driver.findFirst({
      where: { id: params.id, deletedAt: null },
      include: {
        assignedVehicle:    { select: { id: true, plateNumber: true, status: true } },
        driverAttendances:  { orderBy: { date: 'desc' }, take: 14 },
        driverPerformances: { orderBy: { date: 'desc' }, take: 14 },
        _count:             { select: { deliveryLogs: true } },
      },
    })
    if (!driver) return apiNotFound('Driver')

    return apiSuccess(driver)
  } catch (err) {
    return apiServerError(err)
  }
}

// ─── PATCH /api/drivers/[id] ──────────────────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: Params) {
  const { user, error } = await requireAuth()
  if (error) return error
  if (!['ADMIN', 'OPERATOR'].includes(user.role)) return apiError('Akses ditolak', 403)

  try {
    const body   = await req.json()
    const parsed = driverSchema.partial().safeParse(body)
    if (!parsed.success) {
      return apiError('Validasi gagal', 400, parsed.error.flatten().fieldErrors)
    }

    const existing = await prisma.driver.findFirst({
      where: { id: params.id, deletedAt: null },
    })
    if (!existing) return apiNotFound('Driver')

    if (parsed.data.assignedVehicleId) {
      const vehicle = await prisma.vehicle.findFirst({
        where: { id: parsed.data.assignedVehicleId, deletedAt: null },
      })
      if (!vehicle) return apiError('Kendaraan tidak ditemukan', 404)
    }

    const updated = await prisma.driver.update({
      where: { id: params.id },
      data: {
        ...parsed.data,
        ...(parsed.data.status && { status: parsed.data.status as any }),
      },
      include: {
        assignedVehicle: { select: { id: true, plateNumber: true } },
      },
    })

    return apiSuccess(updated, 'Driver berhasil diperbarui')
  } catch (err) {
    return apiServerError(err)
  }
}

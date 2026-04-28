import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/api/auth'
import { apiSuccess, apiError, apiNotFound, apiServerError, todayDate } from '@/lib/api/response'
import { vehicleSchema } from '@/lib/validations'

type Params = { params: { id: string } }

// ─── GET /api/vehicles/[id] ───────────────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: Params) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: params.id, deletedAt: null },
      include: {
        drivers:             { where: { deletedAt: null }, select: { id: true, name: true, phone: true, status: true } },
        vehicleMaintenances: { orderBy: { serviceDate: 'desc' }, take: 5 },
        _count:              { select: { orders: true, vehicleCosts: true } },
      },
    })
    if (!vehicle) return apiNotFound('Kendaraan')

    // Today's load
    const todayLoad = await prisma.vehicleLoad.findFirst({
      where: { vehicleId: params.id, date: todayDate() },
    })

    return apiSuccess({ ...vehicle, todayLoad })
  } catch (err) {
    return apiServerError(err)
  }
}

// ─── PATCH /api/vehicles/[id] ─────────────────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: Params) {
  const { user, error } = await requireAuth()
  if (error) return error
  if (!['ADMIN', 'OPERATOR'].includes(user.role)) return apiError('Akses ditolak', 403)

  try {
    const body   = await req.json()
    const parsed = vehicleSchema.partial().safeParse(body)
    if (!parsed.success) {
      return apiError('Validasi gagal', 400, parsed.error.flatten().fieldErrors)
    }

    const existing = await prisma.vehicle.findFirst({
      where: { id: params.id, deletedAt: null },
    })
    if (!existing) return apiNotFound('Kendaraan')

    if (parsed.data.plateNumber && parsed.data.plateNumber !== existing.plateNumber) {
      const conflict = await prisma.vehicle.findFirst({
        where: { plateNumber: parsed.data.plateNumber, deletedAt: null },
      })
      if (conflict) return apiError('Nomor plat sudah terdaftar', 409)
    }

    const updated = await prisma.vehicle.update({
      where: { id: params.id },
      data: {
        ...parsed.data,
        ...(parsed.data.status && { status: parsed.data.status as any }),
      },
    })

    return apiSuccess(updated, 'Kendaraan berhasil diperbarui')
  } catch (err) {
    return apiServerError(err)
  }
}

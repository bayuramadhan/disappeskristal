import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/api/auth'
import { apiSuccess, apiCreated, apiError, apiServerError } from '@/lib/api/response'
import { armadaSchema } from '@/lib/validations'

const armadaInclude = {
  vehicle: { select: { id: true, plateNumber: true, capacitySak: true, status: true } },
  driver:  { select: { id: true, name: true, phone: true, status: true } },
  rayon:   { select: { id: true, name: true } },
}

// ─── GET /api/armada ──────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const sp           = req.nextUrl.searchParams
    const activeOnly   = sp.get('activeOnly') !== 'false'

    const where: Record<string, unknown> = { deletedAt: null }
    if (activeOnly) where.activeStatus = true

    const armadas = await prisma.armada.findMany({
      where,
      orderBy:  { createdAt: 'asc' },
      include:  armadaInclude,
    })

    return apiSuccess(armadas)
  } catch (err) {
    return apiServerError(err)
  }
}

// ─── POST /api/armada ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth()
  if (error) return error
  if (!['ADMIN', 'OPERATOR'].includes(user.role)) return apiError('Akses ditolak', 403)

  try {
    const body   = await req.json()
    const parsed = armadaSchema.safeParse(body)
    if (!parsed.success) return apiError('Validasi gagal', 400, parsed.error.flatten().fieldErrors)

    const { vehicleId, driverId, helperName, rayonId, notes } = parsed.data

    // Cek vehicle & driver valid
    const [vehicle, driver] = await Promise.all([
      prisma.vehicle.findFirst({ where: { id: vehicleId, deletedAt: null } }),
      prisma.driver.findFirst({  where: { id: driverId,  deletedAt: null } }),
    ])
    if (!vehicle) return apiError('Kendaraan tidak ditemukan', 404)
    if (!driver)  return apiError('Driver tidak ditemukan', 404)

    // Validasi: vehicle & driver belum dipakai di armada aktif lain
    const [vehConflict, drvConflict] = await Promise.all([
      prisma.armada.findFirst({ where: { vehicleId, activeStatus: true, deletedAt: null } }),
      prisma.armada.findFirst({ where: { driverId,  activeStatus: true, deletedAt: null } }),
    ])
    if (vehConflict) return apiError(`Kendaraan ${vehicle.plateNumber} sudah terdaftar di armada aktif lain`, 409)
    if (drvConflict) return apiError(`Driver ${driver.name} sudah terdaftar di armada aktif lain`, 409)

    const armada = await prisma.armada.create({
      data: {
        vehicleId,
        driverId,
        helperName:  helperName  ?? null,
        rayonId:     rayonId     ?? null,
        notes:       notes       ?? null,
        activeStatus: true,
      },
      include: armadaInclude,
    })

    return apiCreated(armada, 'Armada berhasil dibuat')
  } catch (err) {
    return apiServerError(err)
  }
}

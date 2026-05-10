import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/api/auth'
import { apiSuccess, apiError, apiNotFound, apiServerError } from '@/lib/api/response'
import { updateFleetStatusSchema } from '@/lib/validations'

type Params = { params: { id: string } }

// ─── PATCH /api/fleet/[id] ────────────────────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: Params) {
  const { user, error } = await requireAuth()
  if (error) return error

  try {
    const body   = await req.json()
    const parsed = updateFleetStatusSchema.safeParse(body)
    if (!parsed.success) {
      return apiError('Validasi gagal', 400, parsed.error.flatten().fieldErrors)
    }

    const existing = await prisma.fleetDailyStatus.findFirst({
      where: { id: params.id, deletedAt: null },
    })
    if (!existing) return apiNotFound('Fleet status')

    const { remainingLoad, departureTime, activeStatus, rayonId, driverId, helperName } = parsed.data

    // Validate remainingLoad doesn't exceed initialLoad
    if (remainingLoad !== undefined && remainingLoad > existing.initialLoad) {
      return apiError('Sisa muatan tidak boleh melebihi muatan awal', 400)
    }

    const updated = await prisma.fleetDailyStatus.update({
      where: { id: params.id },
      data: {
        ...(remainingLoad !== undefined && { remainingLoad }),
        ...(departureTime !== undefined && { departureTime: new Date(departureTime) }),
        ...(activeStatus  !== undefined && { activeStatus }),
        ...(rayonId       !== undefined && { rayonId }),
        ...(driverId      !== undefined && { driverId }),
        ...(helperName    !== undefined && { helperName }),
      },
      include: {
        vehicle: { select: { id: true, plateNumber: true } },
        driver:  { select: { id: true, name: true } },
        rayon:   { select: { id: true, name: true } },
      },
    })

    // Tulis activity log: catat field mana saja yang berubah (non-blocking)
    const changes: Record<string, { from: string | null; to: string | null }> = {}
    if (driverId      !== undefined && driverId      !== existing.driverId)      changes.driverId      = { from: existing.driverId ?? null,               to: driverId ?? null }
    if (rayonId       !== undefined && rayonId       !== existing.rayonId)       changes.rayonId       = { from: existing.rayonId ?? null,                 to: rayonId ?? null }
    if (helperName    !== undefined && helperName    !== existing.helperName)     changes.helperName    = { from: existing.helperName ?? null,              to: helperName ?? null }
    if (departureTime !== undefined)                                              changes.departureTime = { from: existing.departureTime?.toISOString() ?? null, to: departureTime ?? null }
    if (activeStatus  !== undefined && activeStatus  !== existing.activeStatus)  changes.activeStatus  = { from: String(existing.activeStatus),            to: String(activeStatus) }

    const actMeta: Record<string, unknown> = {
      plateNumber: updated.vehicle?.plateNumber ?? null,
      changes,
    }
    prisma.activityLog.create({
      data: {
        action:    'FLEET_UPDATED',
        userId:    user!.id,
        userName:  user!.name,
        userEmail: user!.email,
        vehicleId: existing.vehicleId,
        date:      existing.date,
        meta:      actMeta as any,
      },
    }).catch(() => null)

    return apiSuccess(updated, 'Status armada berhasil diperbarui')
  } catch (err) {
    return apiServerError(err)
  }
}

// ─── DELETE /api/fleet/[id] — soft delete ─────────────────────────────────────
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { user, error } = await requireAuth()
  if (error) return error

  if (!['ADMIN', 'OPERATOR'].includes(user.role)) {
    return apiError('Akses ditolak', 403)
  }

  try {
    const existing = await prisma.fleetDailyStatus.findFirst({
      where: { id: params.id, deletedAt: null },
    })
    if (!existing) return apiNotFound('Fleet status')

    await prisma.fleetDailyStatus.update({
      where: { id: params.id },
      data: { deletedAt: new Date(), activeStatus: false },
    })

    return apiSuccess(null, 'Armada berhasil dinonaktifkan')
  } catch (err) {
    return apiServerError(err)
  }
}

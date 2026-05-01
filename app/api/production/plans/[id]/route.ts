import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/api/auth'
import { apiSuccess, apiError, apiNotFound, apiServerError } from '@/lib/api/response'
import { syncWarehouseStock } from '@/lib/warehouse'
import { z } from 'zod'

const patchSchema = z.object({
  plannedQty: z.number().int().min(0),
})

// ─── PATCH /api/production/plans/[id] ─────────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const body   = await req.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return apiError('Validasi gagal', 400, parsed.error.flatten().fieldErrors)
    }

    const plan = await prisma.productionPlan.findUnique({ where: { id: params.id } })
    if (!plan) return apiNotFound('Rencana produksi')

    // Adjust warehouse stock by the difference (new - old)
    const diff = parsed.data.plannedQty - plan.actualProductionQty

    const updated = await prisma.productionPlan.update({
      where: { id: params.id },
      data:  { actualProductionQty: parsed.data.plannedQty },
    })

    if (diff !== 0) {
      await syncWarehouseStock(plan.productionDate, { productionIn: diff }).catch(() => {})
    }

    return apiSuccess({ ...updated, plannedQty: updated.actualProductionQty }, 'Rencana produksi diperbarui')
  } catch (err) {
    return apiServerError(err)
  }
}

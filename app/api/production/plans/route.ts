import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/api/auth'
import { apiCreated, apiError, apiServerError, parseDate, tomorrowDate } from '@/lib/api/response'
import { syncWarehouseStock } from '@/lib/warehouse'
import { z } from 'zod'

const planSchema = z.object({
  productionDate: z.string().min(1),
  plannedQty:     z.number().int().min(0),
})

// ─── POST /api/production/plans ───────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const body   = await req.json()
    const parsed = planSchema.safeParse(body)
    if (!parsed.success) {
      return apiError('Validasi gagal', 400, parsed.error.flatten().fieldErrors)
    }

    const { productionDate, plannedQty } = parsed.data
    const date = parseDate(productionDate, tomorrowDate())

    const existing = await prisma.productionPlan.findFirst({ where: { productionDate: date } })
    if (existing) {
      return apiError('Rencana produksi untuk tanggal ini sudah ada', 409)
    }

    const plan = await prisma.productionPlan.create({
      data: {
        productionDate:           date,
        actualProductionQty:      plannedQty,
        recommendedProductionQty: 0,
      },
    })

    await syncWarehouseStock(date, { productionIn: plannedQty }).catch(() => {})

    return apiCreated({ ...plan, plannedQty: plan.actualProductionQty }, 'Rencana produksi berhasil disimpan')
  } catch (err) {
    return apiServerError(err)
  }
}

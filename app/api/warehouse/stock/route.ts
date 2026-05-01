import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/api/auth'
import { apiSuccess, apiCreated, apiError, apiServerError, parseDate, todayDate } from '@/lib/api/response'
import { syncWarehouseStock, applyWarehouseAdjustment } from '@/lib/warehouse'
import { z } from 'zod'

// ─── GET /api/warehouse/stock?date=YYYY-MM-DD ─────────────────────────────────
export async function GET(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const sp   = req.nextUrl.searchParams
    const date = parseDate(sp.get('date'), todayDate())

    const stock = await prisma.warehouseStock.findUnique({ where: { date } })
    return apiSuccess(stock ?? null)
  } catch (err) {
    return apiServerError(err)
  }
}

const initSchema = z.object({
  date:         z.string().min(1),
  openingStock: z.number().min(0),
})

const adjustSchema = z.object({
  date:       z.string().min(1),
  adjustment: z.number(),
  notes:      z.string().optional(),
})

// ─── POST /api/warehouse/stock ────────────────────────────────────────────────
// Two actions via body.action:
//   "init"   — set opening stock for a date (creates record if absent)
//   "adjust" — apply manual ± adjustment
export async function POST(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const body = await req.json()

    if (body.action === 'init') {
      const parsed = initSchema.safeParse(body)
      if (!parsed.success) {
        return apiError('Validasi gagal', 400, parsed.error.flatten().fieldErrors)
      }
      const date = parseDate(parsed.data.date, todayDate())

      const existing = await prisma.warehouseStock.findUnique({ where: { date } })
      if (existing) {
        return apiError('Stok untuk tanggal ini sudah ada. Gunakan adjustment untuk koreksi.', 409)
      }

      const stock = await prisma.warehouseStock.create({
        data: {
          date,
          openingStock: parsed.data.openingStock,
          closingStock: parsed.data.openingStock,
        },
      })
      return apiCreated(stock, 'Stok awal berhasil dicatat')
    }

    if (body.action === 'adjust') {
      const parsed = adjustSchema.safeParse(body)
      if (!parsed.success) {
        return apiError('Validasi gagal', 400, parsed.error.flatten().fieldErrors)
      }
      const date = parseDate(parsed.data.date, todayDate())
      const stock = await applyWarehouseAdjustment(date, parsed.data.adjustment, parsed.data.notes)
      return apiSuccess(stock, 'Penyesuaian stok berhasil diterapkan')
    }

    return apiError('action tidak valid. Gunakan "init" atau "adjust"', 400)
  } catch (err) {
    return apiServerError(err)
  }
}

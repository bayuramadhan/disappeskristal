import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/api/auth'
import { apiSuccess, apiServerError, parseDate, tomorrowDate, todayDate } from '@/lib/api/response'
import { toSak } from '@/lib/uom'

const RISK_PCT       = 0.05  // 5% buffer
const CANVAS_LOOKBACK = 7    // days for canvas forecast

// ─── GET /api/production/recommendation?date=YYYY-MM-DD ──────────────────────
export async function GET(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const sp         = req.nextUrl.searchParams
    const targetDate = parseDate(sp.get('date'), tomorrowDate())
    const riskPct    = parseFloat(sp.get('riskPct') ?? String(RISK_PCT))

    // ── 1. Confirmed preorders for target date (in sak) ──────────────────
    const preorderOrders = await prisma.order.findMany({
      where: {
        deliveryDate: targetDate,
        deletedAt:    null,
        orderChannel: 'PREORDER',
        status:       { in: ['CREATED', 'CONFIRMED'] },
      },
      select: { orderedQty: true, uom: { select: { unitsPerSak: true } } },
    })
    const confirmedPreorderQty   = Math.ceil(preorderOrders.reduce((s, o) => s + toSak(o.orderedQty, o.uom?.unitsPerSak), 0))
    const confirmedPreorderCount = preorderOrders.length

    // ── 2. Canvas forecast (avg daily from last N days, in sak) ──────────
    const lookbackStart = new Date(todayDate())
    lookbackStart.setDate(lookbackStart.getDate() - CANVAS_LOOKBACK)

    const canvasOrders = await prisma.order.findMany({
      where: {
        deliveryDate:  { gte: lookbackStart, lt: targetDate },
        deletedAt:     null,
        orderChannel:  'CANVAS',
        status:        { in: ['DELIVERED', 'PARTIAL', 'CREATED', 'CONFIRMED', 'LOADED'] },
      },
      select: { deliveryDate: true, orderedQty: true, uom: { select: { unitsPerSak: true } } },
    })
    // Group by day, sum in sak
    const canvasByDay = canvasOrders.reduce((map, o) => {
      const key = new Date(o.deliveryDate).toISOString().slice(0, 10)
      map[key] = (map[key] ?? 0) + toSak(o.orderedQty, o.uom?.unitsPerSak)
      return map
    }, {} as Record<string, number>)
    const canvasDays   = Object.values(canvasByDay)
    const avgCanvasQty = canvasDays.length > 0 ? canvasDays.reduce((s, v) => s + v, 0) / canvasDays.length : 0
    const estimatedCanvasQty = Math.ceil(avgCanvasQty)

    // ── 3. Hotline forecast (avg of last 7 days, in sak) ─────────────────
    const hotlineOrders = await prisma.order.findMany({
      where: {
        deliveryDate: { gte: lookbackStart, lt: targetDate },
        deletedAt:    null,
        orderChannel: 'HOTLINE',
        status:       { in: ['DELIVERED', 'PARTIAL', 'CREATED', 'CONFIRMED', 'LOADED'] },
      },
      select: { deliveryDate: true, orderedQty: true, uom: { select: { unitsPerSak: true } } },
    })
    const hotlineByDay = hotlineOrders.reduce((map, o) => {
      const key = new Date(o.deliveryDate).toISOString().slice(0, 10)
      map[key] = (map[key] ?? 0) + toSak(o.orderedQty, o.uom?.unitsPerSak)
      return map
    }, {} as Record<string, number>)
    const hotlineDays    = Object.values(hotlineByDay)
    const avgHotlineQty  = hotlineDays.length > 0 ? hotlineDays.reduce((s, v) => s + v, 0) / hotlineDays.length : 0
    const estimatedHotlineQty = Math.ceil(avgHotlineQty)

    // ── 4. Risk adjustment ────────────────────────────────────────────────
    const baseQty            = confirmedPreorderQty + estimatedCanvasQty + estimatedHotlineQty
    const riskAdjustmentQty  = Math.ceil(baseQty * riskPct)
    const recommendedQty     = baseQty + riskAdjustmentQty

    // ── 5. Existing production plan for this date (if any) ────────────────
    const existingPlan = await prisma.productionPlan.findFirst({
      where: { productionDate: targetDate },
    })

    // ── 6. Current warehouse stock ────────────────────────────────────────
    const latestStock = await prisma.warehouseStock.findFirst({
      orderBy: { date: 'desc' },
    })

    // ── 7. Vehicle capacity check ─────────────────────────────────────────
    const fleetCapacity = await prisma.vehicle.aggregate({
      where: { deletedAt: null, status: 'ACTIVE' },
      _sum:  { capacitySak: true },
    })
    const totalCapacitySak = fleetCapacity._sum.capacitySak ?? 0

    return apiSuccess({
      targetDate:    targetDate.toISOString().slice(0, 10),
      calculation: {
        confirmedPreorderQty,
        confirmedPreorderCount,
        estimatedCanvasQty,
        estimatedHotlineQty,
        riskPct,
        riskAdjustmentQty,
        recommendedProductionQty: recommendedQty,
      },
      context: {
        canvasLookbackDays:    CANVAS_LOOKBACK,
        avgCanvasQtyPerDay:    parseFloat(avgCanvasQty.toFixed(1)),
        avgHotlineQtyPerDay:   parseFloat(avgHotlineQty.toFixed(1)),
        currentWarehouseStock: latestStock?.closingStock ?? 0,
        totalFleetCapacitySak: totalCapacitySak,
        stockSufficiency:      (latestStock?.closingStock ?? 0) >= recommendedQty
          ? 'CUKUP'
          : 'KURANG',
      },
      existingPlan: existingPlan ?? null,
      warnings: [
        ...(recommendedQty > totalCapacitySak
          ? [`⚠️ Rekomendasi produksi (${recommendedQty} sak) melebihi kapasitas armada aktif (${totalCapacitySak} sak)`]
          : []),
        ...((latestStock?.closingStock ?? 0) < recommendedQty * 0.5
          ? [`⚠️ Stok gudang rendah (${latestStock?.closingStock ?? 0} sak). Produksi perlu segera dimulai.`]
          : []),
      ],
    })
  } catch (err) {
    return apiServerError(err)
  }
}

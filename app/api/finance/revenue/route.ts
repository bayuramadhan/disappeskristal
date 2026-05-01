import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/api/auth'
import { apiSuccess, apiError, apiServerError, parseDate, todayDate } from '@/lib/api/response'

// ─── GET /api/finance/revenue ─────────────────────────────────────────────────
// Query params:
//   startDate  — default: 7 days ago
//   endDate    — default: today
//   vehicleId  — optional filter
//   rayonId    — optional filter
//   groupBy    — 'vehicle' | 'rayon' | 'day'  (default: 'day')
export async function GET(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const sp = req.nextUrl.searchParams

    const today    = todayDate()
    const sevenAgo = new Date(today)
    sevenAgo.setDate(sevenAgo.getDate() - 6)

    const startDate = parseDate(sp.get('startDate'), sevenAgo)
    const endDate   = parseDate(sp.get('endDate'),   today)
    const vehicleId = sp.get('vehicleId')
    const rayonId   = sp.get('rayonId')
    const groupBy   = (sp.get('groupBy') ?? 'day') as 'vehicle' | 'rayon' | 'day'

    if (endDate < startDate) {
      return apiError('endDate harus lebih besar dari startDate', 400)
    }

    const vehicleFilter = vehicleId ? Prisma.sql`AND o."vehicleId" = ${vehicleId}` : Prisma.empty
    const rayonFilter   = rayonId   ? Prisma.sql`AND o."rayonId"   = ${rayonId}`   : Prisma.empty

    // ── Per-day per-vehicle revenue via raw SQL ────────────────────────────
    const rows = await prisma.$queryRaw<{
      date:         Date
      vehicleId:    string | null
      plateNumber:  string | null
      rayonId:      string | null
      rayonName:    string | null
      totalOrders:  number
      totalDeliveredQty: number
      totalReturnedQty:  number
      grossRevenue: number
      vehicleCost:  number
    }[]>`
      SELECT
        o."deliveryDate"                                          AS date,
        o."vehicleId",
        v."plateNumber",
        o."rayonId",
        r."name"                                                  AS "rayonName",
        COUNT(o.id)::int                                          AS "totalOrders",
        COALESCE(SUM(o."deliveredQty"), 0)                        AS "totalDeliveredQty",
        COALESCE(SUM(o."returnedQty"),  0)                        AS "totalReturnedQty",
        COALESCE(SUM(o."deliveredQty" * o."pricePerUnit"), 0)     AS "grossRevenue",
        COALESCE((
          SELECT SUM(vc."fuelCost" + vc."driverCost" + vc."helperCost"
                     + vc."maintenanceCost" + vc."depreciationCost")
          FROM "VehicleCost" vc
          WHERE vc."vehicleId" = o."vehicleId"
            AND vc."date"      = o."deliveryDate"
        ), 0)                                                     AS "vehicleCost"
      FROM "Order" o
      LEFT JOIN "Vehicle" v ON v.id = o."vehicleId"
      LEFT JOIN "Rayon"   r ON r.id = o."rayonId"
      WHERE o.status    IN ('DELIVERED', 'PARTIAL')
        AND o."deletedAt" IS NULL
        AND o."deliveryDate" >= ${startDate}
        AND o."deliveryDate" <= ${endDate}
        ${vehicleFilter}
        ${rayonFilter}
      GROUP BY o."deliveryDate", o."vehicleId", v."plateNumber", o."rayonId", r."name"
      ORDER BY o."deliveryDate" DESC, "grossRevenue" DESC
    `

    // Normalize BigInt to Number
    const data = rows.map(r => ({
      ...r,
      totalOrders:       Number(r.totalOrders),
      totalDeliveredQty: Number(r.totalDeliveredQty),
      totalReturnedQty:  Number(r.totalReturnedQty),
      grossRevenue:      Number(r.grossRevenue),
      vehicleCost:       Number(r.vehicleCost),
      netRevenue:        Number(r.grossRevenue) - Number(r.vehicleCost),
    }))

    // ── Group results ─────────────────────────────────────────────────────
    let grouped: Record<string, unknown>[]

    if (groupBy === 'vehicle') {
      const byVehicle: Record<string, { vehicleId: string | null; plateNumber: string | null; rows: typeof data }> = {}
      for (const row of data) {
        const key = row.vehicleId ?? '__unassigned__'
        if (!byVehicle[key]) byVehicle[key] = { vehicleId: row.vehicleId, plateNumber: row.plateNumber, rows: [] }
        byVehicle[key].rows.push(row)
      }
      grouped = Object.values(byVehicle).map(g => ({
        vehicleId:         g.vehicleId,
        plateNumber:       g.plateNumber,
        totalOrders:       g.rows.reduce((s, r) => s + r.totalOrders, 0),
        totalDeliveredQty: g.rows.reduce((s, r) => s + r.totalDeliveredQty, 0),
        totalReturnedQty:  g.rows.reduce((s, r) => s + r.totalReturnedQty, 0),
        grossRevenue:      g.rows.reduce((s, r) => s + r.grossRevenue, 0),
        vehicleCost:       g.rows.reduce((s, r) => s + r.vehicleCost, 0),
        netRevenue:        g.rows.reduce((s, r) => s + r.netRevenue, 0),
        dailyBreakdown:    g.rows,
      }))
    } else if (groupBy === 'rayon') {
      const byRayon: Record<string, { rayonId: string | null; rayonName: string | null; rows: typeof data }> = {}
      for (const row of data) {
        const key = row.rayonId ?? '__unassigned__'
        if (!byRayon[key]) byRayon[key] = { rayonId: row.rayonId, rayonName: row.rayonName, rows: [] }
        byRayon[key].rows.push(row)
      }
      grouped = Object.values(byRayon).map(g => ({
        rayonId:           g.rayonId,
        rayonName:         g.rayonName,
        totalOrders:       g.rows.reduce((s, r) => s + r.totalOrders, 0),
        totalDeliveredQty: g.rows.reduce((s, r) => s + r.totalDeliveredQty, 0),
        totalReturnedQty:  g.rows.reduce((s, r) => s + r.totalReturnedQty, 0),
        grossRevenue:      g.rows.reduce((s, r) => s + r.grossRevenue, 0),
        vehicleCost:       g.rows.reduce((s, r) => s + r.vehicleCost, 0),
        netRevenue:        g.rows.reduce((s, r) => s + r.netRevenue, 0),
      }))
    } else {
      // group by day
      const byDay: Record<string, typeof data> = {}
      for (const row of data) {
        const key = new Date(row.date).toISOString().slice(0, 10)
        if (!byDay[key]) byDay[key] = []
        byDay[key].push(row)
      }
      grouped = Object.entries(byDay)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([date, rows]) => ({
          date,
          totalOrders:       rows.reduce((s, r) => s + r.totalOrders, 0),
          totalDeliveredQty: rows.reduce((s, r) => s + r.totalDeliveredQty, 0),
          totalReturnedQty:  rows.reduce((s, r) => s + r.totalReturnedQty, 0),
          grossRevenue:      rows.reduce((s, r) => s + r.grossRevenue, 0),
          vehicleCost:       rows.reduce((s, r) => s + r.vehicleCost, 0),
          netRevenue:        rows.reduce((s, r) => s + r.netRevenue, 0),
          breakdown:         rows,
        }))
    }

    // ── Totals ────────────────────────────────────────────────────────────
    const totals = {
      totalOrders:       data.reduce((s, r) => s + r.totalOrders, 0),
      totalDeliveredQty: data.reduce((s, r) => s + r.totalDeliveredQty, 0),
      totalReturnedQty:  data.reduce((s, r) => s + r.totalReturnedQty, 0),
      grossRevenue:      data.reduce((s, r) => s + r.grossRevenue, 0),
      vehicleCost:       data.reduce((s, r) => s + r.vehicleCost, 0),
      netRevenue:        data.reduce((s, r) => s + r.netRevenue, 0),
    }

    return apiSuccess({
      period: {
        startDate: startDate.toISOString().slice(0, 10),
        endDate:   endDate.toISOString().slice(0, 10),
      },
      groupBy,
      totals,
      data: grouped,
    })
  } catch (err) {
    return apiServerError(err)
  }
}

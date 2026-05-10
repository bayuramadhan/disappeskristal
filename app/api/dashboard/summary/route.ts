import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/api/auth'
import { apiSuccess, apiServerError, parseDate, todayDate } from '@/lib/api/response'

// ─── GET /api/dashboard/summary?date=YYYY-MM-DD ───────────────────────────────
export async function GET(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const sp   = req.nextUrl.searchParams
    const date = parseDate(sp.get('date'), todayDate())

    const [
      ordersByStatus,
      fleetCount,
      warehouseStock,
      returnBreakdown,
      qtyRows,
      topCustomerRows,
      revenueRaw,
    ] = await Promise.all([

      // Orders by status today (count only — no qty sum)
      prisma.order.groupBy({
        by:     ['status'],
        where:  { deliveryDate: date, deletedAt: null },
        _count: { id: true },
      }),

      // Active fleet today
      prisma.fleetDailyStatus.count({
        where: { date, activeStatus: true, deletedAt: null },
      }),

      // Latest warehouse stock
      prisma.warehouseStock.findFirst({
        orderBy: { date: 'desc' },
      }),

      // Return reasons breakdown today
      prisma.deliveryLog.groupBy({
        by:    ['returnReason'],
        where: {
          returnedQty: { gt: 0 },
          timestamp: {
            gte: date,
            lt:  new Date(date.getTime() + 86_400_000),
          },
        },
        _count: { id: true },
        _sum:   { returnedQty: true },
      }),

      // Qty sums in sak — join Unit table for proper conversion
      prisma.$queryRaw<{
        totalOrderedSak:  number
        totalDeliveredSak: number
        totalReturnedSak:  number
      }[]>`
        SELECT
          COALESCE(SUM(CEIL(o."orderedQty"::float  / COALESCE(u."unitsPerSak", 1))), 0) AS "totalOrderedSak",
          COALESCE(SUM(CASE WHEN o.status IN ('DELIVERED','PARTIAL')
            THEN CEIL(o."deliveredQty"::float / COALESCE(u."unitsPerSak", 1)) ELSE 0 END), 0) AS "totalDeliveredSak",
          COALESCE(SUM(CASE WHEN o.status IN ('DELIVERED','PARTIAL')
            THEN CEIL(o."returnedQty"::float  / COALESCE(u."unitsPerSak", 1)) ELSE 0 END), 0) AS "totalReturnedSak"
        FROM "Order" o
        LEFT JOIN "Unit" u ON o."uomId" = u.id
        WHERE o."deliveryDate" = ${date}
          AND o."deletedAt" IS NULL
      `,

      // Top 5 customers by delivered sak
      prisma.$queryRaw<{ customerId: string; totalDeliveredSak: number }[]>`
        SELECT
          o."customerId",
          SUM(CEIL(o."deliveredQty"::float / COALESCE(u."unitsPerSak", 1))) AS "totalDeliveredSak"
        FROM "Order" o
        LEFT JOIN "Unit" u ON o."uomId" = u.id
        WHERE o."deliveryDate" = ${date}
          AND o."deletedAt" IS NULL
          AND o.status IN ('DELIVERED', 'PARTIAL')
        GROUP BY o."customerId"
        ORDER BY "totalDeliveredSak" DESC
        LIMIT 5
      `,

      // Revenue: price is always per sak, so divide qty by unitsPerSak first
      prisma.$queryRaw<{ gross: number; cost: number }[]>`
        SELECT
          COALESCE(SUM(
            o."deliveredQty"::float / COALESCE(u."unitsPerSak", 1) * o."pricePerUnit"
          ), 0) AS gross,
          COALESCE((
            SELECT SUM("fuelCost" + "driverCost" + "helperCost" + "maintenanceCost" + "depreciationCost")
            FROM "VehicleCost"
            WHERE "date" = ${date}
          ), 0) AS cost
        FROM "Order" o
        LEFT JOIN "Unit" u ON o."uomId" = u.id
        WHERE o."deliveryDate" = ${date}
          AND o."deletedAt" IS NULL
          AND o.status IN ('DELIVERED', 'PARTIAL')
      `,
    ])

    // Enrich top customers with names
    const customerIds  = topCustomerRows.map(c => c.customerId)
    const customerNames = await prisma.customer.findMany({
      where:  { id: { in: customerIds } },
      select: { id: true, name: true, customerType: true },
    })
    const nameMap = Object.fromEntries(customerNames.map(c => [c.id, c]))

    const totalOrders     = ordersByStatus.reduce((s, g) => s + g._count.id, 0)
    const qtyData         = qtyRows[0] ?? { totalOrderedSak: 0, totalDeliveredSak: 0, totalReturnedSak: 0 }
    const grossRevenue    = Number(revenueRaw[0]?.gross ?? 0)
    const totalVehicleCost = Number(revenueRaw[0]?.cost ?? 0)

    return apiSuccess({
      date:      date.toISOString().slice(0, 10),
      orders: {
        total:           totalOrders,
        totalOrderedQty: Number(qtyData.totalOrderedSak),
        byStatus:        Object.fromEntries(ordersByStatus.map(g => [g.status, g._count.id])),
        totalDelivered:  Number(qtyData.totalDeliveredSak),
        totalReturned:   Number(qtyData.totalReturnedSak),
      },
      finance: {
        grossRevenue,
        totalVehicleCost,
        netRevenue: grossRevenue - totalVehicleCost,
      },
      fleet: {
        activeCount: fleetCount,
      },
      warehouse: warehouseStock,
      topCustomers: topCustomerRows.map(c => ({
        ...nameMap[c.customerId],
        totalDelivered: Number(c.totalDeliveredSak),
      })),
      returnBreakdown: returnBreakdown.map(r => ({
        reason:   r.returnReason ?? 'UNKNOWN',
        count:    r._count.id,
        totalQty: r._sum.returnedQty ?? 0,
      })),
    })
  } catch (err) {
    return apiServerError(err)
  }
}

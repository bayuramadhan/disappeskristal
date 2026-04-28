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

    // Run all aggregations in parallel
    const [
      ordersByStatus,
      orderRevenue,
      fleetCount,
      warehouseStock,
      topCustomers,
      returnBreakdown,
    ] = await Promise.all([

      // Orders by status today
      prisma.order.groupBy({
        by:     ['status'],
        where:  { deliveryDate: date, deletedAt: null },
        _count: { id: true },
        _sum:   { orderedQty: true, deliveredQty: true, returnedQty: true },
      }),

      // Revenue today
      prisma.order.aggregate({
        where: {
          deliveryDate: date,
          deletedAt:    null,
          status:       { in: ['DELIVERED', 'PARTIAL'] },
        },
        _sum:   { deliveredQty: true, returnedQty: true },
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

      // Top 5 customers by delivered qty today
      prisma.order.groupBy({
        by:     ['customerId'],
        where:  { deliveryDate: date, deletedAt: null, status: { in: ['DELIVERED', 'PARTIAL'] } },
        _sum:   { deliveredQty: true },
        orderBy: { _sum: { deliveredQty: 'desc' } },
        take:   5,
      }),

      // Return reasons breakdown today
      prisma.deliveryLog.groupBy({
        by:    ['returnReason'],
        where: {
          returnedQty: { gt: 0 },
          timestamp:   {
            gte: date,
            lt:  new Date(date.getTime() + 86_400_000),
          },
        },
        _count: { id: true },
        _sum:   { returnedQty: true },
      }),
    ])

    // Enrich top customers with names
    const customerIds = topCustomers.map(c => c.customerId)
    const customerNames = await prisma.customer.findMany({
      where:  { id: { in: customerIds } },
      select: { id: true, name: true, customerType: true },
    })
    const nameMap = Object.fromEntries(customerNames.map(c => [c.id, c]))

    // Aggregate order totals across all statuses
    const totalOrders     = ordersByStatus.reduce((s, g) => s + g._count.id, 0)
    const totalOrderedQty = ordersByStatus.reduce((s, g) => s + (g._sum.orderedQty ?? 0), 0)
    const deliveredOrders = ordersByStatus.find(g => g.status === 'DELIVERED')
    const partialOrders   = ordersByStatus.find(g => g.status === 'PARTIAL')

    // Revenue: sum(deliveredQty * pricePerUnit) requires raw because groupBy _sum can't multiply
    const revenueRaw = await prisma.$queryRaw<{ total: number }[]>`
      SELECT COALESCE(SUM("deliveredQty" * "pricePerUnit"), 0) AS total
      FROM "Order"
      WHERE "deliveryDate" = ${date}
        AND "deletedAt" IS NULL
        AND status IN ('DELIVERED', 'PARTIAL')
    `
    const grossRevenue = Number(revenueRaw[0]?.total ?? 0)

    // Vehicle costs today
    const costRaw = await prisma.$queryRaw<{ total: number }[]>`
      SELECT COALESCE(SUM("fuelCost" + "driverCost" + "helperCost" + "maintenanceCost" + "depreciationCost"), 0) AS total
      FROM "VehicleCost"
      WHERE "date" = ${date}
    `
    const totalVehicleCost = Number(costRaw[0]?.total ?? 0)

    return apiSuccess({
      date:      date.toISOString().slice(0, 10),
      orders: {
        total:           totalOrders,
        totalOrderedQty,
        byStatus:        Object.fromEntries(ordersByStatus.map(g => [g.status, g._count.id])),
        totalDelivered:  orderRevenue._sum.deliveredQty ?? 0,
        totalReturned:   orderRevenue._sum.returnedQty  ?? 0,
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
      topCustomers: topCustomers.map(c => ({
        ...nameMap[c.customerId],
        totalDelivered: c._sum.deliveredQty ?? 0,
      })),
      returnBreakdown: returnBreakdown.map(r => ({
        reason:    r.returnReason ?? 'UNKNOWN',
        count:     r._count.id,
        totalQty:  r._sum.returnedQty ?? 0,
      })),
    })
  } catch (err) {
    return apiServerError(err)
  }
}

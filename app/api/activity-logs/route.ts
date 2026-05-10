import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/api/auth'
import { apiSuccess, apiServerError, parseDate, todayDate, parsePagination, makeMeta } from '@/lib/api/response'

// ─── GET /api/activity-logs?date=&vehicleId=&action= ─────────────────────────
export async function GET(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const sp       = req.nextUrl.searchParams
    const { page, limit, skip } = parsePagination(sp)
    const dateParam = sp.get('date')
    const vehicleId = sp.get('vehicleId')
    const action    = sp.get('action')

    const date    = parseDate(dateParam, todayDate())
    const nextDay = new Date(date)
    nextDay.setDate(nextDay.getDate() + 1)

    const where: Record<string, unknown> = {
      // Filter berdasarkan "tanggal pengiriman" (date field), bukan timestamp log
      date: { gte: date, lt: nextDay },
    }
    if (vehicleId) where.vehicleId = vehicleId
    if (action)    where.action    = action

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        skip,
        take:    limit,
        orderBy: { timestamp: 'desc' },
        include: {
          vehicle: { select: { id: true, plateNumber: true } },
          order:   { select: { id: true, orderNumber: true, orderedQty: true, status: true,
                               customer: { select: { id: true, name: true } } } },
        },
      }),
      prisma.activityLog.count({ where }),
    ])

    return apiSuccess(logs, undefined, makeMeta(page, limit, total))
  } catch (err) {
    return apiServerError(err)
  }
}

import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/api/auth'
import { prisma } from '@/lib/db'

export const maxDuration = 55

export async function GET(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  const sinceParam = req.nextUrl.searchParams.get('since')
  let lastCheck = sinceParam ? new Date(sinceParam) : new Date()

  const stream = new ReadableStream({
    async start(controller) {
      const enc  = new TextEncoder()
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        } catch {}
      }

      send('connected', { ts: new Date().toISOString() })

      const poll = async () => {
        try {
          const since = lastCheck
          lastCheck   = new Date()

          const newDrafts = await prisma.waDraft.findMany({
            where:   { createdAt: { gt: since } },
            orderBy: { createdAt: 'asc' },
            select:  { id: true, sender: true, customerNameHint: true, orderedQty: true, deliveryDate: true, createdAt: true },
          })

          const newOrders = await prisma.order.findMany({
            where:   { createdAt: { gt: since }, orderChannel: 'HOTLINE' },
            orderBy: { createdAt: 'asc' },
            select:  { id: true, orderNumber: true, orderedQty: true, deliveryDate: true, createdAt: true, customer: { select: { name: true } } },
          })

          for (const draft of newDrafts) send('wa_draft', draft)
          for (const order of newOrders) send('wa_order', order)

          if (!newDrafts.length && !newOrders.length) {
            send('heartbeat', { ts: lastCheck.toISOString() })
          }
        } catch {}
      }

      const interval = setInterval(poll, 4000)
      req.signal.addEventListener('abort', () => {
        clearInterval(interval)
        try { controller.close() } catch {}
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache, no-transform',
      'Connection':        'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

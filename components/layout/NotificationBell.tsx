'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, MessageSquare, ShoppingCart, X, CheckCheck } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'

type NotifType = 'wa_draft' | 'wa_order'

interface Notif {
  id:     string
  type:   NotifType
  title:  string
  body:   string
  ts:     Date
  href:   string
  read:   boolean
}

export function NotificationBell() {
  const router             = useRouter()
  const [open, setOpen]    = useState(false)
  const [notifs, setNotifs] = useState<Notif[]>([])
  const esRef              = useRef<EventSource | null>(null)
  const sinceRef           = useRef(new Date().toISOString())
  const reconnectTimer     = useRef<ReturnType<typeof setTimeout> | null>(null)

  const addNotif = useCallback((n: Notif) => {
    setNotifs(prev => {
      if (prev.find(p => p.id === n.id)) return prev
      return [n, ...prev].slice(0, 20)
    })
  }, [])

  const markAllRead = () => setNotifs(prev => prev.map(n => ({ ...n, read: true })))

  const handleClick = (n: Notif) => {
    setNotifs(prev => prev.map(p => p.id === n.id ? { ...p, read: true } : p))
    setOpen(false)
    router.push(n.href)
  }

  const connect = useCallback(() => {
    if (esRef.current) esRef.current.close()

    const es = new EventSource(
      `/api/notifications/stream?since=${sinceRef.current}`,
      { withCredentials: true },
    )
    esRef.current = es

    es.addEventListener('wa_draft', e => {
      const d   = JSON.parse(e.data)
      sinceRef.current = d.createdAt
      const who = d.customerNameHint ?? d.sender ?? 'Pelanggan'
      addNotif({
        id:    `draft-${d.id}`,
        type:  'wa_draft',
        title: 'Pesan WA baru — perlu review',
        body:  `${who}${d.orderedQty ? ` · ${d.orderedQty} sak` : ''}`,
        ts:    new Date(d.createdAt),
        href:  '/orders',
        read:  false,
      })
    })

    es.addEventListener('wa_order', e => {
      const d = JSON.parse(e.data)
      sinceRef.current = d.createdAt
      const date = d.deliveryDate ? d.deliveryDate.slice(0, 10) : ''
      addNotif({
        id:    `order-${d.id}`,
        type:  'wa_order',
        title: 'Pesanan WA otomatis dibuat',
        body:  `${d.customer?.name ?? '—'} · ${d.orderedQty} sak · ${format(new Date(d.deliveryDate), 'd MMM', { locale: localeId })}`,
        ts:    new Date(d.createdAt),
        href:  date ? `/orders?date=${date}` : '/orders',
        read:  false,
      })
    })

    es.onerror = () => {
      es.close()
      reconnectTimer.current = setTimeout(connect, 8_000)
    }
  }, [addNotif])

  useEffect(() => {
    connect()
    return () => {
      esRef.current?.close()
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
    }
  }, [connect])

  const unreadCount = notifs.filter(n => !n.read).length

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0 shadow-xl" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="font-semibold text-sm">Notifikasi</span>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                onClick={markAllRead}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Tandai semua dibaca
              </Button>
            )}
          </div>
        </div>

        {/* List */}
        <div className="max-h-[420px] overflow-y-auto">
          {notifs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
              <Bell className="h-8 w-8 opacity-30" />
              <p className="text-sm">Belum ada notifikasi</p>
            </div>
          ) : (
            notifs.map(n => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 border-b last:border-b-0 ${n.read ? '' : 'bg-blue-50/50'}`}
              >
                {/* Icon */}
                <div className={`mt-0.5 shrink-0 flex h-8 w-8 items-center justify-center rounded-full ${n.type === 'wa_draft' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                  {n.type === 'wa_draft'
                    ? <MessageSquare className="h-4 w-4" />
                    : <ShoppingCart  className="h-4 w-4" />}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-tight ${n.read ? 'text-muted-foreground' : 'font-semibold text-foreground'}`}>
                    {n.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{n.body}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {formatDistanceToNow(n.ts, { addSuffix: true, locale: localeId })}
                  </p>
                </div>

                {/* Unread dot */}
                {!n.read && (
                  <div className="mt-1.5 shrink-0 h-2 w-2 rounded-full bg-blue-500" />
                )}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

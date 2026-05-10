'use client'

import { useState, useEffect, useRef } from 'react'
import { format } from 'date-fns'
import {
  Plus, Search, X, Download, Inbox, Trash2, History,
  FilePlus2, ArrowRightLeft, Truck, LogIn, LogOut, ClipboardCheck, Clock,
} from 'lucide-react'
import Papa from 'papaparse'
import { useOrders } from '@/hooks/useOrders'
import { useCustomers } from '@/hooks/useCustomers'
import { useRole } from '@/hooks/useRole'
import { toast } from '@/hooks/use-toast'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ChannelTag } from '@/components/shared/ChannelTag'
import { LoadingState } from '@/components/shared/LoadingState'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency } from '@/lib/utils'
import useSWR, { mutate as globalMutate } from 'swr'
import { fetcher } from '@/lib/fetcher'

// ─── Konfigurasi tampilan per tipe aksi ─────────────────────────────────────
const ORDER_ACTIVITY_ACTIONS = 'ORDER_CREATED,ORDER_STATUS_CHANGED,ORDER_DELETED,ORDER_ASSIGNED,ORDER_UNASSIGNED,DELIVERY_LOGGED'

const STATUS_CHANGE_COLOR: Record<string, string> = {
  CONFIRMED: 'text-emerald-700', ASSIGNED: 'text-sky-700',
  CANCELLED:  'text-destructive', REJECTED: 'text-destructive',
  DELIVERED:  'text-emerald-700', PARTIAL:  'text-amber-700',
  RETURNED:   'text-amber-700',
}

const ACTIVITY_CONFIG: Record<string, {
  label: string; color: string; bg: string; border: string; icon: React.ReactNode
}> = {
  ORDER_CREATED:        { label: 'Pesanan Dibuat',     color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: <FilePlus2 className="h-4 w-4 text-emerald-600" /> },
  ORDER_STATUS_CHANGED: { label: 'Status Diubah',      color: 'text-sky-700',     bg: 'bg-sky-50',     border: 'border-sky-200',     icon: <ArrowRightLeft className="h-4 w-4 text-sky-600" /> },
  ORDER_DELETED:        { label: 'Pesanan Dihapus',    color: 'text-destructive', bg: 'bg-red-50',     border: 'border-red-200',     icon: <Trash2 className="h-4 w-4 text-destructive" /> },
  ORDER_ASSIGNED:       { label: 'Masuk Armada',       color: 'text-sky-700',     bg: 'bg-sky-50',     border: 'border-sky-200',     icon: <LogIn className="h-4 w-4 text-sky-600" /> },
  ORDER_UNASSIGNED:     { label: 'Keluar Armada',      color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200',   icon: <LogOut className="h-4 w-4 text-amber-600" /> },
  DELIVERY_LOGGED:      { label: 'Pengiriman Dicatat', color: 'text-violet-700',  bg: 'bg-violet-50',  border: 'border-violet-200',  icon: <ClipboardCheck className="h-4 w-4 text-violet-600" /> },
}

const STATUS_OPTIONS  = ['CREATED', 'CONFIRMED', 'LOADED', 'DELIVERED', 'PARTIAL', 'RETURNED', 'CANCELLED']
const CHANNEL_OPTIONS = ['PREORDER', 'HOTLINE', 'CANVAS']
const CHANNEL_LABELS: Record<string, string> = {
  PREORDER:    'Pre-order',
  HOTLINE:     'Hotline',
  CANVAS:      'Canvas',
  ADMIN_INPUT: 'Admin Input',
}
const STATUS_LABELS: Record<string, string> = {
  CREATED:   'Dibuat',
  CONFIRMED: 'Dikonfirmasi',
  ASSIGNED:  'Ditugaskan',
  LOADED:    'Dimuat',
  DELIVERED: 'Terkirim',
  PARTIAL:   'Sebagian',
  RETURNED:  'Dikembalikan',
  CANCELLED: 'Dibatalkan',
  REJECTED:  'Ditolak',
}

// ─── OrderActivityLog: audit trail untuk menu Pesanan ────────────────────────
function OrderActivityLog({ date, onDateChange }: { date: string; onDateChange: (d: string) => void }) {
  const { data, isLoading, mutate } = useSWR(
    `/api/activity-logs?date=${date}&limit=200&action=${ORDER_ACTIVITY_ACTIONS}`,
    fetcher,
    { refreshInterval: 20_000 },
  )
  const logs: any[] = data?.data ?? data ?? []

  return (
    <div>
      {/* Date picker */}
      <div className="flex items-center gap-3 mb-4">
        <Label className="text-sm shrink-0">Tanggal</Label>
        <Input
          type="date" value={date}
          onChange={e => onDateChange(e.target.value)}
          className="w-40 h-8 text-sm"
        />
        <Button variant="ghost" size="sm" className="h-8 text-xs"
          onClick={() => onDateChange(format(new Date(), 'yyyy-MM-dd'))}>
          Hari Ini
        </Button>
        <div className="flex-1" />
        <p className="text-sm text-muted-foreground">
          {isLoading ? 'Memuat...' : `${logs.length} aktivitas`}
        </p>
        <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5" onClick={() => mutate()}>
          <Clock className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {isLoading ? (
        <LoadingState rows={6} />
      ) : logs.length === 0 ? (
        <EmptyState
          title="Belum ada aktivitas"
          description="Setiap perubahan pesanan — dibuat, dikonfirmasi, dibatalkan, diassign, atau dicatat pengirimannya — akan tercatat di sini."
        />
      ) : (
        <div className="space-y-2">
          {logs.map((log: any) => {
            const meta = log.meta ?? {}
            const cfg  = ACTIVITY_CONFIG[log.action] ?? ACTIVITY_CONFIG.ORDER_STATUS_CHANGED

            // Untuk ORDER_STATUS_CHANGED, warna teks status tujuan
            const toStatusColor = log.action === 'ORDER_STATUS_CHANGED'
              ? (STATUS_CHANGE_COLOR[meta.toStatus] ?? 'text-foreground')
              : null

            return (
              <div key={log.id} className={`flex gap-3 rounded-lg border p-3 ${cfg.bg} ${cfg.border}`}>
                {/* Ikon aksi */}
                <div className="mt-0.5 shrink-0">{cfg.icon}</div>

                {/* Body */}
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</span>
                    {log.vehicle && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
                        <Truck className="h-3 w-3" />{log.vehicle.plateNumber}
                      </span>
                    )}
                  </div>

                  {/* Pelanggan & no. pesanan */}
                  {meta.customerName && (
                    <p className="text-sm font-medium">{meta.customerName}</p>
                  )}

                  {/* Detail spesifik per action */}
                  {log.action === 'ORDER_CREATED' && (
                    <p className="text-sm text-muted-foreground">
                      {meta.orderedQty} {meta.uom ?? 'sak'} · {meta.orderChannel}
                      {meta.pricePerUnit && ` · ${formatCurrency(meta.pricePerUnit)}/sak`}
                    </p>
                  )}
                  {log.action === 'ORDER_STATUS_CHANGED' && (
                    <p className="text-sm text-muted-foreground">
                      <StatusBadge status={meta.fromStatus} />
                      <span className="mx-1.5">→</span>
                      <span className={`font-semibold ${toStatusColor}`}>
                        <StatusBadge status={meta.toStatus} />
                      </span>
                      {meta.deliveredQty != null && meta.deliveredQty > 0 && (
                        <span className="ml-2">· {meta.deliveredQty} sak terkirim</span>
                      )}
                    </p>
                  )}
                  {log.action === 'ORDER_DELETED' && (
                    <p className="text-sm text-muted-foreground">
                      {meta.orderedQty} {meta.uom ?? 'sak'} · status sebelumnya: <StatusBadge status={meta.fromStatus} />
                    </p>
                  )}
                  {log.action === 'ORDER_ASSIGNED' && (
                    <p className="text-sm text-muted-foreground">
                      {meta.qty} sak → {meta.plateNumber}
                    </p>
                  )}
                  {log.action === 'ORDER_UNASSIGNED' && (
                    <p className="text-sm text-muted-foreground">
                      {meta.plateNumber
                        ? `dikeluarkan dari ${meta.plateNumber}`
                        : 'dikeluarkan dari semua armada'}
                    </p>
                  )}
                  {log.action === 'DELIVERY_LOGGED' && (
                    <p className="text-sm text-muted-foreground">
                      {meta.deliveredQty} sak terkirim
                      {meta.returnedQty > 0 && ` · ${meta.returnedQty} retur`}
                      {meta.plateNumber && ` · ${meta.plateNumber}`}
                      {' · Status → '}
                      <StatusBadge status={meta.orderStatus} />
                    </p>
                  )}

                  {/* No. pesanan */}
                  {meta.orderNumber && (
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{meta.orderNumber}</p>
                  )}
                </div>

                {/* Timestamp & operator */}
                <div className="shrink-0 text-right space-y-0.5">
                  <p className="text-xs font-mono text-muted-foreground">
                    {format(new Date(log.timestamp), 'HH:mm:ss')}
                  </p>
                  {log.userName && (
                    <p className="text-xs text-muted-foreground">{log.userName}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function DraftCard({ draft, customers, units, today, onPublish, onDelete, isReviewing, onReview }: {
  draft: any; customers: any[]; units: any[]; today: string
  onPublish: (draft: any, form: any) => Promise<void>
  onDelete: () => void
  isReviewing: boolean; onReview: () => void
}) {
  const [form, setForm] = useState({
    customerId:         draft.customerId ?? '',
    deliveryLocationId: draft.deliveryLocationId ?? '',
    orderedQty:         draft.orderedQty != null ? String(draft.orderedQty) : '',
    uomId:              draft.uomId ?? '',
    deliveryDate:       draft.deliveryDate ?? today,
    pricePerUnit:       '',
    notes:              draft.notes ?? '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [priceHint, setPriceHint]   = useState<string | null>(null)

  // Auto-set deliveryLocationId ke default location saat customer berubah
  useEffect(() => {
    const customer = customers.find((c: any) => c.id === form.customerId)
    const defaultLoc = customer?.locations?.find((l: any) => l.isDefault) ?? customer?.locations?.[0]
    setForm(f => ({ ...f, deliveryLocationId: defaultLoc?.id ?? '' }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.customerId, customers])

  // Auto-lookup harga dari PriceProfile (gunakan rayonId dari lokasi yang dipilih)
  useEffect(() => {
    if (!form.customerId || !form.deliveryDate) { setPriceHint(null); return }
    const customer = customers.find((c: any) => c.id === form.customerId)
    if (!customer) { setPriceHint(null); return }

    const selectedLoc = customer.locations?.find((l: any) => l.id === form.deliveryLocationId)
      ?? customer.locations?.find((l: any) => l.isDefault)
      ?? customer.locations?.[0]
    const locationRayonId = selectedLoc?.rayonId ?? null

    const params = new URLSearchParams({ customerType: customer.customerType, channel: 'HOTLINE' })
    fetch(`/api/price-profiles?${params}`)
      .then(r => r.json())
      .then(json => {
        const profiles: any[] = json.data ?? []
        const date  = new Date(form.deliveryDate)
        const valid = profiles.filter(p => new Date(p.validFrom) <= date && date <= new Date(p.validUntil))
        const match = valid.find(p => p.rayonId === locationRayonId) ?? valid.find(p => p.rayonId === null)
        if (match) { setForm(f => ({ ...f, pricePerUnit: String(match.price) })); setPriceHint(`Rp ${match.price.toLocaleString('id-ID')}/sak`) }
        else setPriceHint(null)
      })
      .catch(() => setPriceHint(null))
  }, [form.customerId, form.deliveryLocationId, form.deliveryDate, customers])

  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs text-muted-foreground flex-1 line-clamp-2 font-mono">{draft.rawMessage}</div>
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="flex gap-2 text-xs text-muted-foreground flex-wrap">
        {draft.sender && <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">📱 {draft.sender}</span>}
        {draft.customerNameHint && <span className="bg-muted px-1.5 py-0.5 rounded">👤 {draft.customerNameHint}</span>}
        {draft.orderedQty && <span className="bg-muted px-1.5 py-0.5 rounded">📦 {draft.orderedQty} {draft.uom?.abbreviation ?? 'sak'}</span>}
        {draft.deliveryDate && <span className="bg-muted px-1.5 py-0.5 rounded">📅 {draft.deliveryDate}</span>}
      </div>
      <Button size="sm" variant="outline" className="w-full h-7 text-xs" onClick={onReview}>
        {isReviewing ? '▲ Tutup form' : '▼ Lengkapi & Buat Pesanan'}
      </Button>
      {isReviewing && (
        <form className="space-y-3 pt-1" onSubmit={async e => { e.preventDefault(); setSubmitting(true); await onPublish(draft, form); setSubmitting(false) }}>
          <div className="space-y-1">
            <Label className="text-xs">Pelanggan <span className="text-destructive">*</span></Label>
            <Select value={form.customerId} onValueChange={v => setForm(f => ({ ...f, customerId: v }))}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pilih pelanggan..." /></SelectTrigger>
              <SelectContent>
                {customers.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name} — {c.customerType}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {/* Location picker — selalu tampil saat customer dipilih */}
          {(() => {
            const locs: any[] = customers.find((c: any) => c.id === form.customerId)?.locations ?? []
            if (!form.customerId || locs.length === 0) return null
            return (
              <div className="space-y-1">
                <Label className="text-xs">Lokasi Pengiriman <span className="text-destructive">*</span></Label>
                <Select value={form.deliveryLocationId} onValueChange={v => setForm(f => ({ ...f, deliveryLocationId: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pilih lokasi..." /></SelectTrigger>
                  <SelectContent>
                    {locs.map((l: any) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.namaLokasi}{l.isDefault ? ' ★' : ''}{l.rayon ? ` — ${l.rayon.name}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )
          })()}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Jumlah <span className="text-destructive">*</span></Label>
              <div className="flex gap-1">
                <Input className="h-8 text-xs" type="number" min={0.001} step="any" value={form.orderedQty} onChange={e => setForm(f => ({ ...f, orderedQty: e.target.value }))} required />
                <Select value={form.uomId || 'base'} onValueChange={v => setForm(f => ({ ...f, uomId: v === 'base' ? '' : v }))}>
                  <SelectTrigger className="h-8 text-xs w-20 shrink-0"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {units.filter((u: any) => u.isActive).map((u: any) => (
                      <SelectItem key={u.id} value={u.isBase ? 'base' : u.id}>{u.abbreviation}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {(() => {
                const uom = units.find((u: any) => u.id === form.uomId)
                if (!uom || uom.isBase || !form.orderedQty) return null
                const inSak = (parseFloat(form.orderedQty) / uom.unitsPerSak).toFixed(2)
                return <p className="text-xs text-muted-foreground">= {inSak} sak</p>
              })()}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tanggal Kirim <span className="text-destructive">*</span></Label>
              <Input className="h-8 text-xs" type="date" value={form.deliveryDate} onChange={e => setForm(f => ({ ...f, deliveryDate: e.target.value }))} required />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Harga/sak <span className="text-destructive">*</span></Label>
            <Input className="h-8 text-xs" type="number" min={0} value={form.pricePerUnit} onChange={e => { setForm(f => ({ ...f, pricePerUnit: e.target.value })); setPriceHint(null) }} placeholder="0" required />
            {priceHint && <p className="text-xs text-emerald-600">Dari harga jual: {priceHint}</p>}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Catatan</Label>
            <Input className="h-8 text-xs" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Opsional..." />
          </div>
          <Button type="submit" size="sm" className="w-full h-8 text-xs" disabled={submitting || !form.customerId || !form.orderedQty || !form.pricePerUnit}>
            {submitting ? 'Menyimpan...' : 'Buat Pesanan'}
          </Button>
        </form>
      )}
    </div>
  )
}

export default function OrdersPage() {
  const today = format(new Date(), 'yyyy-MM-dd')
  const [filters, setFilters]         = useState({ date: today, status: '', channel: '', search: '', page: 1 })
  const [selectedOrder, setSelectedOrder] = useState<any>(null)
  // Ref untuk orderId dari URL (?orderId=) — di-clear setelah order ditemukan
  const pendingOrderId = useRef<string | null>(null)
  const [newOrderOpen, setNewOrderOpen]   = useState(false)
  const [newOrderForm, setNewOrderForm]   = useState({
    customerId: '', deliveryLocationId: '', orderChannel: 'PREORDER', deliveryDate: today,
    orderedQty: '', uomId: '', pricePerUnit: '', notes: '',
  })
  const [submitting, setSubmitting]       = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [priceHint, setPriceHint]         = useState<string | null>(null)

  const [draftOpen, setDraftOpen]         = useState(false)
  const [draftReviewId, setDraftReviewId] = useState<string | null>(null)

const { canWrite, isAdmin } = useRole()
  const { data, isLoading } = useOrders({ ...filters, limit: 20 })
  const { data: customers }  = useCustomers({ limit: 200 } as any)
  const { data: waDrafts, mutate: mutateDrafts } = useSWR<any[]>('/api/wa-drafts', fetcher)
  const { data: units = [] } = useSWR<any[]>('/api/units', fetcher)

  // Baca ?date= dan ?orderId= dari URL saat mount (dari klik notifikasi)
  useEffect(() => {
    const params  = new URLSearchParams(window.location.search)
    const urlDate = params.get('date')
    const urlId   = params.get('orderId')
    if (urlDate) setFilters(f => ({ ...f, date: urlDate }))
    if (urlId)   pendingOrderId.current = urlId
  }, [])

  // Auto-buka detail pesanan ketika data sudah load dan ada pendingOrderId
  useEffect(() => {
    if (!pendingOrderId.current || isLoading) return
    const orders: any[] = data?.orders ?? data ?? []
    const found = orders.find((o: any) => o.id === pendingOrderId.current)
    if (found) {
      setSelectedOrder(found)
      pendingOrderId.current = null
    }
  }, [data, isLoading])

  // Auto-set deliveryLocationId ke default location saat customer berubah
  useEffect(() => {
    const customer = (customers ?? []).find((c: any) => c.id === newOrderForm.customerId)
    const defaultLoc = customer?.locations?.find((l: any) => l.isDefault) ?? customer?.locations?.[0]
    setNewOrderForm(f => ({ ...f, deliveryLocationId: defaultLoc?.id ?? '' }))
  }, [newOrderForm.customerId, customers])

  // Auto-lookup harga dari PriceProfile (gunakan rayonId dari lokasi yang dipilih)
  useEffect(() => {
    const { customerId, deliveryLocationId, orderChannel, deliveryDate } = newOrderForm
    if (!customerId || !orderChannel || !deliveryDate) { setPriceHint(null); return }

    const customer = (customers ?? []).find((c: any) => c.id === customerId)
    if (!customer) { setPriceHint(null); return }

    // Ambil rayonId dari lokasi yang dipilih, fallback ke lokasi default
    const selectedLoc  = customer.locations?.find((l: any) => l.id === deliveryLocationId)
      ?? customer.locations?.find((l: any) => l.isDefault)
      ?? customer.locations?.[0]
    const locationRayonId = selectedLoc?.rayonId ?? null

    const params = new URLSearchParams({ customerType: customer.customerType, channel: orderChannel })

    fetch(`/api/price-profiles?${params}`)
      .then(r => r.json())
      .then(json => {
        const profiles: any[] = json.data ?? []
        const date = new Date(deliveryDate)
        const valid = profiles.filter(p =>
          new Date(p.validFrom) <= date && date <= new Date(p.validUntil)
        )
        // Prefer rayon spesifik lokasi, fallback ke null (semua rayon)
        const match = valid.find(p => p.rayonId === locationRayonId)
          ?? valid.find(p => p.rayonId === null)

        if (match) {
          setNewOrderForm(f => ({ ...f, pricePerUnit: String(match.price) }))
          setPriceHint(`Dari harga jual: Rp ${match.price.toLocaleString('id-ID')}/sak`)
        } else {
          setPriceHint('Tidak ada harga terdaftar untuk kombinasi ini')
        }
      })
      .catch(() => setPriceHint(null))
  }, [newOrderForm.customerId, newOrderForm.deliveryLocationId, newOrderForm.orderChannel, newOrderForm.deliveryDate, customers])

  const selectedOrderDetail  = useSWR(selectedOrder ? `/api/orders/${selectedOrder.id}` : null, fetcher)

  const setFilter = (key: string, value: string) =>
    setFilters(f => ({ ...f, [key]: value, page: 1 }))

  // ── Submit new order ──────────────────────────────────────────────────────
  async function submitNewOrder(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newOrderForm,
          deliveryLocationId: newOrderForm.deliveryLocationId || undefined,
          uomId:        newOrderForm.uomId || undefined,
          orderedQty:   Number(newOrderForm.orderedQty),
          pricePerUnit: Number(newOrderForm.pricePerUnit),
        }),
      })
      if (res.ok) {
        setNewOrderOpen(false)
        globalMutate(key => typeof key === 'string' && key.startsWith('/api/orders'))
        setNewOrderForm({ customerId: '', deliveryLocationId: '', orderChannel: 'PREORDER', deliveryDate: today, orderedQty: '', uomId: '', pricePerUnit: '', notes: '' })
        setPriceHint(null)
        toast({ title: 'Pesanan berhasil dibuat', variant: 'success' })
      } else {
        const err = await res.json().catch(() => ({}))
        toast({ title: 'Gagal membuat pesanan', description: err.message, variant: 'destructive' })
      }
    } finally {
      setSubmitting(false)
    }
  }

  // ── Update order status ───────────────────────────────────────────────────
  async function updateOrderStatus(id: string, status: string) {
    setActionLoading(true)
    try {
      const res  = await fetch(`/api/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast({ title: 'Gagal mengubah status', description: json.message, variant: 'destructive' })
        return
      }
      globalMutate(key => typeof key === 'string' && key.startsWith('/api/orders'))
      selectedOrderDetail.mutate()
      toast({ title: `Pesanan ${status === 'CONFIRMED' ? 'dikonfirmasi' : 'dibatalkan'}` })
    } finally {
      setActionLoading(false)
    }
  }

  // ── Draft WA ──────────────────────────────────────────────────────────────
  async function publishDraft(draft: any, form: { customerId: string; deliveryLocationId: string; orderedQty: string; uomId: string; deliveryDate: string; pricePerUnit: string; notes: string }) {
    const orderRes = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId:         form.customerId,
        deliveryLocationId: form.deliveryLocationId || undefined,
        orderChannel:       'HOTLINE',
        deliveryDate:       form.deliveryDate,
        orderedQty:         Number(form.orderedQty),
        uomId:              form.uomId || undefined,
        pricePerUnit:       Number(form.pricePerUnit),
        notes:              form.notes || undefined,
      }),
    })
    if (!orderRes.ok) {
      const err = await orderRes.json().catch(() => ({}))
      toast({ title: 'Gagal membuat pesanan', description: err.message, variant: 'destructive' })
      return
    }
    await fetch(`/api/wa-drafts/${draft.id}`, { method: 'DELETE' })
    mutateDrafts()
    globalMutate(key => typeof key === 'string' && key.startsWith('/api/orders'))
    setDraftReviewId(null)
    toast({ title: 'Pesanan berhasil dibuat dari draft', variant: 'success' })
  }

  async function deleteDraft(id: string) {
    await fetch(`/api/wa-drafts/${id}`, { method: 'DELETE' })
    mutateDrafts()
    toast({ title: 'Draft dihapus' })
  }

  // ── CSV Export ────────────────────────────────────────────────────────────
  function exportCSV() {
    const orders = data?.orders ?? data ?? []
    if (!orders.length) {
      toast({ title: 'Tidak ada data untuk diekspor', variant: 'warning' as any })
      return
    }
    const rows = orders.map((o: any) => ({
      'No. Pesanan':       o.orderNumber,
      'Pelanggan':         o.customer?.name ?? '-',
      'Tipe Pelanggan':    o.customer?.customerType ?? '-',
      'Lokasi Pengiriman': o.deliveryLocation?.namaLokasi ?? '-',
      'Rayon':             o.rayon?.name ?? '-',
      'Channel':        o.orderChannel,
      'Tanggal Kirim':  o.deliveryDate ? format(new Date(o.deliveryDate), 'dd/MM/yyyy') : '-',
      'Qty Dipesan':    o.orderedQty,
      'Qty Terkirim':   o.deliveredQty ?? 0,
      'Qty Retur':      o.returnedQty ?? 0,
      'Harga/sak':      o.pricePerUnit,
      'Nilai Total':    (o.deliveredQty ?? 0) * o.pricePerUnit,
      'Status':         o.status,
    }))
    const csv  = Papa.unparse(rows)
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = Object.assign(document.createElement('a'), {
      href: url,
      download: `pesanan-${filters.date}.csv`,
    })
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: `${rows.length} pesanan diekspor ke CSV`, variant: 'success' })
  }

  const orders = data?.orders ?? data ?? []
  const meta   = data?.meta

  return (
    <div>
      <PageHeader
        title="Pesanan"
        description="Kelola semua pesanan pengiriman es kristal"
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCSV}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
            {canWrite && (waDrafts?.length ?? 0) > 0 && (
              <Button variant="outline" size="sm" className="gap-1.5 relative" onClick={() => setDraftOpen(true)}>
                <Inbox className="h-4 w-4" />
                Draft WA
                <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {waDrafts!.length}
                </span>
              </Button>
            )}
            {canWrite && (
              <Dialog open={newOrderOpen} onOpenChange={setNewOrderOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1.5">
                    <Plus className="h-4 w-4" /> Pesanan Baru
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Buat Pesanan Baru</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={submitNewOrder} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label>Pelanggan <span className="text-destructive">*</span></Label>
                      <Select value={newOrderForm.customerId} onValueChange={v => setNewOrderForm(f => ({ ...f, customerId: v }))}>
                        <SelectTrigger><SelectValue placeholder="Pilih pelanggan..." /></SelectTrigger>
                        <SelectContent>
                          {(customers ?? []).map((c: any) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {/* Location picker — selalu tampil saat customer dipilih */}
                    {(() => {
                      const selectedCustomer = (customers ?? []).find((c: any) => c.id === newOrderForm.customerId)
                      const locs: any[] = selectedCustomer?.locations ?? []
                      if (!newOrderForm.customerId || locs.length === 0) return null
                      return (
                        <div className="space-y-1.5">
                          <Label>Lokasi Pengiriman <span className="text-destructive">*</span></Label>
                          <Select value={newOrderForm.deliveryLocationId}
                            onValueChange={v => setNewOrderForm(f => ({ ...f, deliveryLocationId: v }))}>
                            <SelectTrigger><SelectValue placeholder="Pilih lokasi..." /></SelectTrigger>
                            <SelectContent>
                              {locs.map((l: any) => (
                                <SelectItem key={l.id} value={l.id}>
                                  {l.namaLokasi}{l.isDefault ? ' ★' : ''}{l.rayon ? ` — ${l.rayon.name}` : ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )
                    })()}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Channel <span className="text-destructive">*</span></Label>
                        <Select value={newOrderForm.orderChannel} onValueChange={v => setNewOrderForm(f => ({ ...f, orderChannel: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {CHANNEL_OPTIONS.map(c => <SelectItem key={c} value={c}>{CHANNEL_LABELS[c] ?? c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Tanggal Kirim <span className="text-destructive">*</span></Label>
                        <Input type="date" value={newOrderForm.deliveryDate} onChange={e => setNewOrderForm(f => ({ ...f, deliveryDate: e.target.value }))} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Jumlah <span className="text-destructive">*</span></Label>
                        <div className="flex gap-1.5">
                          <Input type="number" min={0.001} step="any" value={newOrderForm.orderedQty} onChange={e => setNewOrderForm(f => ({ ...f, orderedQty: e.target.value }))} required className="flex-1" />
                          <Select value={newOrderForm.uomId || 'base'} onValueChange={v => setNewOrderForm(f => ({ ...f, uomId: v === 'base' ? '' : v }))}>
                            <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {(units as any[]).filter((u: any) => u.isActive).map((u: any) => (
                                <SelectItem key={u.id} value={u.isBase ? 'base' : u.id}>{u.abbreviation}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {(() => {
                          const uom = (units as any[]).find((u: any) => u.id === newOrderForm.uomId)
                          if (!uom || uom.isBase || !newOrderForm.orderedQty) return null
                          const inSak = (parseFloat(newOrderForm.orderedQty) / uom.unitsPerSak).toFixed(2)
                          return <p className="text-xs text-muted-foreground">= {inSak} sak</p>
                        })()}
                      </div>
                      <div className="space-y-1.5">
                        <Label>Harga/sak (Rp) <span className="text-destructive">*</span></Label>
                        <Input type="number" min={0} value={newOrderForm.pricePerUnit} onChange={e => { setNewOrderForm(f => ({ ...f, pricePerUnit: e.target.value })); setPriceHint(null) }} required />
                        {priceHint && (
                          <p className={`text-xs ${priceHint.startsWith('Tidak') ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {priceHint}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Catatan <span className="text-muted-foreground text-xs">(opsional)</span></Label>
                      <Textarea value={newOrderForm.notes} onChange={e => setNewOrderForm(f => ({ ...f, notes: e.target.value }))} placeholder="Opsional..." rows={2} />
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setNewOrderOpen(false)}>Batal</Button>
                      <Button type="submit" disabled={submitting}>{submitting ? 'Menyimpan...' : 'Simpan'}</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        }
      />

      <Tabs defaultValue="orders">
        <TabsList className="mb-4">
          <TabsTrigger value="orders" className="gap-2">
            <Truck className="h-4 w-4" /> Pesanan
          </TabsTrigger>
          <TabsTrigger value="log" className="gap-2">
            <History className="h-4 w-4" /> Log Aktivitas
          </TabsTrigger>
        </TabsList>

        {/* ══ TAB: PESANAN ═══════════════════════════════════════════════════ */}
        <TabsContent value="orders">

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Tanggal</Label>
              <Input type="date" value={filters.date} onChange={e => setFilter('date', e.target.value)} className="w-36 h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={filters.status || 'all'} onValueChange={v => setFilter('status', v === 'all' ? '' : v)}>
                <SelectTrigger className="w-36 h-8 text-sm"><SelectValue placeholder="Semua" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{STATUS_LABELS[s] ?? s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Channel</Label>
              <Select value={filters.channel || 'all'} onValueChange={v => setFilter('channel', v === 'all' ? '' : v)}>
                <SelectTrigger className="w-36 h-8 text-sm"><SelectValue placeholder="Semua" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  {CHANNEL_OPTIONS.map(c => <SelectItem key={c} value={c}>{CHANNEL_LABELS[c] ?? c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 flex-1 min-w-[160px]">
              <Label className="text-xs">Cari</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={filters.search}
                  onChange={e => setFilter('search', e.target.value)}
                  placeholder="Nama pelanggan..."
                  className="h-8 text-sm pl-8"
                />
              </div>
            </div>
            {(filters.status || filters.channel || filters.search) && (
              <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs"
                onClick={() => setFilters(f => ({ ...f, status: '', channel: '', search: '' }))}>
                <X className="h-3 w-3" /> Reset
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6"><LoadingState rows={6} /></div>
          ) : orders.length === 0 ? (
            <EmptyState title="Tidak ada pesanan" description="Tidak ada pesanan yang sesuai filter." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No. Pesanan</TableHead>
                  <TableHead>Pelanggan</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Tanggal Kirim</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Nilai</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order: any) => (
                  <TableRow key={order.id} className="cursor-pointer" onClick={() => setSelectedOrder(order)}>
                    <TableCell className="font-mono text-xs">{order.orderNumber}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{order.customer?.name ?? '-'}</p>
                        {order.deliveryLocation && (
                          <p className="text-xs text-muted-foreground">{order.deliveryLocation.namaLokasi}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell><ChannelTag channel={order.orderChannel} /></TableCell>
                    <TableCell className="text-sm">{order.deliveryDate ? format(new Date(order.deliveryDate), 'dd/MM/yyyy') : '-'}</TableCell>
                    <TableCell className="text-right text-sm">
                      {order.orderedQty} <span className="text-muted-foreground text-xs">{order.uom?.abbreviation ?? 'sak'}</span>
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {(() => {
                        const ups = order.uom?.unitsPerSak ?? 1
                        if (['DELIVERED', 'PARTIAL'].includes(order.status))
                          return formatCurrency(((order.deliveredQty ?? 0) / ups) * order.pricePerUnit)
                        return formatCurrency((order.orderedQty / ups) * order.pricePerUnit)
                      })()}
                    </TableCell>
                    <TableCell><StatusBadge status={order.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
          <span>Halaman {meta.page} dari {meta.totalPages} ({meta.total} pesanan)</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={filters.page <= 1}
              onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}>Sebelumnya</Button>
            <Button variant="outline" size="sm" disabled={filters.page >= meta.totalPages}
              onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}>Berikutnya</Button>
          </div>
        </div>
      )}

      {/* Draft WA Queue */}
      <Dialog open={draftOpen} onOpenChange={setDraftOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Antrian Draft WA</DialogTitle>
          </DialogHeader>
          {(waDrafts ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Tidak ada draft.</p>
          ) : (
            <div className="space-y-3">
              {(waDrafts ?? []).map((draft: any) => (
                <DraftCard
                  key={draft.id}
                  draft={draft}
                  customers={customers ?? []}
                  units={units}
                  today={today}
                  onPublish={publishDraft}
                  onDelete={() => deleteDraft(draft.id)}
                  isReviewing={draftReviewId === draft.id}
                  onReview={() => setDraftReviewId(draftReviewId === draft.id ? null : draft.id)}
                />
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

        </TabsContent>{/* end "orders" tab */}

        {/* ══ TAB: LOG AKTIVITAS ════════════════════════════════════════════ */}
        <TabsContent value="log">
          <OrderActivityLog date={filters.date} onDateChange={d => setFilter('date', d)} />
        </TabsContent>

      </Tabs>{/* end Tabs */}

      {/* Detail Sheet */}
      <Sheet open={!!selectedOrder} onOpenChange={open => !open && setSelectedOrder(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Detail Pesanan</SheetTitle>
          </SheetHeader>
          {selectedOrderDetail.isLoading ? (
            <div className="mt-6"><LoadingState rows={4} /></div>
          ) : selectedOrderDetail.data ? (
            <div className="mt-6 space-y-4">
              {(() => {
                const o = selectedOrderDetail.data
                return (
                  <>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-mono text-xs text-muted-foreground">{o.orderNumber}</p>
                        <p className="font-semibold text-lg mt-0.5">{o.customer?.name}</p>
                        <p className="text-sm text-muted-foreground">{o.customer?.customerType} — {o.rayon?.name ?? 'No Rayon'}</p>
                        {o.deliveryLocation && (
                          <p className="text-xs text-muted-foreground mt-0.5">📍 {o.deliveryLocation.namaLokasi}{o.deliveryLocation.alamat ? ` · ${o.deliveryLocation.alamat}` : ''}</p>
                        )}
                      </div>
                      <StatusBadge status={o.status} />
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><p className="text-muted-foreground text-xs">Channel</p><ChannelTag channel={o.orderChannel} /></div>
                      <div><p className="text-muted-foreground text-xs">Tanggal Kirim</p><p className="font-medium">{o.deliveryDate ? format(new Date(o.deliveryDate), 'dd/MM/yyyy') : '-'}</p></div>
                      <div><p className="text-muted-foreground text-xs">Qty Dipesan</p><p className="font-semibold">{o.orderedQty} {o.uom?.abbreviation ?? 'sak'}</p></div>
                      <div><p className="text-muted-foreground text-xs">Harga/sak</p><p className="font-medium">{formatCurrency(o.pricePerUnit)}</p></div>
                      <div><p className="text-muted-foreground text-xs">Terkirim</p><p className="font-semibold text-emerald-600">{o.deliveredQty ?? 0} {o.uom?.abbreviation ?? 'sak'}</p></div>
                      <div><p className="text-muted-foreground text-xs">Dikembalikan</p><p className="font-semibold text-destructive">{o.returnedQty ?? 0} {o.uom?.abbreviation ?? 'sak'}</p></div>
                    </div>
                    <div className="rounded-lg bg-muted p-3 grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Nilai Pesanan</p>
                        <p className="text-lg font-bold">{formatCurrency((o.orderedQty / (o.uom?.unitsPerSak ?? 1)) * o.pricePerUnit)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Nilai Terkirim</p>
                        <p className="text-lg font-bold text-emerald-600">{formatCurrency(((o.deliveredQty ?? 0) / (o.uom?.unitsPerSak ?? 1)) * o.pricePerUnit)}</p>
                      </div>
                    </div>
                    {o.notes && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Catatan</p>
                        <p className="text-sm">{o.notes}</p>
                      </div>
                    )}
                    {o.deliveryLogs?.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Log Pengiriman</p>
                        <div className="space-y-2">
                          {o.deliveryLogs.map((log: any) => (
                            <div key={log.id} className="rounded border p-3 text-xs">
                              <div className="flex justify-between">
                                <span>{log.driver?.name ?? '-'}</span>
                                <span className="text-muted-foreground">{log.timestamp ? format(new Date(log.timestamp), 'dd/MM HH:mm') : '-'}</span>
                              </div>
                              <p className="mt-1">Terkirim: <span className="font-medium">{log.deliveredQty} sak</span> | Retur: <span className="font-medium">{log.returnedQty} sak</span></p>
                              {log.returnReason && <p className="text-muted-foreground mt-0.5">Alasan: {log.returnReason}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Aksi */}
                    {(() => {
                      const finalStatuses = ['DELIVERED', 'RETURNED', 'CANCELLED', 'REJECTED']
                      const isFinal = finalStatuses.includes(o.status)
                      if (isFinal) return null
                      return (
                        <div className="border-t pt-4 space-y-2">
                          {['CONFIRMED', 'ASSIGNED', 'LOADED', 'PARTIAL'].includes(o.status) && (
                            <p className="text-xs text-muted-foreground text-center">
                              Pencatatan pengiriman dilakukan di menu <span className="font-medium">Pengiriman</span>.
                            </p>
                          )}
                          <div className="flex gap-2">
                          {o.status === 'CREATED' && canWrite && (
                            <Button
                              size="sm" className="flex-1"
                              disabled={actionLoading}
                              onClick={() => {
                                if (confirm('Konfirmasi pesanan ini?')) updateOrderStatus(o.id, 'CONFIRMED')
                              }}
                            >
                              Konfirmasi
                            </Button>
                          )}
                          {canWrite && (
                            <Button
                              size="sm" variant="outline" className="flex-1 text-destructive border-destructive hover:bg-destructive hover:text-white"
                              disabled={actionLoading}
                              onClick={() => {
                                if (confirm('Batalkan pesanan ini?')) updateOrderStatus(o.id, 'CANCELLED')
                              }}
                            >
                              Batalkan
                            </Button>
                          )}
                          </div>
                        </div>
                      )
                    })()}
                  </>
                )
              })()}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}

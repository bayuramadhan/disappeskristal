'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Plus, Search, X, Download } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency } from '@/lib/utils'
import useSWR, { mutate as globalMutate } from 'swr'
import { fetcher } from '@/lib/fetcher'

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

export default function OrdersPage() {
  const today = format(new Date(), 'yyyy-MM-dd')
  const [filters, setFilters]         = useState({ date: today, status: '', channel: '', search: '', page: 1 })
  const [selectedOrder, setSelectedOrder] = useState<any>(null)
  const [newOrderOpen, setNewOrderOpen]   = useState(false)
  const [newOrderForm, setNewOrderForm]   = useState({
    customerId: '', orderChannel: 'PREORDER', deliveryDate: today,
    orderedQty: '', pricePerUnit: '', notes: '',
  })
  const [submitting, setSubmitting]       = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [priceHint, setPriceHint]         = useState<string | null>(null)

  // Delivery log form
  const [deliveryOpen, setDeliveryOpen]   = useState(false)
  const [deliveryTarget, setDeliveryTarget] = useState<any>(null)
  const [deliveryForm, setDeliveryForm]   = useState({ vehicleId: '', driverId: '', deliveredQty: '', returnedQty: '0', returnReason: '' })
  const [deliveryLoading, setDeliveryLoading] = useState(false)

  const { canWrite, isAdmin } = useRole()
  const { data, isLoading } = useOrders({ ...filters, limit: 20 })
  const { data: customers }  = useCustomers({ limit: 200 } as any)

  // Auto-lookup harga dari PriceProfile
  useEffect(() => {
    const { customerId, orderChannel, deliveryDate } = newOrderForm
    if (!customerId || !orderChannel || !deliveryDate) { setPriceHint(null); return }

    const customer = (customers ?? []).find((c: any) => c.id === customerId)
    if (!customer) { setPriceHint(null); return }

    const params = new URLSearchParams({ customerType: customer.customerType, channel: orderChannel })

    fetch(`/api/price-profiles?${params}`)
      .then(r => r.json())
      .then(json => {
        const profiles: any[] = json.data ?? []
        const date = new Date(deliveryDate)

        // Filter yang berlaku di tanggal pengiriman
        const valid = profiles.filter(p =>
          new Date(p.validFrom) <= date && date <= new Date(p.validUntil)
        )

        // Prefer rayon spesifik, fallback ke null (semua rayon)
        const match = valid.find(p => p.rayonId === customer.rayonId)
          ?? valid.find(p => p.rayonId === null)

        if (match) {
          setNewOrderForm(f => ({ ...f, pricePerUnit: String(match.price) }))
          setPriceHint(`Dari harga jual: Rp ${match.price.toLocaleString('id-ID')}/sak`)
        } else {
          setPriceHint('Tidak ada harga terdaftar untuk kombinasi ini')
        }
      })
      .catch(() => setPriceHint(null))
  }, [newOrderForm.customerId, newOrderForm.orderChannel, newOrderForm.deliveryDate, customers])
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
          orderedQty:   Number(newOrderForm.orderedQty),
          pricePerUnit: Number(newOrderForm.pricePerUnit),
        }),
      })
      if (res.ok) {
        setNewOrderOpen(false)
        globalMutate(key => typeof key === 'string' && key.startsWith('/api/orders'))
        setNewOrderForm({ customerId: '', orderChannel: 'PREORDER', deliveryDate: today, orderedQty: '', pricePerUnit: '', notes: '' })
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

  // ── Armada aktif hari ini (untuk form delivery log) ──────────────────────
  const { data: activeFleet } = useSWR(
    deliveryOpen ? `/api/fleet?date=${filters.date}` : null,
    fetcher,
  )

  // ── Submit delivery log ───────────────────────────────────────────────────
  async function submitDeliveryLog(e: React.FormEvent) {
    e.preventDefault()
    if (!deliveryTarget) return
    setDeliveryLoading(true)
    try {
      const res = await fetch('/api/delivery-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId:      deliveryTarget.id,
          vehicleId:    deliveryForm.vehicleId,
          driverId:     deliveryForm.driverId,
          deliveredQty: Number(deliveryForm.deliveredQty),
          returnedQty:  Number(deliveryForm.returnedQty),
          returnReason: deliveryForm.returnReason || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast({ title: 'Gagal mencatat pengiriman', description: json.message, variant: 'destructive' })
        return
      }
      setDeliveryOpen(false)
      globalMutate(key => typeof key === 'string' && key.startsWith('/api/orders'))
      selectedOrderDetail.mutate()
      toast({ title: 'Pengiriman tercatat', description: `Status diperbarui ke ${json.data?.orderStatusUpdatedTo ?? ''}` })
    } finally {
      setDeliveryLoading(false)
    }
  }

  // ── CSV Export ────────────────────────────────────────────────────────────
  function exportCSV() {
    const orders = data?.orders ?? data ?? []
    if (!orders.length) {
      toast({ title: 'Tidak ada data untuk diekspor', variant: 'warning' as any })
      return
    }
    const rows = orders.map((o: any) => ({
      'No. Pesanan':    o.orderNumber,
      'Pelanggan':      o.customer?.name ?? '-',
      'Tipe Pelanggan': o.customer?.customerType ?? '-',
      'Rayon':          o.rayon?.name ?? '-',
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
                        <Label>Qty (sak) <span className="text-destructive">*</span></Label>
                        <Input type="number" min={1} value={newOrderForm.orderedQty} onChange={e => setNewOrderForm(f => ({ ...f, orderedQty: e.target.value }))} required />
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
                  <TableHead className="text-right">Qty (sak)</TableHead>
                  <TableHead className="text-right">Nilai Pesanan</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order: any) => (
                  <TableRow key={order.id} className="cursor-pointer" onClick={() => setSelectedOrder(order)}>
                    <TableCell className="font-mono text-xs">{order.orderNumber}</TableCell>
                    <TableCell className="font-medium text-sm">{order.customer?.name ?? '-'}</TableCell>
                    <TableCell><ChannelTag channel={order.orderChannel} /></TableCell>
                    <TableCell className="text-sm">{order.deliveryDate ? format(new Date(order.deliveryDate), 'dd/MM/yyyy') : '-'}</TableCell>
                    <TableCell className="text-right text-sm">{order.orderedQty}</TableCell>
                    <TableCell className="text-right text-sm">{formatCurrency(order.orderedQty * order.pricePerUnit)}</TableCell>
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

      {/* Dialog Catat Pengiriman */}
      <Dialog open={deliveryOpen} onOpenChange={setDeliveryOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{deliveryTarget?.status === 'PARTIAL' ? 'Catat Pengiriman Lanjutan' : 'Catat Pengiriman'}</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {deliveryTarget?.customer?.name} — {deliveryTarget?.orderedQty} sak dipesan
              {deliveryTarget?.status === 'PARTIAL' && (
                <span className="text-amber-600 ml-1">(sisa {deliveryTarget.orderedQty - (deliveryTarget.deliveredQty ?? 0)} sak belum terkirim)</span>
              )}
            </p>
          </DialogHeader>
          <form onSubmit={submitDeliveryLog} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Armada <span className="text-destructive">*</span></Label>
              {(() => {
                const matchedFleet = (activeFleet ?? []).filter((f: any) =>
                  !deliveryTarget?.rayonId || f.rayonId === deliveryTarget.rayonId
                )
                return (
                  <>
                    <Select value={deliveryForm.vehicleId} onValueChange={v => {
                      const fleet = (activeFleet ?? []).find((f: any) => f.vehicleId === v)
                      setDeliveryForm(f => ({ ...f, vehicleId: v, driverId: fleet?.driverId ?? '' }))
                    }}>
                      <SelectTrigger><SelectValue placeholder="Pilih kendaraan aktif..." /></SelectTrigger>
                      <SelectContent>
                        {matchedFleet.map((f: any) => (
                          <SelectItem key={f.vehicleId} value={f.vehicleId}>
                            {f.vehicle?.plateNumber} — {f.driver?.name} (sisa {f.remainingLoad} sak)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {deliveryForm.vehicleId && (() => {
                      const sel = (activeFleet ?? []).find((f: any) => f.vehicleId === deliveryForm.vehicleId)
                      return sel ? (
                        <p className="text-xs text-muted-foreground">Sisa muatan: <span className="font-medium">{sel.remainingLoad} sak</span></p>
                      ) : null
                    })()}
                    {matchedFleet.length === 0 && (
                      <p className="text-xs text-amber-600">
                        Tidak ada armada aktif untuk rayon ini hari ini
                      </p>
                    )}
                  </>
                )
              })()}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Terkirim (sak) <span className="text-destructive">*</span></Label>
                <Input
                  type="number" min={0}
                  max={Math.min(
                    deliveryTarget?.orderedQty ?? Infinity,
                    (activeFleet ?? []).find((f: any) => f.vehicleId === deliveryForm.vehicleId)?.remainingLoad ?? Infinity,
                  )}
                  value={deliveryForm.deliveredQty}
                  onChange={e => setDeliveryForm(f => ({ ...f, deliveredQty: e.target.value }))}
                  placeholder="0" required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Retur (sak)</Label>
                <Input
                  type="number" min={0}
                  value={deliveryForm.returnedQty}
                  onChange={e => setDeliveryForm(f => ({ ...f, returnedQty: e.target.value }))}
                  placeholder="0"
                />
              </div>
            </div>
            {Number(deliveryForm.returnedQty) > 0 && (
              <div className="space-y-1.5">
                <Label>Alasan Retur <span className="text-muted-foreground text-xs">(opsional)</span></Label>
                <Select value={deliveryForm.returnReason} onValueChange={v => setDeliveryForm(f => ({ ...f, returnReason: v }))}>
                  <SelectTrigger><SelectValue placeholder="Pilih alasan..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WEATHER">Cuaca</SelectItem>
                    <SelectItem value="CUSTOMER_CLOSED">Pelanggan tutup</SelectItem>
                    <SelectItem value="ALREADY_BOUGHT">Sudah beli di tempat lain</SelectItem>
                    <SelectItem value="LATE_DELIVERY">Pengiriman terlambat</SelectItem>
                    <SelectItem value="REDUCED_NEED">Kebutuhan berkurang</SelectItem>
                    <SelectItem value="OTHER">Lainnya</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDeliveryOpen(false)}>Batal</Button>
              <Button type="submit" disabled={deliveryLoading || !deliveryForm.vehicleId || deliveryForm.deliveredQty === ''}>
                {deliveryLoading ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
                      </div>
                      <StatusBadge status={o.status} />
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><p className="text-muted-foreground text-xs">Channel</p><ChannelTag channel={o.orderChannel} /></div>
                      <div><p className="text-muted-foreground text-xs">Tanggal Kirim</p><p className="font-medium">{o.deliveryDate ? format(new Date(o.deliveryDate), 'dd/MM/yyyy') : '-'}</p></div>
                      <div><p className="text-muted-foreground text-xs">Qty Dipesan</p><p className="font-semibold">{o.orderedQty} sak</p></div>
                      <div><p className="text-muted-foreground text-xs">Harga/sak</p><p className="font-medium">{formatCurrency(o.pricePerUnit)}</p></div>
                      <div><p className="text-muted-foreground text-xs">Terkirim</p><p className="font-semibold text-emerald-600">{o.deliveredQty ?? 0} sak</p></div>
                      <div><p className="text-muted-foreground text-xs">Dikembalikan</p><p className="font-semibold text-destructive">{o.returnedQty ?? 0} sak</p></div>
                    </div>
                    <div className="rounded-lg bg-muted p-3 grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Nilai Pesanan</p>
                        <p className="text-lg font-bold">{formatCurrency(o.orderedQty * o.pricePerUnit)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Nilai Terkirim</p>
                        <p className="text-lg font-bold text-emerald-600">{formatCurrency((o.deliveredQty ?? 0) * o.pricePerUnit)}</p>
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
                          {['CONFIRMED', 'ASSIGNED', 'LOADED', 'PARTIAL'].includes(o.status) && canWrite && (
                            <Button
                              size="sm" className="w-full"
                              onClick={() => {
                                const sisaQty = o.orderedQty - (o.deliveredQty ?? 0)
                                setDeliveryTarget(o)
                                setDeliveryForm({
                                  vehicleId: o.vehicleId ?? '',
                                  driverId: '',
                                  deliveredQty: String(sisaQty > 0 ? sisaQty : o.orderedQty),
                                  returnedQty: '0',
                                  returnReason: '',
                                })
                                setDeliveryOpen(true)
                              }}
                            >
                              {o.status === 'PARTIAL' ? 'Catat Pengiriman Lanjutan' : 'Catat Pengiriman'}
                            </Button>
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

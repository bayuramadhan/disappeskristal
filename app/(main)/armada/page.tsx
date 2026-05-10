'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import {
  Truck, User, Package, Clock, Plus, X, Settings2, CheckCircle2,
  Navigation2, LogIn, LogOut, ClipboardCheck, Wrench,
  ListOrdered, ChevronDown, ChevronUp, AlertCircle,
} from 'lucide-react'
import useSWR from 'swr'
import { fetcher } from '@/lib/fetcher'
import { toSak } from '@/lib/uom'

// Konversi qty pesanan ke sak, dibulatkan ke atas
function qtyInSak(qty: number, unitsPerSak?: number | null): number {
  return Math.ceil(toSak(qty, unitsPerSak))
}
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingCards, LoadingState } from '@/components/shared/LoadingState'
import { EmptyState } from '@/components/shared/EmptyState'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useRole } from '@/hooks/useRole'
import { useToast } from '@/hooks/use-toast'
import { useRayons } from '@/hooks/useCustomers'
import { formatCurrency } from '@/lib/utils'

// ─── OrderQueuePanel: daftar pesanan hari ini sebagai acuan assign ───────────
function OrderQueuePanel({ date, onRefreshFleet }: { date: string; onRefreshFleet: () => void }) {
  const [open, setOpen] = useState(false)

  const { data, isLoading, mutate } = useSWR(
    open ? `/api/orders?date=${date}&limit=200&status=CONFIRMED,ASSIGNED,PARTIAL` : null,
    fetcher,
  )

  const orders: any[] = (data?.orders ?? data ?? [])
    .slice()
    .sort((a: any, b: any) => {
      // Urutkan: belum dialokasikan → sebagian → sudah penuh
      const remA = a.remainingQty ?? a.orderedQty
      const remB = b.remainingQty ?? b.orderedQty
      const pctA = (a.orderedQty - remA) / (a.orderedQty || 1)
      const pctB = (b.orderedQty - remB) / (b.orderedQty || 1)
      return pctA - pctB      // asc: belum dialokasikan muncul duluan
    })

  // Hitung ringkasan untuk badge di header
  const totalOrders     = orders.length
  const belumAssign     = orders.filter((o: any) => (o.remainingQty ?? o.orderedQty) >= o.orderedQty).length
  const sebagianAssign  = orders.filter((o: any) => {
    const rem = o.remainingQty ?? o.orderedQty
    return rem > 0 && rem < o.orderedQty
  }).length

  // Fetch tanpa SWR untuk refresh saat open berubah
  useEffect(() => { if (open) mutate() }, [date])  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mb-4 rounded-lg border bg-card shadow-sm">
      {/* Header toggle */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors rounded-lg"
        onClick={() => setOpen(v => !v)}
      >
        <ListOrdered className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex-1 flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">Antrian Pesanan Hari Ini</span>
          {!open && belumAssign > 0 && (
            <span className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
              <AlertCircle className="h-3 w-3" />
              {belumAssign} belum diassign
            </span>
          )}
          {!open && sebagianAssign > 0 && (
            <span className="text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full font-medium">
              {sebagianAssign} sebagian
            </span>
          )}
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        }
      </button>

      {/* Panel isi */}
      {open && (
        <div className="border-t">
          {isLoading ? (
            <div className="px-4 py-3"><LoadingState rows={3} /></div>
          ) : orders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Tidak ada pesanan terkonfirmasi untuk tanggal ini.
            </p>
          ) : (
            <>
              {/* Ringkasan singkat */}
              <div className="flex gap-4 px-4 py-2.5 border-b bg-muted/30 text-xs text-muted-foreground flex-wrap">
                <span>{totalOrders} pesanan total</span>
                {belumAssign > 0 && (
                  <span className="text-amber-700 font-medium flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />{belumAssign} belum diassign
                  </span>
                )}
                {sebagianAssign > 0 && (
                  <span className="text-sky-700 font-medium">{sebagianAssign} sebagian teralokasi</span>
                )}
                {(totalOrders - belumAssign - sebagianAssign) > 0 && (
                  <span className="text-emerald-700 font-medium">{totalOrders - belumAssign - sebagianAssign} sudah penuh</span>
                )}
              </div>

              {/* Tabel pesanan */}
              <div className="overflow-x-auto max-h-72 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/60 text-xs text-muted-foreground">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">Pelanggan</th>
                      <th className="text-left px-4 py-2 font-medium hidden sm:table-cell">Rayon</th>
                      <th className="text-right px-4 py-2 font-medium">Dipesan</th>
                      <th className="text-right px-4 py-2 font-medium hidden sm:table-cell">Teralokasi</th>
                      <th className="px-4 py-2 font-medium w-28">Alokasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {orders.map((o: any) => {
                      const totalAllocated = o.totalAllocated ?? 0
                      const remaining      = o.remainingQty ?? (o.orderedQty - totalAllocated)
                      const pct            = o.orderedQty > 0 ? Math.round((totalAllocated / o.orderedQty) * 100) : 0
                      const isUnassigned   = totalAllocated === 0
                      const isPartial      = totalAllocated > 0 && totalAllocated < o.orderedQty
                      const isFull         = totalAllocated >= o.orderedQty

                      return (
                        <tr key={o.id} className="hover:bg-muted/20">
                          <td className="px-4 py-2.5">
                            <p className="font-medium leading-snug">{o.customer?.name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{o.orderNumber}</p>
                          </td>
                          <td className="px-4 py-2.5 hidden sm:table-cell">
                            <span className="text-xs text-muted-foreground">{o.rayon?.name ?? o.deliveryLocation?.namaLokasi ?? '—'}</span>
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                            {qtyInSak(o.orderedQty, o.uom?.unitsPerSak)} sak
                          </td>
                          <td className="px-4 py-2.5 text-right hidden sm:table-cell tabular-nums">
                            {isUnassigned ? (
                              <span className="text-muted-foreground text-xs">—</span>
                            ) : (
                              <span className={isPartial ? 'text-amber-700' : 'text-emerald-700'}>
                                {totalAllocated} / {qtyInSak(o.orderedQty, o.uom?.unitsPerSak)} sak
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      isFull    ? 'bg-emerald-500' :
                                      isPartial ? 'bg-amber-500'   : 'bg-muted-foreground/30'
                                    }`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className={`text-xs font-medium tabular-nums w-8 text-right ${
                                  isFull    ? 'text-emerald-700' :
                                  isPartial ? 'text-amber-700'   : 'text-muted-foreground'
                                }`}>
                                  {pct}%
                                </span>
                              </div>
                              {!isFull && remaining > 0 && (
                                <p className="text-xs text-muted-foreground">sisa {qtyInSak(remaining, o.uom?.unitsPerSak)} sak</p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── ActivityLog: audit trail semua aksi operator di menu Pengiriman ────────
const ACTION_CONFIG: Record<string, {
  label: string; color: string; bg: string; icon: React.ReactNode
}> = {
  ORDER_ASSIGNED:   { label: 'Masukkan Pesanan', color: 'text-sky-700',     bg: 'bg-sky-50 border-sky-200',     icon: <LogIn className="h-4 w-4 text-sky-600" /> },
  ORDER_UNASSIGNED: { label: 'Keluarkan Pesanan', color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200', icon: <LogOut className="h-4 w-4 text-amber-600" /> },
  DELIVERY_LOGGED:  { label: 'Catat Pengiriman',  color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: <ClipboardCheck className="h-4 w-4 text-emerald-600" /> },
  FLEET_UPDATED:    { label: 'Ubah Data Armada',  color: 'text-violet-700', bg: 'bg-violet-50 border-violet-200', icon: <Wrench className="h-4 w-4 text-violet-600" /> },
}

const CHANGE_LABELS: Record<string, string> = {
  driverId:      'Driver',
  rayonId:       'Rayon',
  helperName:    'Helper',
  departureTime: 'Jam berangkat',
  activeStatus:  'Status aktif',
}

function ActivityLogTab({ date, DatePicker }: { date: string; DatePicker: React.ReactNode }) {
  const { data, isLoading, mutate } = useSWR(
    `/api/activity-logs?date=${date}&limit=100`,
    fetcher,
    { refreshInterval: 15_000 },   // auto-refresh setiap 15 detik
  )
  const logs: any[] = data?.data ?? data ?? []

  return (
    <div>
      {DatePicker}

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          {isLoading ? 'Memuat...' : `${logs.length} aktivitas`}
        </p>
        <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5" onClick={() => mutate()}>
          <Clock className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {isLoading ? (
        <LoadingState rows={5} />
      ) : logs.length === 0 ? (
        <EmptyState
          title="Belum ada aktivitas"
          description="Aktivitas operator di menu Pengiriman akan tercatat di sini secara otomatis."
        />
      ) : (
        <div className="space-y-2">
          {logs.map((log: any) => {
            const cfg  = ACTION_CONFIG[log.action] ?? ACTION_CONFIG.FLEET_UPDATED
            const meta = log.meta ?? {}
            return (
              <div key={log.id} className={`flex gap-3 rounded-lg border p-3 ${cfg.bg}`}>
                {/* Icon */}
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

                  {/* Detail per action */}
                  {log.action === 'ORDER_ASSIGNED' && (
                    <p className="text-sm">
                      <span className="font-medium">{meta.customerName}</span>
                      <span className="text-muted-foreground"> — {meta.qty} sak → {meta.plateNumber}</span>
                    </p>
                  )}
                  {log.action === 'ORDER_UNASSIGNED' && (
                    <p className="text-sm">
                      <span className="font-medium">{meta.customerName}</span>
                      {meta.plateNumber
                        ? <span className="text-muted-foreground"> dikeluarkan dari {meta.plateNumber}</span>
                        : <span className="text-muted-foreground"> dikeluarkan dari semua armada</span>
                      }
                    </p>
                  )}
                  {log.action === 'DELIVERY_LOGGED' && (
                    <p className="text-sm">
                      <span className="font-medium">{meta.customerName}</span>
                      <span className="text-muted-foreground">
                        {' '}— {meta.deliveredQtySak ?? meta.deliveredQty} sak terkirim
                        {(meta.returnedQtySak ?? meta.returnedQty) > 0 && `, ${meta.returnedQtySak ?? meta.returnedQty} sak retur`}
                        {' · '}
                      </span>
                      <span className="text-muted-foreground">Status → </span>
                      <span className="font-medium">{meta.orderStatus}</span>
                    </p>
                  )}
                  {log.action === 'FLEET_UPDATED' && meta.changes && (
                    <div className="space-y-0.5">
                      {Object.entries(meta.changes as Record<string, any>).map(([field, val]) => (
                        <p key={field} className="text-sm text-muted-foreground">
                          {CHANGE_LABELS[field] ?? field} diubah
                          {val.from != null && <span className="line-through mx-1 opacity-60">{String(val.from)}</span>}
                          {val.to   != null && <span className="font-medium text-foreground ml-1">{String(val.to)}</span>}
                        </p>
                      ))}
                      {Object.keys(meta.changes).length === 0 && (
                        <p className="text-sm text-muted-foreground">Tidak ada perubahan</p>
                      )}
                    </div>
                  )}

                  {/* Order number & no. pesanan */}
                  {meta.orderNumber && (
                    <p className="text-xs text-muted-foreground font-mono">{meta.orderNumber}</p>
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

// ─── SlotSheet: kelola pesanan dalam 1 armada ────────────────────────────────
function SlotSheet({ armada, date, open, onClose, onRefresh }: {
  armada: any; date: string; open: boolean; onClose: () => void; onRefresh: () => void
}) {
  const { toast } = useToast()
  const { canWrite } = useRole()
  const [addOpen, setAddOpen]           = useState(false)
  const [showAllRayon, setShowAllRayon] = useState(false)
  const [assigning, setAssigning]       = useState<string | null>(null)

  // Dialog qty input untuk assign
  const [qtyTarget, setQtyTarget]       = useState<any>(null)
  const [qtyValue, setQtyValue]         = useState('')

  // Dialog catat pengiriman
  const [delivTarget, setDelivTarget]   = useState<any>(null)
  const [delivForm, setDelivForm]       = useState({ deliveredQty: '', returnedQty: '0', returnReason: '' })
  const [delivLoading, setDelivLoading] = useState(false)

  // Jam berangkat — inline edit di header sheet
  const toTimeValue = (iso: string | null | undefined) =>
    iso ? format(new Date(iso), "HH:mm") : ''
  const [timeValue, setTimeValue]   = useState(() => toTimeValue(armada?.departureTime))
  const [savingTime, setSavingTime] = useState(false)

  // Sync kalau armada prop berubah (misal setelah refresh)
  useEffect(() => { setTimeValue(toTimeValue(armada?.departureTime)) }, [armada?.departureTime])

  async function saveDepartureTime(val = timeValue) {
    if (!armada?.id) return
    setSavingTime(true)
    try {
      let body: Record<string, unknown>
      if (val) {
        const [hh, mm] = val.split(':').map(Number)
        const dt       = new Date(date)
        dt.setHours(hh, mm, 0, 0)
        body = { departureTime: dt.toISOString() }
      } else {
        body = { departureTime: null }
      }
      const res = await fetch(`/api/fleet/${armada.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        toast({ title: 'Gagal menyimpan jam berangkat', description: json.message, variant: 'destructive' })
        return
      }
      onRefresh()
      toast({ title: val ? `Jam berangkat disimpan: ${val}` : 'Jam berangkat dihapus' })
    } finally { setSavingTime(false) }
  }

  const rayonId    = armada?.rayonId
  const rayonParam = (!showAllRayon && rayonId) ? `&rayonId=${rayonId}` : ''

  const { data: unassigned, isLoading: loadingUnassigned } = useSWR(
    // Fetch CONFIRMED + ASSIGNED + PARTIAL — PARTIAL bisa terjadi karena armada lain sudah
    // mulai mencatat pengiriman, tapi sisa qty-nya mungkin masih belum dialokasikan ke armada lain
    addOpen ? `/api/orders?date=${date}&limit=100&status=CONFIRMED,ASSIGNED,PARTIAL${rayonParam}` : null,
    fetcher,
  )
  // Tampilkan pesanan yang masih punya sisa qty belum dialokasikan ke armada LAIN
  const unassignedOrders: any[] = (unassigned?.orders ?? unassigned ?? []).filter((o: any) => {
    const remaining = o.remainingQty ?? o.orderedQty
    // Kurangi jika sudah ada assignment ke vehicle INI (agar tidak double)
    const assignedToThis = (o.vehicleAssignments ?? [])
      .find((a: any) => a.vehicleId === armada?.vehicleId)?.qty ?? 0
    return (remaining - assignedToThis) > 0
  })

  function openQtyDialog(order: any) {
    const sisaSlot      = armada?.stats?.sisaSlot ?? 0
    const remainingQty  = order.remainingQty ?? order.orderedQty
    const remainingSak  = qtyInSak(remainingQty, order.uom?.unitsPerSak)
    const defaultQtySak = Math.min(sisaSlot, remainingSak)
    setQtyTarget(order)
    setQtyValue(String(defaultQtySak))
  }

  async function assign() {
    if (!qtyTarget) return
    const qtySak = Number(qtyValue)
    if (!qtySak || qtySak <= 0) { toast({ title: 'Qty harus lebih dari 0', variant: 'destructive' }); return }

    // Validasi frontend: tidak boleh melebihi maks sak
    const sisaSlot     = armada?.stats?.sisaSlot ?? 0
    const remainingQty = qtyTarget.remainingQty ?? qtyTarget.orderedQty
    const maxSak       = Math.min(sisaSlot, qtyInSak(remainingQty, qtyTarget.uom?.unitsPerSak))
    if (qtySak > maxSak) {
      toast({ title: `Maks ${maxSak} sak`, description: 'Qty melebihi batas', variant: 'destructive' })
      return
    }

    // Konversi sak → raw unit (kg/ton/dll) untuk dikirim ke API
    const unitsPerSak = qtyTarget.uom?.unitsPerSak ?? 1
    const qtyRaw      = Math.min(qtySak * unitsPerSak, remainingQty)

    setAssigning(qtyTarget.id)
    try {
      const res  = await fetch('/api/armada/assign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: qtyTarget.id, vehicleId: armada.vehicleId, qty: qtyRaw }),
      })
      const json = await res.json()
      if (!res.ok) { toast({ title: 'Gagal menambahkan', description: json.message, variant: 'destructive' }); return }
      setQtyTarget(null)
      setAddOpen(false)   // tutup dialog "Pilih Pesanan" setelah berhasil assign
      onRefresh()
      toast({ title: `${qtySak} sak dimasukkan ke armada`, description: json.data?.customer?.name })
    } finally { setAssigning(null) }
  }

  function openDelivery(order: any) {
    const ups           = order.uom?.unitsPerSak
    const assignedSak   = qtyInSak(order.assignedQty ?? order.orderedQty, ups)
    const alreadySak    = qtyInSak((order.vehicleDeliveredQty ?? 0) + (order.vehicleReturnedQty ?? 0), ups)
    const remainingSak  = Math.max(0, assignedSak - alreadySak)
    setDelivTarget(order)
    setDelivForm({ deliveredQty: String(remainingSak), returnedQty: '0', returnReason: '' })
  }

  async function submitDelivery(e: React.FormEvent) {
    e.preventDefault()
    if (!delivTarget) return
    setDelivLoading(true)
    try {
      const res  = await fetch('/api/delivery-logs', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId:      delivTarget.id,
          vehicleId:    armada.vehicleId,
          driverId:     armada.driverId,
          // input dalam sak → konversi ke raw unit untuk API
          deliveredQty: Math.min(
            Number(delivForm.deliveredQty) * (delivTarget.uom?.unitsPerSak ?? 1),
            delivTarget.assignedQty ?? delivTarget.orderedQty,
          ),
          returnedQty: Math.min(
            Number(delivForm.returnedQty) * (delivTarget.uom?.unitsPerSak ?? 1),
            delivTarget.assignedQty ?? delivTarget.orderedQty,
          ),
          returnReason: delivForm.returnReason || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) { toast({ title: 'Gagal mencatat', description: json.message, variant: 'destructive' }); return }
      setDelivTarget(null)
      onRefresh()
      toast({ title: 'Pengiriman tercatat', description: `Status → ${json.data?.orderStatusUpdatedTo ?? ''}` })
    } finally { setDelivLoading(false) }
  }

  async function unassign(order: any) {
    if (!confirm(`Keluarkan ${order.customer?.name} dari armada ini?`)) return
    setAssigning(order.id)
    try {
      const res  = await fetch('/api/armada/assign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, vehicleId: armada.vehicleId, qty: 0 }),
      })
      const json = await res.json()
      if (!res.ok) { toast({ title: 'Gagal mengeluarkan', description: json.message, variant: 'destructive' }); return }
      onRefresh()
      toast({ title: 'Pesanan dikeluarkan dari armada' })
    } finally { setAssigning(null) }
  }

  const { stats, orders = [] } = armada ?? {}
  const pct = stats?.pctFull ?? 0

  return (
    <Sheet open={open} onOpenChange={o => { if (!o) { setAddOpen(false); onClose() } }}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto flex flex-col gap-0 p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-sky-600" />
            {armada?.vehicle?.plateNumber}
          </SheetTitle>
          <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{armada?.driver?.name ?? '—'}</span>
            {armada?.helperName && <span>+ {armada.helperName}</span>}
            {armada?.rayon && <span className="flex items-center gap-1"><Package className="h-3.5 w-3.5" />{armada.rayon.name}</span>}
          </div>
          {/* Jam berangkat — inline */}
          <div className="flex items-center gap-2 pt-1">
            <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground shrink-0">Jam berangkat</span>
            <input
              type="time"
              value={timeValue}
              onChange={e => setTimeValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveDepartureTime()}
              disabled={savingTime}
              className="h-7 rounded-md border border-input bg-background px-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 w-28"
            />
            <button
              type="button"
              disabled={savingTime}
              onClick={() => saveDepartureTime()}
              className="h-7 px-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {savingTime ? '...' : 'Simpan'}
            </button>
            {timeValue && (
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-destructive"
                onClick={() => { setTimeValue(''); saveDepartureTime('') }}
                title="Hapus jam berangkat"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </SheetHeader>

        {/* Kapasitas bar */}
        <div className="px-6 py-4 border-b space-y-2 bg-muted/30">
          <div className="flex justify-between text-sm font-medium">
            <span>Slot terisi</span>
            <span className={pct >= 100 ? 'text-destructive font-bold' : pct >= 80 ? 'text-amber-600' : 'text-emerald-600'}>
              {stats?.totalAssigned ?? 0} / {stats?.capacitySak ?? 0} sak
            </span>
          </div>
          <Progress
            value={Math.min(pct, 100)}
            className={`h-3 ${pct >= 100 ? '[&>div]:bg-destructive' : pct >= 80 ? '[&>div]:bg-amber-500' : '[&>div]:bg-emerald-500'}`}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{stats?.totalOrders ?? 0} pesanan</span>
            <span>Sisa {stats?.sisaSlot ?? 0} sak</span>
          </div>
        </div>

        {/* Daftar pesanan */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Belum ada pesanan di armada ini.</p>
          ) : (
            orders.map((o: any) => (
              <div key={o.assignmentId ?? o.id} className="flex items-start gap-3 rounded-lg border p-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm truncate">{o.customer?.name}</p>
                    <StatusBadge status={o.status} />
                    {o.isSplit && (
                      <Badge variant="warning" className="text-xs h-4 px-1">Split</Badge>
                    )}
                    {o.vehicleFullyLogged && (
                      <Badge variant="success" className="text-xs h-4 px-1 gap-0.5">
                        <CheckCircle2 className="h-3 w-3" /> Selesai
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {o.deliveryLocation?.namaLokasi ?? '—'}{o.rayon ? ` · ${o.rayon.name}` : ''}
                  </p>
                  <p className="text-xs mt-1">
                    <span className="font-semibold">{qtyInSak(o.assignedQty ?? o.orderedQty, o.uom?.unitsPerSak)} sak</span>
                    {o.isSplit && (
                      <span className="text-muted-foreground ml-1">dari {qtyInSak(o.orderedQty, o.uom?.unitsPerSak)} sak total</span>
                    )}
                    {(o.vehicleDeliveredQty ?? 0) > 0 && (
                      <span className="text-emerald-600 ml-2">· {qtyInSak(o.vehicleDeliveredQty, o.uom?.unitsPerSak)} sak terkirim</span>
                    )}
                    {(o.vehicleReturnedQty ?? 0) > 0 && (
                      <span className="text-amber-600 ml-1">· {qtyInSak(o.vehicleReturnedQty, o.uom?.unitsPerSak)} sak retur</span>
                    )}
                    <span className="text-muted-foreground ml-2">
                      {formatCurrency((o.assignedQty ?? o.orderedQty) * o.pricePerUnit)}
                    </span>
                  </p>
                </div>
                {canWrite && !['DELIVERED', 'CANCELLED', 'REJECTED', 'RETURNED'].includes(o.status) && (
                  <div className="flex flex-col gap-1 shrink-0">
                    {!o.vehicleFullyLogged && (
                      <Button size="sm" variant="default" className="h-7 text-xs px-2"
                        onClick={() => openDelivery(o)}>
                        Catat
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      disabled={assigning === o.id} onClick={() => unassign(o)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Tombol tambah */}
        {canWrite && (stats?.sisaSlot ?? 0) > 0 && (
          <div className="px-6 py-4 border-t">
            <Button className="w-full gap-2" onClick={() => { setShowAllRayon(false); setAddOpen(true) }}>
              <Plus className="h-4 w-4" /> Tambah Pesanan ({stats?.sisaSlot} sak tersisa)
            </Button>
          </div>
        )}

        {/* Dialog Catat Pengiriman ─────────────────────────────────── */}
        <Dialog open={!!delivTarget} onOpenChange={o => { if (!o) setDelivTarget(null) }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>
                {delivTarget?.status === 'PARTIAL' ? 'Catat Pengiriman Lanjutan' : 'Catat Pengiriman'}
              </DialogTitle>
              <div className="text-sm text-muted-foreground space-y-0.5">
                <p className="font-medium text-foreground">{delivTarget?.customer?.name}</p>
                <p>
                  {qtyInSak(delivTarget?.assignedQty ?? delivTarget?.orderedQty ?? 0, delivTarget?.uom?.unitsPerSak)} sak dialokasikan ke armada ini
                  {delivTarget?.isSplit && (
                    <span className="ml-1 text-amber-600">(dari {qtyInSak(delivTarget?.orderedQty ?? 0, delivTarget?.uom?.unitsPerSak)} sak total)</span>
                  )}
                </p>
                {(delivTarget?.vehicleDeliveredQty ?? 0) > 0 && (
                  <p className="text-emerald-600">
                    Sudah dicatat armada ini: {qtyInSak(delivTarget.vehicleDeliveredQty, delivTarget.uom?.unitsPerSak)} sak terkirim
                    {(delivTarget?.vehicleReturnedQty ?? 0) > 0 && ` · ${qtyInSak(delivTarget.vehicleReturnedQty, delivTarget.uom?.unitsPerSak)} sak retur`}
                  </p>
                )}
              </div>
            </DialogHeader>
            <form onSubmit={submitDelivery} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Terkirim (sak) <span className="text-destructive">*</span></Label>
                  <Input
                    type="number" min={0}
                    max={delivTarget ? Math.max(0,
                      qtyInSak(delivTarget.assignedQty ?? delivTarget.orderedQty, delivTarget.uom?.unitsPerSak) -
                      qtyInSak((delivTarget.vehicleDeliveredQty ?? 0) + (delivTarget.vehicleReturnedQty ?? 0), delivTarget.uom?.unitsPerSak)
                    ) : undefined}
                    value={delivForm.deliveredQty}
                    onChange={e => {
                      const ups         = delivTarget?.uom?.unitsPerSak
                      const assignedSak = qtyInSak(delivTarget?.assignedQty ?? delivTarget?.orderedQty ?? 0, ups)
                      const alreadySak  = qtyInSak((delivTarget?.vehicleDeliveredQty ?? 0) + (delivTarget?.vehicleReturnedQty ?? 0), ups)
                      const remainSak   = Math.max(0, assignedSak - alreadySak)
                      const terkirim    = Number(e.target.value)
                      const retur       = Math.max(0, remainSak - terkirim)
                      setDelivForm(f => ({ ...f, deliveredQty: e.target.value, returnedQty: String(retur) }))
                    }}
                    placeholder="0" required autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Retur (sak)</Label>
                  <Input
                    type="number" min={0}
                    value={delivForm.returnedQty}
                    onChange={e => setDelivForm(f => ({ ...f, returnedQty: e.target.value }))}
                    placeholder="0"
                  />
                </div>
              </div>
              {Number(delivForm.returnedQty) > 0 && (
                <div className="space-y-1.5">
                  <Label>Alasan Retur</Label>
                  <Select value={delivForm.returnReason} onValueChange={v => setDelivForm(f => ({ ...f, returnReason: v }))}>
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
                <Button type="button" variant="outline" onClick={() => setDelivTarget(null)}>Batal</Button>
                <Button type="submit" disabled={delivLoading || delivForm.deliveredQty === ''}>
                  {delivLoading ? 'Menyimpan...' : 'Simpan'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Dialog konfirmasi qty ────────────────────────────────────── */}
        <Dialog open={!!qtyTarget} onOpenChange={o => { if (!o) setQtyTarget(null) }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Alokasikan ke armada ini?</DialogTitle>
              <p className="text-sm text-muted-foreground">{qtyTarget?.customer?.name}</p>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Total pesanan</span>
                <span className="font-medium text-foreground">{qtyInSak(qtyTarget?.orderedQty ?? 0, qtyTarget?.uom?.unitsPerSak)} sak</span>
              </div>
              {(qtyTarget?.totalAllocated ?? 0) > 0 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Sudah dialokasikan (armada lain)</span>
                  <span>{qtyInSak(qtyTarget?.totalAllocated ?? 0, qtyTarget?.uom?.unitsPerSak)} sak</span>
                </div>
              )}
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Sisa slot armada ini</span>
                <span>{stats?.sisaSlot ?? 0} sak</span>
              </div>
              <div className="space-y-1.5 pt-1">
                <Label>Jumlah sak untuk armada ini <span className="text-destructive">*</span></Label>
                <Input
                  type="number" min={1}
                  max={Math.min(stats?.sisaSlot ?? 0, qtyInSak(qtyTarget?.remainingQty ?? qtyTarget?.orderedQty ?? 0, qtyTarget?.uom?.unitsPerSak))}
                  value={qtyValue}
                  onChange={e => {
                    const maxSak = Math.min(
                      stats?.sisaSlot ?? 0,
                      qtyInSak(qtyTarget?.remainingQty ?? qtyTarget?.orderedQty ?? 0, qtyTarget?.uom?.unitsPerSak)
                    )
                    const v = e.target.value
                    setQtyValue(Number(v) > maxSak ? String(maxSak) : v)
                  }}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  Maks: {Math.min(stats?.sisaSlot ?? 0, qtyInSak(qtyTarget?.remainingQty ?? qtyTarget?.orderedQty ?? 0, qtyTarget?.uom?.unitsPerSak))} sak
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setQtyTarget(null)}>Batal</Button>
              <Button onClick={assign} disabled={assigning === qtyTarget?.id}>
                {assigning === qtyTarget?.id ? 'Menyimpan...' : 'Masukkan'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog pilih pesanan */}
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Pilih Pesanan — {armada?.vehicle?.plateNumber}</DialogTitle>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-sm text-muted-foreground">
                  Sisa kapasitas: <span className="font-semibold text-foreground">{stats?.sisaSlot} sak</span>
                  {!showAllRayon && armada?.rayon && (
                    <span className="ml-2 text-sky-600">· {armada.rayon.name}</span>
                  )}
                </p>
                {rayonId && (
                  <Button
                    type="button" variant="ghost" size="sm"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={() => setShowAllRayon(v => !v)}
                  >
                    {showAllRayon ? 'Filter rayon ini' : 'Tampilkan semua rayon'}
                  </Button>
                )}
              </div>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto space-y-2">
              {loadingUnassigned ? (
                <LoadingState rows={4} />
              ) : unassignedOrders.length === 0 ? (
                <div className="text-center py-6 space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Tidak ada pesanan terkonfirmasi yang belum diassign
                    {!showAllRayon && armada?.rayon ? ` di ${armada.rayon.name}` : ''}.
                  </p>
                  {!showAllRayon && rayonId && (
                    <Button variant="outline" size="sm" onClick={() => setShowAllRayon(true)}>
                      Tampilkan semua rayon
                    </Button>
                  )}
                </div>
              ) : (
                unassignedOrders.map((o: any) => {
                  const sisaSlot     = stats?.sisaSlot ?? 0
                  const remainingQty = o.remainingQty ?? o.orderedQty
                  const bisaMasuk    = sisaSlot > 0   // bisa masuk sebagian asal ada slot
                  const maxQty       = Math.min(sisaSlot, remainingQty)
                  return (
                    <div key={o.id} className="flex items-center gap-3 rounded-lg border p-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-medium text-sm truncate">{o.customer?.name}</p>
                          {o.totalAllocated > 0 && (
                            <Badge variant="warning" className="text-xs h-4 px-1">
                              {o.totalAllocated}/{qtyInSak(o.orderedQty, o.uom?.unitsPerSak)} sak dialokasikan
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {o.deliveryLocation?.namaLokasi ?? '—'}{o.rayon ? ` · ${o.rayon.name}` : ''}
                        </p>
                        <p className="text-xs mt-0.5">
                          <span className="font-semibold">{qtyInSak(remainingQty, o.uom?.unitsPerSak)} sak</span>
                          <span className="text-muted-foreground ml-1">tersisa</span>
                          {sisaSlot > 0 && maxQty < remainingQty && (
                            <span className="text-muted-foreground ml-1">· maks {qtyInSak(maxQty, o.uom?.unitsPerSak)} sak di armada ini</span>
                          )}
                        </p>
                      </div>
                      <Button size="sm"
                        disabled={!bisaMasuk || assigning === o.id}
                        onClick={() => { if (bisaMasuk) openQtyDialog(o) }}
                        className="shrink-0">
                        {assigning === o.id ? '...' : bisaMasuk ? 'Masukkan' : 'Slot habis'}
                      </Button>
                    </div>
                  )
                })
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>Tutup</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  )
}

// ─── EditFleetDialog: ubah rayon/driver/helper/waktu berangkat ───────────────
function EditFleetDialog({ target, open, onClose, onRefresh }: {
  target: any; open: boolean; onClose: () => void; onRefresh: () => void
}) {
  const { toast }            = useToast()
  const { data: rayons }     = useRayons()
  const { data: driversRaw } = useSWR('/api/drivers?limit=100&status=ACTIVE', fetcher)
  const drivers: any[]       = driversRaw?.data ?? driversRaw ?? []

  const [form, setForm]     = useState({ driverId: '', rayonId: '', helperName: '', departureTime: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (target) {
      setForm({
        driverId:      target.driverId   ?? '',
        rayonId:       target.rayonId    ?? '',
        helperName:    target.helperName ?? '',
        departureTime: target.departureTime
          ? format(new Date(target.departureTime), "yyyy-MM-dd'T'HH:mm")
          : '',
      })
    }
  }, [target])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      const body: Record<string, any> = {
        driverId:   form.driverId   || undefined,
        rayonId:    form.rayonId    || undefined,
        helperName: form.helperName || undefined,
      }
      if (form.departureTime) body.departureTime = new Date(form.departureTime).toISOString()
      const res  = await fetch(`/api/fleet/${target.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) { toast({ title: 'Gagal menyimpan', description: json.message, variant: 'destructive' }); return }
      onRefresh(); onClose()
      toast({ title: 'Data pengiriman diperbarui' })
    } finally { setSaving(false) }
  }

  // Cek perubahan dari default armada
  const masterArmada = target?.masterArmada ?? null
  const driverChanged  = masterArmada && form.driverId      && form.driverId    !== masterArmada.driverId
  const rayonChanged   = masterArmada && form.rayonId       && form.rayonId     !== masterArmada.rayonId
  const helperChanged  = masterArmada && form.helperName    && form.helperName  !== (masterArmada.helperName ?? '')

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Atur Pengiriman Hari Ini — {target?.vehicle?.plateNumber}</DialogTitle>
          <p className="text-xs text-muted-foreground">Perubahan hanya berlaku untuk hari ini, tidak mengubah data master armada.</p>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Label>Driver</Label>
              {driverChanged && <Badge variant="warning" className="text-xs h-5">Diubah</Badge>}
            </div>
            <Select value={form.driverId} onValueChange={v => setForm(f => ({ ...f, driverId: v }))}>
              <SelectTrigger><SelectValue placeholder="Pilih driver..." /></SelectTrigger>
              <SelectContent>
                {drivers.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {masterArmada && driverChanged && (
              <p className="text-xs text-muted-foreground">
                Default: {drivers.find((d: any) => d.id === masterArmada.driverId)?.name ?? '—'}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Label>Rayon Keberangkatan</Label>
              {rayonChanged && <Badge variant="warning" className="text-xs h-5">Diubah</Badge>}
            </div>
            <Select value={form.rayonId} onValueChange={v => setForm(f => ({ ...f, rayonId: v }))}>
              <SelectTrigger><SelectValue placeholder="Pilih rayon..." /></SelectTrigger>
              <SelectContent>
                {(rayons ?? []).map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {masterArmada && rayonChanged && (
              <p className="text-xs text-muted-foreground">
                Default: {(rayons ?? []).find((r: any) => r.id === masterArmada.rayonId)?.name ?? '—'}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Label>Helper / Kenek</Label>
              {helperChanged && <Badge variant="warning" className="text-xs h-5">Diubah</Badge>}
            </div>
            <Input
              value={form.helperName}
              onChange={e => setForm(f => ({ ...f, helperName: e.target.value }))}
              placeholder="Nama helper..."
            />
            {masterArmada && helperChanged && (
              <p className="text-xs text-muted-foreground">
                Default: {masterArmada.helperName ?? '(tidak ada)'}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Jam Berangkat <span className="text-muted-foreground text-xs">(opsional)</span></Label>
            <Input type="datetime-local" value={form.departureTime} onChange={e => setForm(f => ({ ...f, departureTime: e.target.value }))} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function PengirimanPage() {
  const today = format(new Date(), 'yyyy-MM-dd')
  const [date, setDate]             = useState(today)
  const [slotTarget, setSlotTarget] = useState<any>(null)
  const [editTarget, setEditTarget] = useState<any>(null)

  const { canWrite } = useRole()
  const { data: rayons } = useRayons()

  const dailyKey = `/api/armada/daily?date=${date}`
  const { data: dailyFleet, isLoading: fleetLoading, mutate: mutateFleet } = useSWR(dailyKey, fetcher)
  const fleet: any[] = dailyFleet ?? []

  // Sync slotTarget setelah refresh agar data di sheet ikut terbaru
  function handleRefresh() {
    mutateFleet().then((fresh: any) => {
      if (slotTarget && fresh) {
        const updated = (fresh as any[]).find((f: any) => f.id === slotTarget.id)
        if (updated) setSlotTarget(updated)
      }
    })
  }

  // ── Date picker (shared antar tab) ──────────────────────────────────────────
  const DatePicker = (
    <div className="flex items-center gap-3 mb-6">
      <Label className="text-sm shrink-0">Tanggal</Label>
      <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-40 h-8 text-sm" />
      <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setDate(today)}>Hari Ini</Button>
    </div>
  )

  return (
    <div>
      <PageHeader
        title="Pengiriman"
        description="Operasional harian — kelola slot pesanan dan log perubahan armada per hari"
      />

      <Tabs defaultValue="slot">
        <TabsList className="mb-4">
          <TabsTrigger value="slot" className="gap-2">
            <Package className="h-4 w-4" /> Kelola Slot
          </TabsTrigger>
          <TabsTrigger value="log" className="gap-2">
            <Navigation2 className="h-4 w-4" /> Log Harian
          </TabsTrigger>
        </TabsList>

        {/* ══ TAB: KELOLA SLOT ══════════════════════════════════════════════════ */}
        <TabsContent value="slot">
          {DatePicker}
          <OrderQueuePanel date={date} onRefreshFleet={handleRefresh} />
          {fleetLoading ? (
            <LoadingCards count={3} />
          ) : fleet.length === 0 ? (
            <EmptyState
              title="Tidak ada armada aktif"
              description="Tidak ada kendaraan aktif dengan driver yang ditugaskan. Atur di Master Data → Armada."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {fleet.map((f: any) => {
                const pct = f.stats?.pctFull ?? 0
                return (
                  <Card key={f.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSlotTarget(f)}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <Truck className="h-5 w-5 text-sky-600 shrink-0" />
                          <div>
                            <CardTitle className="text-base">{f.vehicle?.plateNumber}</CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">{f.rayon?.name ?? '—'}</p>
                          </div>
                        </div>
                        <Badge variant={f.activeStatus ? 'success' : 'secondary'}>
                          {f.activeStatus ? 'Aktif' : 'Selesai'}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span>{f.driver?.name ?? '—'}</span>
                        {f.helperName && <span className="text-muted-foreground text-xs">+ {f.helperName}</span>}
                      </div>
                      {f.departureTime && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4 shrink-0" />
                          <span>Berangkat {format(new Date(f.departureTime), 'HH:mm')}</span>
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Slot terisi</span>
                          <span className={`font-semibold ${pct >= 100 ? 'text-destructive' : pct >= 80 ? 'text-amber-600' : 'text-foreground'}`}>
                            {f.stats?.totalAssigned ?? 0} / {f.stats?.capacitySak ?? 0} sak
                          </span>
                        </div>
                        <Progress
                          value={Math.min(pct, 100)}
                          className={`h-2 ${pct >= 100 ? '[&>div]:bg-destructive' : pct >= 80 ? '[&>div]:bg-amber-500' : '[&>div]:bg-sky-500'}`}
                        />
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <Package className="h-4 w-4" />
                          {f.stats?.totalOrders ?? 0} pesanan · sisa {f.stats?.sisaSlot ?? 0} sak
                        </span>
                        {f.stats?.totalOrders > 0 && (
                          <span className="flex items-center gap-1 text-xs text-emerald-600">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {f.orders?.filter((o: any) => ['DELIVERED', 'PARTIAL'].includes(o.status)).length}/{f.stats.totalOrders}
                          </span>
                        )}
                      </div>
                      {canWrite && (
                        <div className="flex gap-2 pt-1 border-t" onClick={e => e.stopPropagation()}>
                          <Button size="sm" variant="outline" className="flex-1 h-8 text-xs gap-1" onClick={() => setEditTarget(f)}>
                            <Settings2 className="h-3.5 w-3.5" /> Atur
                          </Button>
                          <Button size="sm" className="flex-1 h-8 text-xs gap-1" onClick={() => setSlotTarget(f)}>
                            <Package className="h-3.5 w-3.5" /> Kelola Pesanan
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* ══ TAB: LOG HARIAN ══════════════════════════════════════════════════ */}
        <TabsContent value="log">
          <ActivityLogTab date={date} DatePicker={DatePicker} />
        </TabsContent>
      </Tabs>

      {slotTarget && (
        <SlotSheet
          armada={slotTarget}
          date={date}
          open={!!slotTarget}
          onClose={() => setSlotTarget(null)}
          onRefresh={handleRefresh}
        />
      )}

      {editTarget && (
        <EditFleetDialog
          target={editTarget}
          open={!!editTarget}
          onClose={() => setEditTarget(null)}
          onRefresh={mutateFleet}
        />
      )}
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import {
  Truck, User, Package, Clock, Plus, Pencil, Trash2,
  Search, ChevronRight, X, Settings2, CheckCircle2,
} from 'lucide-react'
import useSWR, { mutate as globalMutate } from 'swr'
import { fetcher } from '@/lib/fetcher'
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useRole } from '@/hooks/useRole'
import { useToast } from '@/hooks/use-toast'
import { useRayons } from '@/hooks/useCustomers'
import { formatCurrency } from '@/lib/utils'

// ─── Status labels ──────────────────────────────────────────────────────────
const VEH_STATUS_LABELS: Record<string, string> = { ACTIVE: 'Aktif', INACTIVE: 'Nonaktif', MAINTENANCE: 'Perawatan' }
const VEH_STATUS_VARIANTS: Record<string, any>  = { ACTIVE: 'success', MAINTENANCE: 'warning', INACTIVE: 'secondary' }
const DRV_STATUS_LABELS: Record<string, string> = { ACTIVE: 'Aktif', INACTIVE: 'Nonaktif', ON_LEAVE: 'Cuti' }
const DRV_STATUS_VARIANTS: Record<string, any>  = { ACTIVE: 'success', ON_LEAVE: 'warning', INACTIVE: 'secondary' }
const ORDER_STATUS_LABELS: Record<string, string> = {
  CREATED: 'Dibuat', CONFIRMED: 'Dikonfirmasi', ASSIGNED: 'Ditugaskan',
  LOADED: 'Dimuat', DELIVERED: 'Terkirim', PARTIAL: 'Sebagian',
  RETURNED: 'Dikembalikan', CANCELLED: 'Dibatalkan', REJECTED: 'Ditolak',
}

// ─── SlotSheet: manajemen pesanan dalam 1 armada ────────────────────────────
function SlotSheet({
  armada, date, open, onClose, onRefresh,
}: {
  armada: any; date: string; open: boolean; onClose: () => void; onRefresh: () => void
}) {
  const { toast } = useToast()
  const { canWrite } = useRole()
  const [addOpen, setAddOpen]     = useState(false)
  const [assigning, setAssigning] = useState<string | null>(null)

  // Pesanan yang belum diassign untuk tanggal ini
  const { data: unassigned, isLoading: loadingUnassigned } = useSWR(
    addOpen
      ? `/api/orders?date=${date}&limit=100&status=CONFIRMED`
      : null,
    fetcher,
  )

  const unassignedOrders: any[] = (unassigned?.orders ?? unassigned ?? []).filter(
    (o: any) => !o.vehicleId || o.vehicleId === null
  )

  async function assign(orderId: string) {
    setAssigning(orderId)
    try {
      const res  = await fetch('/api/armada/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, vehicleId: armada.vehicleId }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast({ title: 'Gagal menambahkan', description: json.message, variant: 'destructive' })
        return
      }
      onRefresh()
      toast({ title: 'Pesanan dimasukkan ke armada', description: json.data?.customer?.name })
    } finally {
      setAssigning(null)
    }
  }

  async function unassign(orderId: string, customerName: string) {
    if (!confirm(`Keluarkan pesanan ${customerName} dari armada ini?`)) return
    setAssigning(orderId)
    try {
      const res  = await fetch('/api/armada/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, vehicleId: null }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast({ title: 'Gagal mengeluarkan', description: json.message, variant: 'destructive' })
        return
      }
      onRefresh()
      toast({ title: 'Pesanan dikeluarkan dari armada' })
    } finally {
      setAssigning(null)
    }
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
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{armada?.driver?.name ?? '-'}</span>
            {armada?.helperName && <span>+ {armada.helperName}</span>}
            {armada?.rayon && <span className="flex items-center gap-1"><Package className="h-3.5 w-3.5" />{armada.rayon.name}</span>}
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

        {/* Daftar pesanan di armada ini */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Belum ada pesanan di armada ini.</p>
          ) : (
            orders.map((o: any) => (
              <div key={o.id} className="flex items-start gap-3 rounded-lg border p-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm truncate">{o.customer?.name}</p>
                    <StatusBadge status={o.status} />
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {o.deliveryLocation?.namaLokasi ?? '—'}{o.rayon ? ` · ${o.rayon.name}` : ''}
                  </p>
                  <p className="text-xs mt-1">
                    <span className="font-semibold">{o.orderedQty} sak</span>
                    <span className="text-muted-foreground ml-2">{formatCurrency(o.orderedQty * o.pricePerUnit)}</span>
                  </p>
                </div>
                {canWrite && !['DELIVERED', 'CANCELLED', 'REJECTED', 'RETURNED'].includes(o.status) && (
                  <Button
                    size="icon" variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                    disabled={assigning === o.id}
                    onClick={() => unassign(o.id, o.customer?.name)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Tombol tambah pesanan */}
        {canWrite && (stats?.sisaSlot ?? 0) > 0 && (
          <div className="px-6 py-4 border-t">
            <Button className="w-full gap-2" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> Tambah Pesanan ({stats?.sisaSlot} sak tersisa)
            </Button>
          </div>
        )}

        {/* Dialog pilih pesanan untuk ditambahkan */}
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Pilih Pesanan — {armada?.vehicle?.plateNumber}</DialogTitle>
              <p className="text-sm text-muted-foreground">
                Sisa kapasitas: <span className="font-semibold text-foreground">{stats?.sisaSlot} sak</span>
              </p>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto space-y-2">
              {loadingUnassigned ? (
                <LoadingState rows={4} />
              ) : unassignedOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Tidak ada pesanan terkonfirmasi yang belum diassign.
                </p>
              ) : (
                unassignedOrders.map((o: any) => {
                  const cukup = o.orderedQty <= (stats?.sisaSlot ?? 0)
                  return (
                    <div
                      key={o.id}
                      className={`flex items-center gap-3 rounded-lg border p-3 ${!cukup ? 'opacity-50' : ''}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{o.customer?.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {o.deliveryLocation?.namaLokasi ?? '—'}{o.rayon ? ` · ${o.rayon.name}` : ''}
                        </p>
                        <p className="text-xs mt-0.5 font-semibold">{o.orderedQty} sak</p>
                      </div>
                      <Button
                        size="sm" variant={cukup ? 'default' : 'outline'}
                        disabled={!cukup || assigning === o.id}
                        onClick={() => assign(o.id)}
                        className="shrink-0"
                      >
                        {assigning === o.id ? '...' : cukup ? 'Masukkan' : 'Penuh'}
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

// ─── EditFleetDialog: ubah rayon / driver / helper / waktu berangkat ────────
function EditFleetDialog({ target, open, onClose, drivers, rayons, onRefresh }: {
  target: any; open: boolean; onClose: () => void
  drivers: any[]; rayons: any[]; onRefresh: () => void
}) {
  const { toast } = useToast()
  const [form, setForm]     = useState({ driverId: '', rayonId: '', helperName: '', departureTime: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (target) {
      setForm({
        driverId:      target.driverId ?? '',
        rayonId:       target.rayonId  ?? '',
        helperName:    target.helperName ?? '',
        departureTime: target.departureTime
          ? format(new Date(target.departureTime), "yyyy-MM-dd'T'HH:mm")
          : '',
      })
    }
  }, [target])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
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
      onRefresh()
      onClose()
      toast({ title: 'Armada diperbarui' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Atur Armada — {target?.vehicle?.plateNumber}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Driver</Label>
            <Select value={form.driverId} onValueChange={v => setForm(f => ({ ...f, driverId: v }))}>
              <SelectTrigger><SelectValue placeholder="Pilih driver..." /></SelectTrigger>
              <SelectContent>
                {drivers.filter((d: any) => d.status === 'ACTIVE').map((d: any) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Rayon</Label>
            <Select value={form.rayonId} onValueChange={v => setForm(f => ({ ...f, rayonId: v }))}>
              <SelectTrigger><SelectValue placeholder="Pilih rayon..." /></SelectTrigger>
              <SelectContent>
                {rayons.map((r: any) => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Helper / Kenek <span className="text-muted-foreground text-xs">(opsional)</span></Label>
            <Input value={form.helperName} onChange={e => setForm(f => ({ ...f, helperName: e.target.value }))} placeholder="Nama helper..." />
          </div>
          <div className="space-y-1.5">
            <Label>Waktu Berangkat <span className="text-muted-foreground text-xs">(opsional)</span></Label>
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
export default function ArmadaPage() {
  const today = format(new Date(), 'yyyy-MM-dd')
  const [tab, setTab]                 = useState<'operasional' | 'master'>('operasional')
  const [date, setDate]               = useState(today)
  const [slotTarget, setSlotTarget]   = useState<any>(null)
  const [editTarget, setEditTarget]   = useState<any>(null)
  const [vehSearch, setVehSearch]     = useState('')
  const [drvSearch, setDrvSearch]     = useState('')

  // ── Form master kendaraan
  const [vehOpen, setVehOpen]     = useState(false)
  const [vehEditId, setVehEditId] = useState<string | null>(null)
  const [vehForm, setVehForm]     = useState({ plateNumber: '', capacitySak: '', operationalCostPerDay: '', status: 'ACTIVE' })
  const [vehSaving, setVehSaving] = useState(false)

  // ── Form master driver
  const [drvOpen, setDrvOpen]     = useState(false)
  const [drvEditId, setDrvEditId] = useState<string | null>(null)
  const [drvForm, setDrvForm]     = useState({ name: '', phone: '', assignedVehicleId: '', status: 'ACTIVE' })
  const [drvSaving, setDrvSaving] = useState(false)

  const { canWrite, isAdmin } = useRole()
  const { toast }             = useToast()
  const { data: rayons }      = useRayons()

  // ── Data fetching
  const dailyKey  = `/api/armada/daily?date=${date}`
  const vehKey    = `/api/vehicles?limit=100${vehSearch ? `&search=${encodeURIComponent(vehSearch)}` : ''}`
  const drvKey    = `/api/drivers?limit=100${drvSearch ? `&search=${encodeURIComponent(drvSearch)}` : ''}`

  const { data: dailyFleet, isLoading: fleetLoading, mutate: mutateFleet } = useSWR(dailyKey, fetcher)
  const { data: vehicles,   isLoading: vehLoading  }  = useSWR(tab === 'master' ? vehKey : null, fetcher)
  const { data: drivers,    isLoading: drvLoading  }  = useSWR(tab === 'master' || editTarget ? drvKey : null, fetcher)

  const fleet:   any[] = dailyFleet ?? []
  const vehList: any[] = vehicles?.data ?? vehicles ?? []
  const drvList: any[] = drivers?.data  ?? drivers  ?? []

  // ─── Kendaraan CRUD ──────────────────────────────────────────────────────
  function openVehCreate() {
    setVehEditId(null)
    setVehForm({ plateNumber: '', capacitySak: '', operationalCostPerDay: '', status: 'ACTIVE' })
    setVehOpen(true)
  }
  function openVehEdit(v: any) {
    setVehEditId(v.id)
    setVehForm({ plateNumber: v.plateNumber, capacitySak: String(v.capacitySak), operationalCostPerDay: String(v.operationalCostPerDay), status: v.status })
    setVehOpen(true)
  }
  async function saveVehicle(e: React.FormEvent) {
    e.preventDefault(); setVehSaving(true)
    try {
      const body = { ...vehForm, capacitySak: Number(vehForm.capacitySak), operationalCostPerDay: Number(vehForm.operationalCostPerDay) }
      const res  = vehEditId
        ? await fetch(`/api/vehicles/${vehEditId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        : await fetch('/api/vehicles',               { method: 'POST',  headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const json = await res.json()
      if (!res.ok) { toast({ title: 'Gagal menyimpan', description: json.message, variant: 'destructive' }); return }
      setVehOpen(false); globalMutate(vehKey)
      toast({ title: vehEditId ? 'Kendaraan diperbarui' : 'Kendaraan ditambahkan', description: vehForm.plateNumber })
    } finally { setVehSaving(false) }
  }
  async function deleteVehicle(id: string, plate: string) {
    if (!confirm(`Hapus kendaraan ${plate}?`)) return
    const res  = await fetch(`/api/vehicles/${id}`, { method: 'DELETE' })
    const json = await res.json()
    if (!res.ok) { toast({ title: 'Gagal menghapus', description: json.message, variant: 'destructive' }); return }
    globalMutate(vehKey); toast({ title: 'Kendaraan dihapus', description: plate })
  }

  // ─── Driver CRUD ─────────────────────────────────────────────────────────
  function openDrvCreate() {
    setDrvEditId(null)
    setDrvForm({ name: '', phone: '', assignedVehicleId: '', status: 'ACTIVE' })
    setDrvOpen(true)
  }
  function openDrvEdit(d: any) {
    setDrvEditId(d.id)
    setDrvForm({ name: d.name, phone: d.phone ?? '', assignedVehicleId: d.assignedVehicleId ?? '', status: d.status })
    setDrvOpen(true)
  }
  async function saveDriver(e: React.FormEvent) {
    e.preventDefault(); setDrvSaving(true)
    try {
      const body = { ...drvForm, assignedVehicleId: drvForm.assignedVehicleId || undefined }
      const res  = drvEditId
        ? await fetch(`/api/drivers/${drvEditId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        : await fetch('/api/drivers',               { method: 'POST',  headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const json = await res.json()
      if (!res.ok) { toast({ title: 'Gagal menyimpan', description: json.message, variant: 'destructive' }); return }
      setDrvOpen(false); globalMutate(drvKey)
      toast({ title: drvEditId ? 'Driver diperbarui' : 'Driver ditambahkan', description: drvForm.name })
    } finally { setDrvSaving(false) }
  }
  async function deleteDriver(id: string, name: string) {
    if (!confirm(`Hapus driver ${name}?`)) return
    const res  = await fetch(`/api/drivers/${id}`, { method: 'DELETE' })
    const json = await res.json()
    if (!res.ok) { toast({ title: 'Gagal menghapus', description: json.message, variant: 'destructive' }); return }
    globalMutate(drvKey); toast({ title: 'Driver dihapus', description: name })
  }

  return (
    <div>
      <PageHeader
        title="Armada"
        description="Operasional harian dan master data kendaraan & driver"
      />

      <Tabs value={tab} onValueChange={v => setTab(v as any)}>
        <TabsList className="mb-6">
          <TabsTrigger value="operasional" className="gap-2"><Truck className="h-4 w-4" />Operasional Harian</TabsTrigger>
          <TabsTrigger value="master"      className="gap-2"><Settings2 className="h-4 w-4" />Master Armada</TabsTrigger>
        </TabsList>

        {/* ══════════ TAB OPERASIONAL ══════════ */}
        <TabsContent value="operasional">
          {/* Date picker */}
          <div className="flex items-center gap-3 mb-6">
            <Label className="text-sm shrink-0">Tanggal</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-40 h-8 text-sm" />
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setDate(today)}>Hari Ini</Button>
          </div>

          {fleetLoading ? (
            <LoadingCards count={3} />
          ) : fleet.length === 0 ? (
            <EmptyState
              title="Tidak ada armada aktif"
              description="Tidak ada kendaraan aktif dengan driver yang ditugaskan. Atur di tab Master Armada."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {fleet.map((f: any) => {
                const pct = f.stats?.pctFull ?? 0
                return (
                  <Card
                    key={f.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setSlotTarget(f)}
                  >
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

                      {/* Slot capacity bar */}
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
                          <Button size="sm" variant="outline" className="flex-1 h-8 text-xs gap-1"
                            onClick={() => setEditTarget(f)}>
                            <Settings2 className="h-3.5 w-3.5" /> Atur
                          </Button>
                          <Button size="sm" className="flex-1 h-8 text-xs gap-1"
                            onClick={() => setSlotTarget(f)}>
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

          {/* SlotSheet */}
          {slotTarget && (
            <SlotSheet
              armada={slotTarget}
              date={date}
              open={!!slotTarget}
              onClose={() => setSlotTarget(null)}
              onRefresh={() => { mutateFleet(); setSlotTarget((prev: any) => fleet.find((f: any) => f.id === prev?.id) ?? prev) }}
            />
          )}

          {/* EditFleetDialog */}
          {editTarget && (
            <EditFleetDialog
              target={editTarget}
              open={!!editTarget}
              onClose={() => setEditTarget(null)}
              drivers={drvList}
              rayons={rayons ?? []}
              onRefresh={mutateFleet}
            />
          )}
        </TabsContent>

        {/* ══════════ TAB MASTER ARMADA ══════════ */}
        <TabsContent value="master" className="space-y-8">

          {/* ── Kendaraan ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-semibold flex items-center gap-2"><Truck className="h-5 w-5 text-sky-600" />Kendaraan</h3>
                <p className="text-xs text-muted-foreground">Kapasitas = jumlah slot pesanan per hari</p>
              </div>
              {canWrite && (
                <Button size="sm" className="gap-1.5" onClick={openVehCreate}>
                  <Plus className="h-4 w-4" /> Tambah Kendaraan
                </Button>
              )}
            </div>
            <div className="mb-3">
              <div className="relative max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input value={vehSearch} onChange={e => setVehSearch(e.target.value)} placeholder="Cari plat..." className="pl-9 h-8 text-sm" />
              </div>
            </div>
            <Card>
              <CardContent className="p-0">
                {vehLoading ? <div className="p-4"><LoadingState rows={4} /></div> : vehList.length === 0 ? (
                  <EmptyState title="Belum ada kendaraan" description="Tambahkan kendaraan pertama." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Plat Nomor</TableHead>
                        <TableHead>Driver Tetap</TableHead>
                        <TableHead className="text-right">Kapasitas (sak)</TableHead>
                        <TableHead>Status</TableHead>
                        {canWrite && <TableHead />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vehList.map((v: any) => (
                        <TableRow key={v.id}>
                          <TableCell className="font-mono font-medium">{v.plateNumber}</TableCell>
                          <TableCell>
                            {v.drivers?.[0]
                              ? <span className="flex items-center gap-1.5 text-sm"><User className="h-3.5 w-3.5 text-muted-foreground" />{v.drivers[0].name}</span>
                              : <span className="text-muted-foreground text-sm">—</span>}
                          </TableCell>
                          <TableCell className="text-right font-semibold">{v.capacitySak}</TableCell>
                          <TableCell><Badge variant={VEH_STATUS_VARIANTS[v.status]}>{VEH_STATUS_LABELS[v.status] ?? v.status}</Badge></TableCell>
                          {canWrite && (
                            <TableCell className="text-right">
                              <div className="flex gap-1 justify-end">
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openVehEdit(v)}><Pencil className="h-3.5 w-3.5" /></Button>
                                {isAdmin && <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteVehicle(v.id, v.plateNumber)}><Trash2 className="h-3.5 w-3.5" /></Button>}
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Driver ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-semibold flex items-center gap-2"><User className="h-5 w-5 text-sky-600" />Driver</h3>
                <p className="text-xs text-muted-foreground">Assign driver ke kendaraan untuk muncul di operasional harian</p>
              </div>
              {canWrite && (
                <Button size="sm" className="gap-1.5" onClick={openDrvCreate}>
                  <Plus className="h-4 w-4" /> Tambah Driver
                </Button>
              )}
            </div>
            <div className="mb-3">
              <div className="relative max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input value={drvSearch} onChange={e => setDrvSearch(e.target.value)} placeholder="Cari nama driver..." className="pl-9 h-8 text-sm" />
              </div>
            </div>
            <Card>
              <CardContent className="p-0">
                {drvLoading ? <div className="p-4"><LoadingState rows={4} /></div> : drvList.length === 0 ? (
                  <EmptyState title="Belum ada driver" description="Tambahkan driver pertama." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nama Driver</TableHead>
                        <TableHead>No. HP</TableHead>
                        <TableHead>Kendaraan Tetap</TableHead>
                        <TableHead>Status</TableHead>
                        {canWrite && <TableHead />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {drvList.map((d: any) => (
                        <TableRow key={d.id}>
                          <TableCell className="font-medium">{d.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{d.phone ?? '—'}</TableCell>
                          <TableCell>
                            {d.assignedVehicle
                              ? <span className="flex items-center gap-1.5 text-sm font-mono"><Truck className="h-3.5 w-3.5 text-muted-foreground" />{d.assignedVehicle.plateNumber}</span>
                              : <span className="text-muted-foreground text-sm">Belum ditugaskan</span>}
                          </TableCell>
                          <TableCell><Badge variant={DRV_STATUS_VARIANTS[d.status]}>{DRV_STATUS_LABELS[d.status] ?? d.status}</Badge></TableCell>
                          {canWrite && (
                            <TableCell className="text-right">
                              <div className="flex gap-1 justify-end">
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openDrvEdit(d)}><Pencil className="h-3.5 w-3.5" /></Button>
                                {isAdmin && <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteDriver(d.id, d.name)}><Trash2 className="h-3.5 w-3.5" /></Button>}
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Dialog Tambah/Edit Kendaraan ── */}
      <Dialog open={vehOpen} onOpenChange={o => { setVehOpen(o); if (!o) setVehEditId(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{vehEditId ? 'Edit Kendaraan' : 'Tambah Kendaraan'}</DialogTitle></DialogHeader>
          <form onSubmit={saveVehicle} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nomor Plat <span className="text-destructive">*</span></Label>
              <Input value={vehForm.plateNumber} onChange={e => setVehForm(f => ({ ...f, plateNumber: e.target.value }))} placeholder="B 1234 XYZ" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Kapasitas (sak) <span className="text-destructive">*</span></Label>
                <Input type="number" min={0} value={vehForm.capacitySak} onChange={e => setVehForm(f => ({ ...f, capacitySak: e.target.value }))} placeholder="0" required />
              </div>
              <div className="space-y-1.5">
                <Label>Biaya Operasional/hari</Label>
                <Input type="number" min={0} value={vehForm.operationalCostPerDay} onChange={e => setVehForm(f => ({ ...f, operationalCostPerDay: e.target.value }))} placeholder="0" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={vehForm.status} onValueChange={v => setVehForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(VEH_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setVehOpen(false)}>Batal</Button>
              <Button type="submit" disabled={vehSaving}>{vehSaving ? 'Menyimpan...' : 'Simpan'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Dialog Tambah/Edit Driver ── */}
      <Dialog open={drvOpen} onOpenChange={o => { setDrvOpen(o); if (!o) setDrvEditId(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{drvEditId ? 'Edit Driver' : 'Tambah Driver'}</DialogTitle></DialogHeader>
          <form onSubmit={saveDriver} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nama Driver <span className="text-destructive">*</span></Label>
              <Input value={drvForm.name} onChange={e => setDrvForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label>No. HP <span className="text-muted-foreground text-xs">(opsional)</span></Label>
              <Input value={drvForm.phone} onChange={e => setDrvForm(f => ({ ...f, phone: e.target.value }))} placeholder="08xx..." />
            </div>
            <div className="space-y-1.5">
              <Label>Kendaraan Tetap <span className="text-muted-foreground text-xs">(opsional)</span></Label>
              <Select value={drvForm.assignedVehicleId || 'none'} onValueChange={v => setDrvForm(f => ({ ...f, assignedVehicleId: v === 'none' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Pilih kendaraan..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Tidak ada —</SelectItem>
                  {vehList.filter((v: any) => v.status === 'ACTIVE').map((v: any) => (
                    <SelectItem key={v.id} value={v.id}>{v.plateNumber} ({v.capacitySak} sak)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Driver dengan kendaraan tetap otomatis muncul di operasional harian.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={drvForm.status} onValueChange={v => setDrvForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DRV_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDrvOpen(false)}>Batal</Button>
              <Button type="submit" disabled={drvSaving}>{drvSaving ? 'Menyimpan...' : 'Simpan'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

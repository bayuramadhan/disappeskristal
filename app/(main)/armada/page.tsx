'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import {
  Truck, User, Package, Clock, Plus, X, Settings2, CheckCircle2,
  Navigation2, ArrowRightLeft,
} from 'lucide-react'
import useSWR from 'swr'
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useRole } from '@/hooks/useRole'
import { useToast } from '@/hooks/use-toast'
import { useRayons } from '@/hooks/useCustomers'
import { formatCurrency } from '@/lib/utils'

// ─── SlotSheet: kelola pesanan dalam 1 armada ────────────────────────────────
function SlotSheet({ armada, date, open, onClose, onRefresh }: {
  armada: any; date: string; open: boolean; onClose: () => void; onRefresh: () => void
}) {
  const { toast } = useToast()
  const { canWrite } = useRole()
  const [addOpen, setAddOpen]           = useState(false)
  const [showAllRayon, setShowAllRayon] = useState(false)
  const [assigning, setAssigning]       = useState<string | null>(null)

  const rayonId    = armada?.rayonId
  const rayonParam = (!showAllRayon && rayonId) ? `&rayonId=${rayonId}` : ''

  const { data: unassigned, isLoading: loadingUnassigned } = useSWR(
    addOpen ? `/api/orders?date=${date}&limit=100&status=CONFIRMED${rayonParam}` : null,
    fetcher,
  )
  const unassignedOrders: any[] = (unassigned?.orders ?? unassigned ?? []).filter(
    (o: any) => !o.vehicleId
  )

  async function assign(orderId: string) {
    setAssigning(orderId)
    try {
      const res  = await fetch('/api/armada/assign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, vehicleId: armada.vehicleId }),
      })
      const json = await res.json()
      if (!res.ok) { toast({ title: 'Gagal menambahkan', description: json.message, variant: 'destructive' }); return }
      onRefresh()
      toast({ title: 'Pesanan dimasukkan ke armada', description: json.data?.customer?.name })
    } finally { setAssigning(null) }
  }

  async function unassign(orderId: string, customerName: string) {
    if (!confirm(`Keluarkan pesanan ${customerName} dari armada ini?`)) return
    setAssigning(orderId)
    try {
      const res  = await fetch('/api/armada/assign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, vehicleId: null }),
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
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                    disabled={assigning === o.id} onClick={() => unassign(o.id, o.customer?.name)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
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
                  const sisaSlot  = stats?.sisaSlot ?? 0
                  const cukup     = o.orderedQty <= sisaSlot
                  const slotHabis = sisaSlot === 0
                  const labelTolak = slotHabis ? 'Slot habis' : 'Terlalu besar'
                  return (
                    <div key={o.id} className={`flex items-center gap-3 rounded-lg border p-3 ${!cukup ? 'opacity-50' : ''}`}>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{o.customer?.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {o.deliveryLocation?.namaLokasi ?? '—'}{o.rayon ? ` · ${o.rayon.name}` : ''}
                        </p>
                        <p className="text-xs mt-0.5">
                          <span className="font-semibold">{o.orderedQty} sak</span>
                          {!cukup && !slotHabis && (
                            <span className="text-muted-foreground ml-1">(sisa {sisaSlot} sak)</span>
                          )}
                        </p>
                      </div>
                      <Button size="sm" variant="outline"
                        disabled={!cukup || assigning === o.id}
                        onClick={() => cukup ? assign(o.id) : undefined}
                        className="shrink-0">
                        {assigning === o.id ? '...' : cukup ? 'Masukkan' : labelTolak}
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
          {DatePicker}
          {fleetLoading ? (
            <LoadingState rows={5} />
          ) : fleet.length === 0 ? (
            <EmptyState
              title="Tidak ada armada aktif"
              description="Tidak ada data pengiriman untuk tanggal ini."
            />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kendaraan</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>Helper</TableHead>
                    <TableHead>Rayon</TableHead>
                    <TableHead>Jam Berangkat</TableHead>
                    <TableHead className="text-right">Pesanan</TableHead>
                    <TableHead className="text-right">Terkirim</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fleet.map((f: any) => {
                    // Deteksi perubahan: bandingkan ID aktual vs master
                    const driverChanged = f.masterArmadaDriverId && f.driverId !== f.masterArmadaDriverId
                    const rayonChanged  = f.masterArmadaRayonId  && f.rayonId  !== f.masterArmadaRayonId
                    const helperChanged = f.masterArmadaHelper !== null &&
                                         (f.helperName ?? '') !== (f.masterArmadaHelper ?? '')

                    const deliveredCount = f.orders?.filter((o: any) =>
                      ['DELIVERED', 'PARTIAL'].includes(o.status)
                    ).length ?? 0

                    return (
                      <TableRow key={f.id}>
                        {/* Kendaraan */}
                        <TableCell>
                          <span className="flex items-center gap-1.5 font-mono font-medium text-sm">
                            <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                            {f.vehicle?.plateNumber}
                          </span>
                          <span className="text-xs text-muted-foreground">{f.vehicle?.capacitySak} sak</span>
                        </TableCell>

                        {/* Driver — highlight jika berbeda dari master */}
                        <TableCell>
                          {driverChanged ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="flex items-center gap-1 text-amber-600 font-medium text-sm cursor-default">
                                    <ArrowRightLeft className="h-3 w-3 shrink-0" />
                                    {f.driver?.name ?? '—'}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  <p className="text-xs">Default driver berbeda dari hari ini</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <span className="text-sm">{f.driver?.name ?? '—'}</span>
                          )}
                        </TableCell>

                        {/* Helper */}
                        <TableCell>
                          {helperChanged ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="flex items-center gap-1 text-amber-600 font-medium text-sm cursor-default">
                                    <ArrowRightLeft className="h-3 w-3 shrink-0" />
                                    {f.helperName || '—'}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  <p className="text-xs">Default: {f.masterArmadaHelper || '(tidak ada)'}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <span className="text-sm text-muted-foreground">{f.helperName || '—'}</span>
                          )}
                        </TableCell>

                        {/* Rayon */}
                        <TableCell>
                          {rayonChanged ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="flex items-center gap-1 text-amber-600 font-medium text-sm cursor-default">
                                    <ArrowRightLeft className="h-3 w-3 shrink-0" />
                                    {f.rayon?.name ?? '—'}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  <p className="text-xs">Rayon default berbeda dari hari ini</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <span className="text-sm">{f.rayon?.name ?? '—'}</span>
                          )}
                        </TableCell>

                        {/* Jam berangkat */}
                        <TableCell className="text-sm text-muted-foreground">
                          {f.departureTime
                            ? format(new Date(f.departureTime), 'HH:mm')
                            : <span className="italic">—</span>}
                        </TableCell>

                        {/* Jumlah pesanan */}
                        <TableCell className="text-right">
                          <span className="font-semibold text-sm">{f.stats?.totalOrders ?? 0}</span>
                          <span className="text-xs text-muted-foreground ml-1">({f.stats?.totalAssigned ?? 0} sak)</span>
                        </TableCell>

                        {/* Terkirim */}
                        <TableCell className="text-right">
                          <span className={`font-semibold text-sm ${deliveredCount === f.stats?.totalOrders && deliveredCount > 0 ? 'text-emerald-600' : ''}`}>
                            {deliveredCount}/{f.stats?.totalOrders ?? 0}
                          </span>
                        </TableCell>

                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Keterangan perubahan */}
          <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
            <ArrowRightLeft className="h-3 w-3 text-amber-500" />
            Ikon oranye menandakan perubahan dari default master armada pada hari ini.
          </p>
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

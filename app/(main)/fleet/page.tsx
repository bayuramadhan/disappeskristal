'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Plus, Truck, User, Package, MapPin, Clock, ChevronDown, Trash2 } from 'lucide-react'
import { useFleet, useVehicles, useDrivers } from '@/hooks/useFleet'
import { useRayons } from '@/hooks/useCustomers'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingCards } from '@/components/shared/LoadingState'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { mutate } from 'swr'
import { useRole } from '@/hooks/useRole'
import { useToast } from '@/hooks/use-toast'

export default function FleetPage() {
  const today = format(new Date(), 'yyyy-MM-dd')
  const [date, setDate] = useState(today)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ vehicleId: '', driverId: '', rayonId: '', helperName: '', date, initialLoad: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Update dialog state
  const [updateOpen, setUpdateOpen] = useState(false)
  const [updateTarget, setUpdateTarget] = useState<any>(null)
  const [updateForm, setUpdateForm] = useState({ remainingLoad: '', departureTime: '' })
  const [updating, setUpdating] = useState(false)

  const { canWrite } = useRole()
  const { toast } = useToast()
  const { data: fleet, isLoading } = useFleet(date)
  const { data: vehicles } = useVehicles()
  const { data: drivers } = useDrivers()
  const { data: rayons } = useRayons()

  const fleetKey = `/api/fleet?date=${date}`

  async function handleActivate(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/fleet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          initialLoad: Number(form.initialLoad),
          helperName: form.helperName || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.message ?? 'Gagal mengaktifkan armada')
      } else {
        setOpen(false)
        mutate(fleetKey)
        setForm({ vehicleId: '', driverId: '', rayonId: '', helperName: '', date, initialLoad: '' })
        const v = (vehicles ?? []).find((v: any) => v.id === form.vehicleId)
        toast({ title: 'Armada diaktifkan', description: v?.plateNumber ?? 'Kendaraan berhasil diaktifkan' })
      }
    } finally {
      setSubmitting(false)
    }
  }

  function openUpdate(f: any) {
    setUpdateTarget(f)
    setUpdateForm({
      remainingLoad: String(f.remainingLoad ?? f.initialLoad),
      departureTime: f.departureTime ? format(new Date(f.departureTime), "yyyy-MM-dd'T'HH:mm") : '',
    })
    setUpdateOpen(true)
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!updateTarget) return
    setUpdating(true)
    try {
      const body: Record<string, any> = {}
      if (updateForm.remainingLoad !== '') body.remainingLoad = Number(updateForm.remainingLoad)
      if (updateForm.departureTime) body.departureTime = updateForm.departureTime

      const res = await fetch(`/api/fleet/${updateTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) {
        toast({ title: 'Gagal memperbarui', description: json.message, variant: 'destructive' })
      } else {
        setUpdateOpen(false)
        mutate(fleetKey)
        toast({ title: 'Armada diperbarui', description: updateTarget.vehicle?.plateNumber })
      }
    } finally {
      setUpdating(false)
    }
  }

  async function handleDeactivate(f: any) {
    if (!confirm(`Nonaktifkan armada ${f.vehicle?.plateNumber ?? ''}?`)) return
    const res = await fetch(`/api/fleet/${f.id}`, { method: 'DELETE' })
    const json = await res.json()
    if (!res.ok) {
      toast({ title: 'Gagal menonaktifkan', description: json.message, variant: 'destructive' })
    } else {
      mutate(fleetKey)
      toast({ title: 'Armada dinonaktifkan', description: f.vehicle?.plateNumber })
    }
  }

  return (
    <div>
      <PageHeader
        title="Armada"
        description="Status armada dan aktivasi kendaraan harian"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            {canWrite && (
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5">
                  <Plus className="h-4 w-4" /> Aktifkan Armada
                </Button>
              </DialogTrigger>
            )}
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>Aktifkan Armada</DialogTitle></DialogHeader>
              <form onSubmit={handleActivate} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Kendaraan <span className="text-destructive">*</span></Label>
                  <Select value={form.vehicleId} onValueChange={v => setForm(f => ({ ...f, vehicleId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Pilih kendaraan..." /></SelectTrigger>
                    <SelectContent>
                      {(vehicles ?? []).filter((v: any) => v.status === 'ACTIVE').map((v: any) => (
                        <SelectItem key={v.id} value={v.id}>{v.plateNumber} — {v.capacitySak} sak</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Driver <span className="text-destructive">*</span></Label>
                  <Select value={form.driverId} onValueChange={v => setForm(f => ({ ...f, driverId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Pilih driver..." /></SelectTrigger>
                    <SelectContent>
                      {(drivers ?? []).filter((d: any) => d.status === 'ACTIVE').map((d: any) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Rayon <span className="text-destructive">*</span></Label>
                  <Select value={form.rayonId} onValueChange={v => setForm(f => ({ ...f, rayonId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Pilih rayon..." /></SelectTrigger>
                    <SelectContent>
                      {(rayons ?? []).map((r: any) => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Muatan Awal (sak) <span className="text-destructive">*</span></Label>
                  <Input type="number" min={1} value={form.initialLoad} onChange={e => setForm(f => ({ ...f, initialLoad: e.target.value }))} placeholder="0" required />
                </div>
                <div className="space-y-1.5">
                  <Label>Nama Helper <span className="text-muted-foreground text-xs">(opsional)</span></Label>
                  <Input value={form.helperName} onChange={e => setForm(f => ({ ...f, helperName: e.target.value }))} placeholder="Nama kenek / helper" />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button>
                  <Button type="submit" disabled={submitting || !form.vehicleId || !form.driverId || !form.rayonId || !form.initialLoad}>
                    {submitting ? 'Menyimpan...' : 'Aktifkan'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Update dialog */}
      <Dialog open={updateOpen} onOpenChange={setUpdateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Perbarui Armada — {updateTarget?.vehicle?.plateNumber}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Waktu Berangkat <span className="text-muted-foreground text-xs">(opsional)</span></Label>
              <Input
                type="datetime-local"
                value={updateForm.departureTime}
                onChange={e => setUpdateForm(f => ({ ...f, departureTime: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Sisa Muatan (sak)</Label>
              <Input
                type="number"
                min={0}
                max={updateTarget?.initialLoad}
                value={updateForm.remainingLoad}
                onChange={e => setUpdateForm(f => ({ ...f, remainingLoad: e.target.value }))}
                required
              />
              <p className="text-xs text-muted-foreground">Muatan awal: {updateTarget?.initialLoad} sak</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setUpdateOpen(false)}>Batal</Button>
              <Button type="submit" disabled={updating}>{updating ? 'Menyimpan...' : 'Simpan'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Date filter */}
      <div className="flex items-center gap-3 mb-6">
        <Label className="text-sm shrink-0">Tanggal</Label>
        <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-40 h-8 text-sm" />
        <Button variant="ghost" size="sm" onClick={() => setDate(today)} className="h-8 text-xs">Hari Ini</Button>
      </div>

      {isLoading ? (
        <LoadingCards count={4} />
      ) : !fleet?.length ? (
        <EmptyState
          title="Tidak ada armada aktif"
          description={`Belum ada kendaraan yang diaktifkan untuk ${format(new Date(date + 'T00:00:00'), 'dd/MM/yyyy')}.`}
          action={canWrite ? (
            <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" /> Aktifkan Sekarang
            </Button>
          ) : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {fleet.map((f: any) => {
            const loadPct = f.initialLoad > 0
              ? Math.round(((f.initialLoad - (f.remainingLoad ?? 0)) / f.initialLoad) * 100)
              : 0
            return (
              <Card key={f.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Truck className="h-5 w-5 text-sky-600" />
                      <div>
                        <CardTitle className="text-base">{f.vehicle?.plateNumber ?? '-'}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">{f.rayon?.name ?? '-'}</p>
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
                    <span>{f.driver?.name ?? '-'}</span>
                    {f.helperName && <span className="text-muted-foreground text-xs">+ {f.helperName}</span>}
                  </div>
                  {f.departureTime && (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>Berangkat {format(new Date(f.departureTime), 'HH:mm')}</span>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Muatan terpakai</span>
                      <span className="font-medium">{f.initialLoad - (f.remainingLoad ?? 0)} / {f.initialLoad} sak</span>
                    </div>
                    <Progress value={loadPct} className="h-2" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>Sisa: <span className="font-semibold">{f.remainingLoad ?? f.initialLoad} sak</span></span>
                    </div>
                    {f.stats && (
                      <span className="text-xs text-muted-foreground">
                        {f.stats.deliveredOrders}/{f.stats.totalOrders} pesanan
                      </span>
                    )}
                  </div>
                  {canWrite && (
                    <div className="flex gap-2 pt-1 border-t">
                      <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => openUpdate(f)}>
                        <ChevronDown className="h-3.5 w-3.5 mr-1" /> Perbarui
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        onClick={() => handleDeactivate(f)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

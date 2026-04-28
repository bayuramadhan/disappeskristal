'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Plus, Truck, User, Package, AlertCircle } from 'lucide-react'
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

export default function FleetPage() {
  const today = format(new Date(), 'yyyy-MM-dd')
  const [date, setDate] = useState(today)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ vehicleId: '', driverId: '', rayonId: '', date, initialLoad: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const { canWrite } = useRole()
  const { data: fleet, isLoading } = useFleet(date)
  const { data: vehicles } = useVehicles()
  const { data: drivers } = useDrivers()
  const { data: rayons } = useRayons()

  async function handleActivate(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/fleet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, initialLoad: Number(form.initialLoad) }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.message ?? 'Gagal mengaktifkan armada')
      } else {
        setOpen(false)
        mutate(`/api/fleet?date=${date}`)
        setForm({ vehicleId: '', driverId: '', rayonId: '', date, initialLoad: '' })
      }
    } finally {
      setSubmitting(false)
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
                  <Label>Kendaraan</Label>
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
                  <Label>Driver</Label>
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
                  <Label>Rayon</Label>
                  <Select value={form.rayonId} onValueChange={v => setForm(f => ({ ...f, rayonId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Pilih rayon..." /></SelectTrigger>
                    <SelectContent>
                      {(rayons?.data ?? []).map((r: any) => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Muatan Awal (sak)</Label>
                  <Input type="number" min={1} value={form.initialLoad} onChange={e => setForm(f => ({ ...f, initialLoad: e.target.value }))} required />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button>
                  <Button type="submit" disabled={submitting || !form.vehicleId || !form.driverId || !form.rayonId}>
                    {submitting ? 'Menyimpan...' : 'Aktifkan'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

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
            const loadPct = f.initialLoad > 0 ? Math.round(((f.initialLoad - (f.remainingLoad ?? 0)) / f.initialLoad) * 100) : 0
            return (
              <Card key={f.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Truck className="h-5 w-5 text-sky-600" />
                      <div>
                        <CardTitle className="text-base">{f.vehicle?.plateNumber ?? '-'}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">{f.vehicle?.vehicleType ?? ''}</p>
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
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Muatan terpakai</span>
                      <span className="font-medium">{f.initialLoad - (f.remainingLoad ?? 0)} / {f.initialLoad} sak</span>
                    </div>
                    <Progress value={loadPct} className="h-2" />
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>Sisa: <span className="font-semibold">{f.remainingLoad ?? f.initialLoad} sak</span></span>
                  </div>
                  {f._count && (
                    <p className="text-xs text-muted-foreground">{f._count.orders} pesanan terkait</p>
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

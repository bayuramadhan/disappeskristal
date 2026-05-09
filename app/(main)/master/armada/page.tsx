'use client'

import { useState } from 'react'
import { Truck, User, Plus, Pencil, Trash2, Search, Link2, MapPin, Users2 } from 'lucide-react'
import useSWR, { mutate as globalMutate } from 'swr'
import { fetcher } from '@/lib/fetcher'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingState } from '@/components/shared/LoadingState'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useRole } from '@/hooks/useRole'
import { useToast } from '@/hooks/use-toast'

const VEH_STATUS_LABELS: Record<string, string>  = { ACTIVE: 'Aktif', INACTIVE: 'Nonaktif', MAINTENANCE: 'Perawatan' }
const VEH_STATUS_VARIANTS: Record<string, any>   = { ACTIVE: 'success', MAINTENANCE: 'warning', INACTIVE: 'secondary' }
const DRV_STATUS_LABELS: Record<string, string>  = { ACTIVE: 'Aktif', INACTIVE: 'Nonaktif', ON_LEAVE: 'Cuti' }
const DRV_STATUS_VARIANTS: Record<string, any>   = { ACTIVE: 'success', ON_LEAVE: 'warning', INACTIVE: 'secondary' }

// ─── Keys SWR ─────────────────────────────────────────────────────────────────
const ARMADA_KEY = '/api/armada?activeOnly=false'

export default function MasterArmadaPage() {
  // ── Shared data
  const { canWrite, isAdmin } = useRole()
  const { toast }             = useToast()

  // ── Kendaraan state
  const [vehSearch, setVehSearch]   = useState('')
  const [vehOpen, setVehOpen]       = useState(false)
  const [vehEditId, setVehEditId]   = useState<string | null>(null)
  const [vehForm, setVehForm]       = useState({ plateNumber: '', capacitySak: '', operationalCostPerDay: '', status: 'ACTIVE' })
  const [vehSaving, setVehSaving]   = useState(false)

  // ── Driver state
  const [drvSearch, setDrvSearch]   = useState('')
  const [drvOpen, setDrvOpen]       = useState(false)
  const [drvEditId, setDrvEditId]   = useState<string | null>(null)
  const [drvForm, setDrvForm]       = useState({ name: '', phone: '', status: 'ACTIVE' })
  const [drvSaving, setDrvSaving]   = useState(false)

  // ── Armada state
  const [armSearch, setArmSearch]   = useState('')
  const [armOpen, setArmOpen]       = useState(false)
  const [armEditId, setArmEditId]   = useState<string | null>(null)
  const [armForm, setArmForm]       = useState({
    vehicleId: '', driverId: '', helperName: '', rayonId: '', activeStatus: true, notes: '',
  })
  const [armSaving, setArmSaving]   = useState(false)

  // ── SWR
  const vehKey = `/api/vehicles?limit=100${vehSearch ? `&search=${encodeURIComponent(vehSearch)}` : ''}`
  const drvKey = `/api/drivers?limit=100${drvSearch ? `&search=${encodeURIComponent(drvSearch)}` : ''}`

  const { data: vehicles,    isLoading: vehLoading } = useSWR(vehKey, fetcher)
  const { data: drivers,     isLoading: drvLoading  } = useSWR(drvKey, fetcher)
  const { data: armadaData,  isLoading: armLoading  } = useSWR(ARMADA_KEY, fetcher)
  // Fetch all vehicles & drivers (no search filter) for form dropdowns
  const { data: allVehicles } = useSWR('/api/vehicles?limit=200', fetcher)
  const { data: allDrivers  } = useSWR('/api/drivers?limit=200', fetcher)
  const { data: allRayons   } = useSWR('/api/rayons', fetcher)

  const vehList: any[]    = vehicles?.data    ?? vehicles    ?? []
  const drvList: any[]    = drivers?.data     ?? drivers     ?? []
  const armadaList: any[] = armadaData?.data  ?? armadaData  ?? []
  const allVehList: any[] = allVehicles?.data ?? allVehicles ?? []
  const allDrvList: any[] = allDrivers?.data  ?? allDrivers  ?? []
  const rayonList: any[]  = allRayons?.data   ?? allRayons   ?? []

  // Filter armada by search
  const filteredArmada = armSearch
    ? armadaList.filter((a: any) =>
        a.vehicle?.plateNumber?.toLowerCase().includes(armSearch.toLowerCase()) ||
        a.driver?.name?.toLowerCase().includes(armSearch.toLowerCase()) ||
        a.helperName?.toLowerCase().includes(armSearch.toLowerCase())
      )
    : armadaList

  // ─── Armada CRUD ───────────────────────────────────────────────────────────
  function openArmCreate() {
    setArmEditId(null)
    setArmForm({ vehicleId: '', driverId: '', helperName: '', rayonId: '', activeStatus: true, notes: '' })
    setArmOpen(true)
  }
  function openArmEdit(a: any) {
    setArmEditId(a.id)
    setArmForm({
      vehicleId:    a.vehicleId,
      driverId:     a.driverId,
      helperName:   a.helperName ?? '',
      rayonId:      a.rayonId    ?? '',
      activeStatus: a.activeStatus,
      notes:        a.notes      ?? '',
    })
    setArmOpen(true)
  }
  async function saveArmada(e: React.FormEvent) {
    e.preventDefault(); setArmSaving(true)
    try {
      const body = {
        vehicleId:    armForm.vehicleId,
        driverId:     armForm.driverId,
        helperName:   armForm.helperName  || undefined,
        rayonId:      armForm.rayonId     || undefined,
        activeStatus: armForm.activeStatus,
        notes:        armForm.notes       || undefined,
      }
      const res  = armEditId
        ? await fetch(`/api/armada/${armEditId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        : await fetch('/api/armada',              { method: 'POST',  headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const json = await res.json()
      if (!res.ok) { toast({ title: 'Gagal menyimpan', description: json.message, variant: 'destructive' }); return }
      setArmOpen(false); globalMutate(ARMADA_KEY)
      const plate = allVehList.find((v: any) => v.id === armForm.vehicleId)?.plateNumber ?? ''
      toast({ title: armEditId ? 'Armada diperbarui' : 'Armada ditambahkan', description: plate })
    } finally { setArmSaving(false) }
  }
  async function deleteArmada(id: string, label: string) {
    if (!confirm(`Hapus armada ${label}?`)) return
    const res  = await fetch(`/api/armada/${id}`, { method: 'DELETE' })
    const json = await res.json()
    if (!res.ok) { toast({ title: 'Gagal menghapus', description: json.message, variant: 'destructive' }); return }
    globalMutate(ARMADA_KEY); toast({ title: 'Armada dihapus', description: label })
  }

  // ─── Kendaraan CRUD ────────────────────────────────────────────────────────
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
        : await fetch('/api/vehicles',              { method: 'POST',  headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
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

  // ─── Driver CRUD ───────────────────────────────────────────────────────────
  function openDrvCreate() {
    setDrvEditId(null)
    setDrvForm({ name: '', phone: '', status: 'ACTIVE' })
    setDrvOpen(true)
  }
  function openDrvEdit(d: any) {
    setDrvEditId(d.id)
    setDrvForm({ name: d.name, phone: d.phone ?? '', status: d.status })
    setDrvOpen(true)
  }
  async function saveDriver(e: React.FormEvent) {
    e.preventDefault(); setDrvSaving(true)
    try {
      const body = { ...drvForm }
      const res  = drvEditId
        ? await fetch(`/api/drivers/${drvEditId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        : await fetch('/api/drivers',              { method: 'POST',  headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
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
    <div className="space-y-6">
      <PageHeader
        title="Master Armada"
        description="Kelola armada (pairing driver-kendaraan), data kendaraan, dan data driver."
      />

      <Tabs defaultValue="armada">
        <TabsList className="mb-4">
          <TabsTrigger value="armada" className="gap-2">
            <Link2 className="h-4 w-4" /> Armada
          </TabsTrigger>
          <TabsTrigger value="kendaraan" className="gap-2">
            <Truck className="h-4 w-4" /> Kendaraan
          </TabsTrigger>
          <TabsTrigger value="driver" className="gap-2">
            <Users2 className="h-4 w-4" /> Driver
          </TabsTrigger>
        </TabsList>

        {/* ══ TAB: ARMADA ══════════════════════════════════════════════════════ */}
        <TabsContent value="armada" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Pasangkan driver dengan kendaraan. Armada aktif otomatis muncul di Operasional Harian.
              </p>
            </div>
            {canWrite && (
              <Button size="sm" className="gap-1.5" onClick={openArmCreate}>
                <Plus className="h-4 w-4" /> Tambah Armada
              </Button>
            )}
          </div>
          <div className="relative max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={armSearch} onChange={e => setArmSearch(e.target.value)} placeholder="Cari plat / nama driver..." className="pl-9 h-8 text-sm" />
          </div>
          <Card>
            <CardContent className="p-0">
              {armLoading ? (
                <div className="p-4"><LoadingState rows={4} /></div>
              ) : filteredArmada.length === 0 ? (
                <EmptyState title="Belum ada armada" description="Tambahkan armada baru untuk memulai." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kendaraan</TableHead>
                      <TableHead>Driver</TableHead>
                      <TableHead>Helper</TableHead>
                      <TableHead>Rayon Default</TableHead>
                      <TableHead>Status</TableHead>
                      {canWrite && <TableHead />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredArmada.map((a: any) => (
                      <TableRow key={a.id}>
                        <TableCell>
                          <span className="flex items-center gap-1.5 font-mono font-medium text-sm">
                            <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                            {a.vehicle?.plateNumber ?? '—'}
                          </span>
                          <span className="text-xs text-muted-foreground">{a.vehicle?.capacitySak} sak</span>
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1.5 text-sm">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            {a.driver?.name ?? '—'}
                          </span>
                          {a.driver?.phone && <span className="text-xs text-muted-foreground">{a.driver.phone}</span>}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {a.helperName ?? <span className="italic">—</span>}
                        </TableCell>
                        <TableCell>
                          {a.rayon
                            ? <span className="flex items-center gap-1 text-sm"><MapPin className="h-3.5 w-3.5 text-muted-foreground" />{a.rayon.name}</span>
                            : <span className="text-muted-foreground text-sm italic">—</span>}
                        </TableCell>
                        <TableCell>
                          <Badge variant={a.activeStatus ? 'success' : 'secondary'}>
                            {a.activeStatus ? 'Aktif' : 'Nonaktif'}
                          </Badge>
                        </TableCell>
                        {canWrite && (
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openArmEdit(a)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              {isAdmin && (
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                                  onClick={() => deleteArmada(a.id, `${a.vehicle?.plateNumber} / ${a.driver?.name}`)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
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
        </TabsContent>

        {/* ══ TAB: KENDARAAN ═══════════════════════════════════════════════════ */}
        <TabsContent value="kendaraan" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Kapasitas kendaraan = jumlah slot sak yang tersedia per hari.
            </p>
            {canWrite && (
              <Button size="sm" className="gap-1.5" onClick={openVehCreate}>
                <Plus className="h-4 w-4" /> Tambah Kendaraan
              </Button>
            )}
          </div>
          <div className="relative max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={vehSearch} onChange={e => setVehSearch(e.target.value)} placeholder="Cari plat..." className="pl-9 h-8 text-sm" />
          </div>
          <Card>
            <CardContent className="p-0">
              {vehLoading ? (
                <div className="p-4"><LoadingState rows={4} /></div>
              ) : vehList.length === 0 ? (
                <EmptyState title="Belum ada kendaraan" description="Tambahkan kendaraan pertama." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Plat Nomor</TableHead>
                      <TableHead className="text-right">Kapasitas (sak)</TableHead>
                      <TableHead className="text-right">Biaya/hari (Rp)</TableHead>
                      <TableHead>Status</TableHead>
                      {canWrite && <TableHead />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vehList.map((v: any) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-mono font-medium">{v.plateNumber}</TableCell>
                        <TableCell className="text-right font-semibold">{v.capacitySak}</TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {v.operationalCostPerDay > 0 ? v.operationalCostPerDay.toLocaleString('id-ID') : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={VEH_STATUS_VARIANTS[v.status]}>{VEH_STATUS_LABELS[v.status] ?? v.status}</Badge>
                        </TableCell>
                        {canWrite && (
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openVehEdit(v)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              {isAdmin && (
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                                  onClick={() => deleteVehicle(v.id, v.plateNumber)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
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
        </TabsContent>

        {/* ══ TAB: DRIVER ══════════════════════════════════════════════════════ */}
        <TabsContent value="driver" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Driver berdiri sendiri. Pasangkan ke kendaraan lewat tab Armada.
            </p>
            {canWrite && (
              <Button size="sm" className="gap-1.5" onClick={openDrvCreate}>
                <Plus className="h-4 w-4" /> Tambah Driver
              </Button>
            )}
          </div>
          <div className="relative max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={drvSearch} onChange={e => setDrvSearch(e.target.value)} placeholder="Cari nama driver..." className="pl-9 h-8 text-sm" />
          </div>
          <Card>
            <CardContent className="p-0">
              {drvLoading ? (
                <div className="p-4"><LoadingState rows={4} /></div>
              ) : drvList.length === 0 ? (
                <EmptyState title="Belum ada driver" description="Tambahkan driver pertama." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama Driver</TableHead>
                      <TableHead>No. HP</TableHead>
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
                          <Badge variant={DRV_STATUS_VARIANTS[d.status]}>{DRV_STATUS_LABELS[d.status] ?? d.status}</Badge>
                        </TableCell>
                        {canWrite && (
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openDrvEdit(d)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              {isAdmin && (
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                                  onClick={() => deleteDriver(d.id, d.name)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
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
        </TabsContent>
      </Tabs>

      {/* ── Dialog Tambah/Edit Armada ─────────────────────────────────────────── */}
      <Dialog open={armOpen} onOpenChange={o => { setArmOpen(o); if (!o) setArmEditId(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{armEditId ? 'Edit Armada' : 'Tambah Armada'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveArmada} className="space-y-4">
            {/* Kendaraan */}
            <div className="space-y-1.5">
              <Label>Kendaraan <span className="text-destructive">*</span></Label>
              <Select value={armForm.vehicleId || 'none'} onValueChange={v => setArmForm(f => ({ ...f, vehicleId: v === 'none' ? '' : v }))} required>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih kendaraan..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" disabled>— Pilih kendaraan —</SelectItem>
                  {allVehList.filter((v: any) => v.status === 'ACTIVE').map((v: any) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.plateNumber} <span className="text-muted-foreground">({v.capacitySak} sak)</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Driver */}
            <div className="space-y-1.5">
              <Label>Driver <span className="text-destructive">*</span></Label>
              <Select value={armForm.driverId || 'none'} onValueChange={v => setArmForm(f => ({ ...f, driverId: v === 'none' ? '' : v }))} required>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih driver..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" disabled>— Pilih driver —</SelectItem>
                  {allDrvList.filter((d: any) => d.status === 'ACTIVE').map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Helper */}
            <div className="space-y-1.5">
              <Label>Nama Helper <span className="text-muted-foreground text-xs">(opsional)</span></Label>
              <Input
                value={armForm.helperName}
                onChange={e => setArmForm(f => ({ ...f, helperName: e.target.value }))}
                placeholder="Nama kenek / helper..."
              />
            </div>

            {/* Rayon default */}
            <div className="space-y-1.5">
              <Label>Rayon Keberangkatan <span className="text-muted-foreground text-xs">(opsional)</span></Label>
              <Select value={armForm.rayonId || 'none'} onValueChange={v => setArmForm(f => ({ ...f, rayonId: v === 'none' ? '' : v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih rayon..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Tidak ada —</SelectItem>
                  {rayonList.map((r: any) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Rayon default yang digunakan saat armada berangkat harian.</p>
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={armForm.activeStatus ? 'true' : 'false'} onValueChange={v => setArmForm(f => ({ ...f, activeStatus: v === 'true' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Aktif</SelectItem>
                  <SelectItem value="false">Nonaktif</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Catatan */}
            <div className="space-y-1.5">
              <Label>Catatan <span className="text-muted-foreground text-xs">(opsional)</span></Label>
              <Input
                value={armForm.notes}
                onChange={e => setArmForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Catatan tambahan..."
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setArmOpen(false)}>Batal</Button>
              <Button type="submit" disabled={armSaving || !armForm.vehicleId || !armForm.driverId}>
                {armSaving ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Dialog Tambah/Edit Kendaraan ─────────────────────────────────────── */}
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

      {/* ── Dialog Tambah/Edit Driver ─────────────────────────────────────────── */}
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

'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { format } from 'date-fns'
import {
  ArrowLeft, Phone, Tag, ShoppingBag, Plus, Pencil, Trash2,
  MapPin, Star, CheckCircle2,
} from 'lucide-react'
import { useCustomer } from '@/hooks/useCustomers'
import { useRayons } from '@/hooks/useCustomers'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ChannelTag } from '@/components/shared/ChannelTag'
import { LoadingState } from '@/components/shared/LoadingState'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency } from '@/lib/utils'
import { mutate } from 'swr'
import { useRole } from '@/hooks/useRole'
import { useToast } from '@/hooks/use-toast'

const emptyLocForm = { namaLokasi: '', alamat: '', rayonId: '', isDefault: false }

export default function CustomerDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const router   = useRouter()
  const { canManage } = useRole()
  const { toast } = useToast()

  const { data: customer, isLoading, error } = useCustomer(id)
  const { data: rayons } = useRayons()

  // ── Location dialog state ──────────────────────────────────────
  const [locOpen, setLocOpen]     = useState(false)
  const [editLocId, setEditLocId] = useState<string | null>(null)
  const [locForm, setLocForm]     = useState(emptyLocForm)
  const [locError, setLocError]   = useState('')
  const [locSaving, setLocSaving] = useState(false)

  if (isLoading) return <div className="p-6"><LoadingState rows={6} /></div>
  if (error || !customer) return (
    <div className="text-center py-16">
      <p className="text-muted-foreground">Pelanggan tidak ditemukan</p>
      <Button variant="ghost" className="mt-4" onClick={() => router.back()}>Kembali</Button>
    </div>
  )

  const stats    = customer.stats
  const orders   = customer.recentOrders ?? []
  const locations: any[] = customer.locations ?? []
  const rayonList = rayons ?? []
  const apiKey   = `/api/customers/${id}`

  // ── Location handlers ──────────────────────────────────────────
  function openAddLoc() {
    setEditLocId(null)
    setLocForm(emptyLocForm)
    setLocError('')
    setLocOpen(true)
  }

  function openEditLoc(loc: any) {
    setEditLocId(loc.id)
    setLocForm({
      namaLokasi: loc.namaLokasi,
      alamat:     loc.alamat     ?? '',
      rayonId:    loc.rayonId    ?? '',
      isDefault:  loc.isDefault,
    })
    setLocError('')
    setLocOpen(true)
  }

  async function handleSaveLoc(e: React.FormEvent) {
    e.preventDefault()
    setLocSaving(true); setLocError('')
    try {
      const body = {
        namaLokasi: locForm.namaLokasi,
        alamat:     locForm.alamat   || undefined,
        rayonId:    locForm.rayonId  || undefined,
        isDefault:  locForm.isDefault,
      }
      const url    = editLocId
        ? `/api/customers/${id}/locations/${editLocId}`
        : `/api/customers/${id}/locations`
      const method = editLocId ? 'PATCH' : 'POST'
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const json   = await res.json()
      if (!res.ok) { setLocError(json.message ?? 'Gagal menyimpan'); return }
      setLocOpen(false)
      mutate(apiKey)
      toast({ title: editLocId ? 'Lokasi diperbarui' : 'Lokasi ditambahkan', description: locForm.namaLokasi })
    } finally { setLocSaving(false) }
  }

  async function handleDeleteLoc(locId: string, namaLokasi: string) {
    if (!confirm(`Hapus lokasi "${namaLokasi}"?`)) return
    const res  = await fetch(`/api/customers/${id}/locations/${locId}`, { method: 'DELETE' })
    const json = await res.json()
    if (!res.ok) { toast({ title: 'Gagal menghapus', description: json.message, variant: 'destructive' }); return }
    mutate(apiKey)
    toast({ title: 'Lokasi dihapus', description: namaLokasi })
  }

  async function handleSetDefault(locId: string) {
    const res  = await fetch(`/api/customers/${id}/locations/${locId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isDefault: true }),
    })
    if (!res.ok) { toast({ title: 'Gagal', variant: 'destructive' }); return }
    mutate(apiKey)
    toast({ title: 'Lokasi default diperbarui' })
  }

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold">{customer.name}</h1>
          <p className="text-sm text-muted-foreground">Detail pelanggan</p>
        </div>
      </div>

      {/* ── Info utama ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <Tag className="h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Tipe & Status</p>
              <div className="flex gap-1.5 mt-0.5 flex-wrap">
                <Badge variant="secondary">{customer.customerType}</Badge>
                <Badge variant={customer.activeStatus ? 'success' : 'destructive'}>
                  {customer.activeStatus ? 'Aktif' : 'Nonaktif'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <Phone className="h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">No. HP</p>
              <p className="font-medium">{customer.phone ?? '-'}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <ShoppingBag className="h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Harga Default</p>
              <p className="font-medium">{formatCurrency(customer.defaultPrice ?? 0)}/sak</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Statistik ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Total Pesanan',    value: stats?.totalOrders       ?? 0,  unit: 'pesanan' },
          { label: 'Total Terkirim',   value: stats?.totalDeliveredQty ?? 0,  unit: 'sak'     },
          { label: 'Total Retur',      value: stats?.totalReturnedQty  ?? 0,  unit: 'sak'     },
          { label: 'Total Pendapatan', value: formatCurrency(stats?.totalRevenue ?? 0), unit: '' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold mt-1">{s.value}</p>
              {s.unit && <p className="text-xs text-muted-foreground">{s.unit}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Lokasi Pengiriman ─────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" /> Lokasi Pengiriman
            <Badge variant="secondary" className="ml-1">{locations.length}</Badge>
          </CardTitle>
          {canManage && (
            <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={openAddLoc}>
              <Plus className="h-3.5 w-3.5" /> Tambah Lokasi
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {locations.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6">Belum ada lokasi terdaftar.</p>
          ) : (
            <div className="divide-y">
              {locations.map((loc: any) => (
                <div key={loc.id} className="flex items-start justify-between px-6 py-3 gap-4">
                  <div className="flex items-start gap-2 min-w-0">
                    {loc.isDefault
                      ? <Star className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" fill="currentColor" />
                      : <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    }
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{loc.namaLokasi}
                        {loc.isDefault && <span className="ml-2 text-xs text-amber-600 font-normal">default</span>}
                      </p>
                      {loc.alamat && <p className="text-xs text-muted-foreground">{loc.alamat}</p>}
                      {loc.rayon  && <Badge variant="outline" className="mt-1 text-xs h-5">{loc.rayon.name}</Badge>}
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1 shrink-0">
                      {!loc.isDefault && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Jadikan default"
                          onClick={() => handleSetDefault(loc.id)}>
                          <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditLoc(loc)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {!loc.isDefault && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteLoc(loc.id, loc.namaLokasi)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Riwayat Pesanan ───────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Riwayat Pesanan (20 Terakhir)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6">Belum ada riwayat pesanan.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No. Pesanan</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Lokasi</TableHead>
                  <TableHead>Tanggal Kirim</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Nilai</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o: any) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs">{o.orderNumber ?? '-'}</TableCell>
                    <TableCell><ChannelTag channel={o.orderChannel} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {o.deliveryLocation?.namaLokasi ?? '-'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {o.deliveryDate ? format(new Date(o.deliveryDate), 'dd/MM/yyyy') : '-'}
                    </TableCell>
                    <TableCell className="text-right text-sm">{o.orderedQty} sak</TableCell>
                    <TableCell className="text-right text-sm">
                      {formatCurrency((o.deliveredQty ?? 0) * o.pricePerUnit)}
                    </TableCell>
                    <TableCell><StatusBadge status={o.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Dialog Tambah / Edit Lokasi ───────────────────────────── */}
      <Dialog open={locOpen} onOpenChange={o => { setLocOpen(o); if (!o) setLocError('') }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editLocId ? 'Edit Lokasi' : 'Tambah Lokasi'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveLoc} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nama Lokasi / Toko <span className="text-destructive">*</span></Label>
              <Input value={locForm.namaLokasi} required
                onChange={e => setLocForm(f => ({ ...f, namaLokasi: e.target.value }))}
                placeholder="cth. Toko Cabang Timur" />
            </div>
            <div className="space-y-1.5">
              <Label>Alamat</Label>
              <Input value={locForm.alamat}
                onChange={e => setLocForm(f => ({ ...f, alamat: e.target.value }))}
                placeholder="Jl. ..." />
            </div>
            <div className="space-y-1.5">
              <Label>Rayon</Label>
              <Select value={locForm.rayonId || 'none'} onValueChange={v => setLocForm(f => ({ ...f, rayonId: v === 'none' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Pilih rayon..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Tidak ada —</SelectItem>
                  {rayonList.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isDefault" checked={locForm.isDefault}
                onChange={e => setLocForm(f => ({ ...f, isDefault: e.target.checked }))}
                className="rounded" />
              <Label htmlFor="isDefault" className="cursor-pointer">Jadikan lokasi default</Label>
            </div>
            {locError && <p className="text-sm text-destructive">{locError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setLocOpen(false)}>Batal</Button>
              <Button type="submit" disabled={locSaving}>{locSaving ? 'Menyimpan...' : 'Simpan'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

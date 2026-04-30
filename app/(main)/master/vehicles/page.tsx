'use client'

import { useState } from 'react'
import { Search, Plus, Pencil, Trash2 } from 'lucide-react'
import useSWR, { mutate } from 'swr'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingState } from '@/components/shared/LoadingState'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useRole } from '@/hooks/useRole'

const STATUS_OPTIONS = ['ACTIVE', 'INACTIVE', 'MAINTENANCE']
const STATUS_LABELS: Record<string, string> = { ACTIVE: 'Aktif', INACTIVE: 'Tidak Aktif', MAINTENANCE: 'Maintenance' }
const STATUS_VARIANTS: Record<string, 'success' | 'warning' | 'secondary'> = { ACTIVE: 'success', MAINTENANCE: 'warning', INACTIVE: 'secondary' }

const emptyForm = { plateNumber: '', capacitySak: '', operationalCostPerDay: '', status: 'ACTIVE' }

export default function VehiclesPage() {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const { isAdmin } = useRole()
  const key = `/api/vehicles${search ? `?search=${encodeURIComponent(search)}` : ''}`
  const { data: vehicles, isLoading } = useSWR(key)

  async function handleDelete(id: string, plateNumber: string) {
    if (!confirm(`Hapus kendaraan ${plateNumber}?`)) return
    const res = await fetch(`/api/vehicles/${id}`, { method: 'DELETE' })
    const json = await res.json()
    if (!res.ok) { alert(json.message ?? 'Gagal menghapus'); return }
    mutate(key)
  }

  function openCreate() {
    setEditId(null)
    setForm(emptyForm)
    setError('')
    setOpen(true)
  }

  function openEdit(v: any) {
    setEditId(v.id)
    setForm({
      plateNumber: v.plateNumber,
      capacitySak: String(v.capacitySak),
      operationalCostPerDay: String(v.operationalCostPerDay),
      status: v.status,
    })
    setError('')
    setOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const body = { ...form, capacitySak: Number(form.capacitySak), operationalCostPerDay: Number(form.operationalCostPerDay) }
      const res = await fetch(editId ? `/api/vehicles/${editId}` : '/api/vehicles', {
        method: editId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.message ?? 'Gagal menyimpan'); return }
      setOpen(false)
      mutate(key)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Kendaraan"
        description="Master data kendaraan operasional"
        action={isAdmin ? (
          <Button size="sm" className="gap-1.5" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Tambah Kendaraan
          </Button>
        ) : undefined}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editId ? 'Edit Kendaraan' : 'Tambah Kendaraan'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nomor Plat</Label>
              <Input value={form.plateNumber} onChange={e => setForm(f => ({ ...f, plateNumber: e.target.value }))} placeholder="B 1234 ABC" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Kapasitas (sak)</Label>
                <Input type="number" min={0} value={form.capacitySak} onChange={e => setForm(f => ({ ...f, capacitySak: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label>Biaya Harian (Rp)</Label>
                <Input type="number" min={0} value={form.operationalCostPerDay} onChange={e => setForm(f => ({ ...f, operationalCostPerDay: e.target.value }))} required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button>
              <Button type="submit" disabled={submitting}>{submitting ? 'Menyimpan...' : 'Simpan'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="relative mb-4 max-w-xs">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nomor plat..." className="pl-9" />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6"><LoadingState rows={5} /></div>
          ) : !(vehicles ?? []).length ? (
            <EmptyState title="Tidak ada kendaraan" description="Belum ada kendaraan terdaftar." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nomor Plat</TableHead>
                  <TableHead className="text-right">Kapasitas</TableHead>
                  <TableHead className="text-right">Biaya Harian</TableHead>
                  <TableHead>Driver Aktif</TableHead>
                  <TableHead>Status</TableHead>
                  {isAdmin && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(vehicles ?? []).map((v: any) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">{v.plateNumber}</TableCell>
                    <TableCell className="text-right">{v.capacitySak} sak</TableCell>
                    <TableCell className="text-right">Rp {v.operationalCostPerDay?.toLocaleString('id-ID')}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{v.drivers?.[0]?.name ?? '-'}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[v.status] ?? 'secondary'}>{STATUS_LABELS[v.status] ?? v.status}</Badge>
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(v)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(v.id, v.plateNumber)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
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
  )
}

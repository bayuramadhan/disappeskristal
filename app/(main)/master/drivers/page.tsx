'use client'

import { useState } from 'react'
import { Search, Plus, Pencil, Trash2, ChevronRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
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

const STATUS_OPTIONS = ['ACTIVE', 'INACTIVE', 'ON_LEAVE']
const STATUS_LABELS: Record<string, string> = { ACTIVE: 'Aktif', INACTIVE: 'Tidak Aktif', ON_LEAVE: 'Cuti' }
const STATUS_VARIANTS: Record<string, 'success' | 'warning' | 'secondary'> = { ACTIVE: 'success', ON_LEAVE: 'warning', INACTIVE: 'secondary' }

const emptyForm = { name: '', phone: '', assignedVehicleId: '', status: 'ACTIVE' }

export default function DriversPage() {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const { isAdmin } = useRole()
  const router = useRouter()
  const key = `/api/drivers${search ? `?search=${encodeURIComponent(search)}` : ''}`

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Hapus driver ${name}?`)) return
    const res = await fetch(`/api/drivers/${id}`, { method: 'DELETE' })
    const json = await res.json()
    if (!res.ok) { alert(json.message ?? 'Gagal menghapus'); return }
    mutate(key)
  }
  const { data: drivers, isLoading } = useSWR(key)
  const { data: vehicles } = useSWR('/api/vehicles')

  function openCreate() {
    setEditId(null)
    setForm(emptyForm)
    setError('')
    setOpen(true)
  }

  function openEdit(d: any) {
    setEditId(d.id)
    setForm({
      name: d.name,
      phone: d.phone ?? '',
      assignedVehicleId: d.assignedVehicleId ?? '',
      status: d.status,
    })
    setError('')
    setOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const body = { ...form, assignedVehicleId: form.assignedVehicleId || undefined }
      const res = await fetch(editId ? `/api/drivers/${editId}` : '/api/drivers', {
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

  const activeVehicles = (vehicles ?? []).filter((v: any) => v.status === 'ACTIVE')

  return (
    <div>
      <PageHeader
        title="Driver"
        description="Master data driver & karyawan"
        action={isAdmin ? (
          <Button size="sm" className="gap-1.5" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Tambah Driver
          </Button>
        ) : undefined}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editId ? 'Edit Driver' : 'Tambah Driver'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nama <span className="text-destructive">*</span></Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nama lengkap" required />
            </div>
            <div className="space-y-1.5">
              <Label>No. HP <span className="text-muted-foreground text-xs">(opsional)</span></Label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="08xx-xxxx-xxxx" />
            </div>
            <div className="space-y-1.5">
              <Label>Kendaraan <span className="text-muted-foreground text-xs">(opsional)</span></Label>
              <Select value={form.assignedVehicleId || 'none'} onValueChange={v => setForm(f => ({ ...f, assignedVehicleId: v === 'none' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Pilih kendaraan..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Tidak ada —</SelectItem>
                  {activeVehicles.map((v: any) => (
                    <SelectItem key={v.id} value={v.id}>{v.plateNumber} ({v.capacitySak} sak)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama driver..." className="pl-9" />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6"><LoadingState rows={5} /></div>
          ) : !(drivers ?? []).length ? (
            <EmptyState title="Tidak ada driver" description="Belum ada driver terdaftar." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>No. HP</TableHead>
                  <TableHead>Kendaraan</TableHead>
                  <TableHead>Status</TableHead>
                  {isAdmin && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(drivers ?? []).map((d: any) => (
                  <TableRow key={d.id} className="cursor-pointer" onClick={() => router.push(`/master/drivers/${d.id}`)}>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell className="text-sm">{d.phone ?? '-'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{d.assignedVehicle?.plateNumber ?? '-'}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[d.status] ?? 'secondary'}>{STATUS_LABELS[d.status] ?? d.status}</Badge>
                    </TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        {isAdmin && (
                          <>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(d)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(d.id, d.name)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </TableCell>
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

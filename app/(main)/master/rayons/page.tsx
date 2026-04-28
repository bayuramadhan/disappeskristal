'use client'

import { useState } from 'react'
import { Search, Plus, Pencil } from 'lucide-react'
import useSWR, { mutate } from 'swr'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingState } from '@/components/shared/LoadingState'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useRole } from '@/hooks/useRole'

const emptyForm = { name: '', coverageArea: '' }

export default function RayonsPage() {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const { isAdmin } = useRole()
  const key = `/api/rayons${search ? `?search=${encodeURIComponent(search)}` : ''}`
  const { data: rayons, isLoading } = useSWR(key)

  function openCreate() {
    setEditId(null)
    setForm(emptyForm)
    setError('')
    setOpen(true)
  }

  function openEdit(r: any) {
    setEditId(r.id)
    setForm({ name: r.name, coverageArea: r.coverageArea ?? '' })
    setError('')
    setOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(editId ? `/api/rayons/${editId}` : '/api/rayons', {
        method: editId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
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
        title="Rayon"
        description="Master data area distribusi"
        action={isAdmin ? (
          <Button size="sm" className="gap-1.5" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Tambah Rayon
          </Button>
        ) : undefined}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editId ? 'Edit Rayon' : 'Tambah Rayon'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nama Rayon</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Rayon Utara" required />
            </div>
            <div className="space-y-1.5">
              <Label>Area Cakupan</Label>
              <Input value={form.coverageArea} onChange={e => setForm(f => ({ ...f, coverageArea: e.target.value }))} placeholder="Kota Utara & Sekitar" />
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
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama rayon..." className="pl-9" />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6"><LoadingState rows={5} /></div>
          ) : !(rayons ?? []).length ? (
            <EmptyState title="Tidak ada rayon" description="Belum ada rayon terdaftar." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Area Cakupan</TableHead>
                  <TableHead className="text-right">Pelanggan</TableHead>
                  <TableHead className="text-right">Total Order</TableHead>
                  <TableHead>Status</TableHead>
                  {isAdmin && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(rayons ?? []).map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.coverageArea ?? '-'}</TableCell>
                    <TableCell className="text-right text-sm">{r._count?.customers ?? 0}</TableCell>
                    <TableCell className="text-right text-sm">{r._count?.orders ?? 0}</TableCell>
                    <TableCell>
                      <Badge variant={r.activeStatus ? 'success' : 'secondary'}>{r.activeStatus ? 'Aktif' : 'Nonaktif'}</Badge>
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
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

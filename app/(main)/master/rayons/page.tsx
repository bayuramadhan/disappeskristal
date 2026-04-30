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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useRole } from '@/hooks/useRole'
import { useToast } from '@/hooks/use-toast'

const emptyForm = { name: '', coverageArea: '', activeStatus: true }

export default function RayonsPage() {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const { isAdmin } = useRole()
  const { toast } = useToast()
  const key = `/api/rayons${search ? `?search=${encodeURIComponent(search)}` : ''}`
  const { data: rayons, isLoading } = useSWR(key)

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Hapus rayon "${name}"?`)) return
    const res  = await fetch(`/api/rayons/${id}`, { method: 'DELETE' })
    const json = await res.json()
    if (!res.ok) { toast({ title: 'Gagal menghapus', description: json.message, variant: 'destructive' }); return }
    mutate(key)
    toast({ title: 'Rayon dihapus', description: name })
  }

  function openCreate() {
    setEditId(null)
    setForm(emptyForm)
    setError('')
    setOpen(true)
  }

  function openEdit(r: any) {
    setEditId(r.id)
    setForm({ name: r.name, coverageArea: r.coverageArea ?? '', activeStatus: r.activeStatus })
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
      toast({ title: editId ? 'Rayon diperbarui' : 'Rayon ditambahkan', description: form.name })
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
              <Label>Nama Rayon <span className="text-destructive">*</span></Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Rayon Utara" required />
            </div>
            <div className="space-y-1.5">
              <Label>Area Cakupan <span className="text-muted-foreground text-xs">(opsional)</span></Label>
              <Input value={form.coverageArea} onChange={e => setForm(f => ({ ...f, coverageArea: e.target.value }))} placeholder="Kota Utara & Sekitar" />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="activeStatus"
                checked={form.activeStatus}
                onChange={e => setForm(f => ({ ...f, activeStatus: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="activeStatus">Rayon aktif</Label>
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
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(r.id, r.name)}>
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

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Search, Plus, Pencil, Trash2, ChevronRight } from 'lucide-react'
import { useCustomers, useRayons } from '@/hooks/useCustomers'
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { mutate } from 'swr'
import { useRole } from '@/hooks/useRole'
import { useToast } from '@/hooks/use-toast'

const TYPE_OPTIONS = ['WARUNG', 'DEPOT', 'TOKO']
const emptyForm = { name: '', phone: '', address: '', customerType: 'WARUNG', rayonId: '', defaultPrice: '' }

export default function CustomersPage() {
  const [filters, setFilters] = useState({ search: '', customerType: '', rayonId: '', page: 1 })
  const [newOpen, setNewOpen]   = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editId, setEditId]     = useState<string | null>(null)
  const [form, setForm]         = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]       = useState('')

  const { canManage, isAdmin } = useRole()
  const { toast } = useToast()
  const { data, isLoading }    = useCustomers(filters)
  const { data: rayons }       = useRayons()

  const customers  = data ?? []
  const apiKey     = `/api/customers?${new URLSearchParams(
    Object.fromEntries(Object.entries(filters).filter(([,v]) => v !== '' && v !== 1).map(([k,v]) => [k, String(v)]))
  )}`

  const setFilter = (key: string, value: string) => setFilters(f => ({ ...f, [key]: value, page: 1 }))

  function openEdit(c: any) {
    setEditId(c.id)
    setForm({
      name:          c.name,
      phone:         c.phone ?? '',
      address:       c.address ?? '',
      customerType:  c.customerType,
      rayonId:       c.rayonId ?? '',
      defaultPrice:  String(c.defaultPrice ?? ''),
    })
    setError('')
    setEditOpen(true)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const body = { ...form, defaultPrice: form.defaultPrice ? Number(form.defaultPrice) : 0, rayonId: form.rayonId || undefined }
      const res  = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.message ?? 'Gagal menyimpan'); return }
      setNewOpen(false)
      setForm(emptyForm)
      mutate(apiKey)
      toast({ title: 'Pelanggan ditambahkan', description: form.name })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editId) return
    setSubmitting(true)
    setError('')
    try {
      const body = { ...form, defaultPrice: form.defaultPrice ? Number(form.defaultPrice) : 0, rayonId: form.rayonId || undefined }
      const res  = await fetch(`/api/customers/${editId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.message ?? 'Gagal menyimpan'); return }
      setEditOpen(false)
      mutate(apiKey)
      toast({ title: 'Pelanggan diperbarui', description: form.name })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Hapus pelanggan ${name}?`)) return
    const res  = await fetch(`/api/customers/${id}`, { method: 'DELETE' })
    const json = await res.json()
    if (!res.ok) { toast({ title: 'Gagal menghapus', description: json.message, variant: 'destructive' }); return }
    mutate(apiKey)
    toast({ title: 'Pelanggan dihapus', description: name })
  }

  const formFields = (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Nama Pelanggan <span className="text-destructive">*</span></Label>
        <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Tipe <span className="text-destructive">*</span></Label>
          <Select value={form.customerType} onValueChange={v => setForm(f => ({ ...f, customerType: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{TYPE_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Rayon <span className="text-muted-foreground text-xs">(opsional)</span></Label>
          <Select value={form.rayonId || 'none'} onValueChange={v => setForm(f => ({ ...f, rayonId: v === 'none' ? '' : v }))}>
            <SelectTrigger><SelectValue placeholder="Pilih..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Tidak ada —</SelectItem>
              {(rayons ?? []).map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {!form.rayonId && (
            <p className="text-xs text-amber-600">Tanpa rayon, harga jual tidak akan otomatis terisi saat order.</p>
          )}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Harga Default (Rp/sak) <span className="text-muted-foreground text-xs">(opsional)</span></Label>
        <Input type="number" min={0} value={form.defaultPrice} onChange={e => setForm(f => ({ ...f, defaultPrice: e.target.value }))} placeholder="0" />
      </div>
      <div className="space-y-1.5">
        <Label>No. HP <span className="text-muted-foreground text-xs">(opsional)</span></Label>
        <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="08xx..." />
      </div>
      <div className="space-y-1.5">
        <Label>Alamat <span className="text-muted-foreground text-xs">(opsional)</span></Label>
        <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )

  return (
    <div>
      <PageHeader
        title="Pelanggan"
        description="Daftar pelanggan aktif"
        action={
          <Dialog open={newOpen} onOpenChange={o => { setNewOpen(o); if (!o) { setForm(emptyForm); setError('') } }}>
            {canManage && (
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> Pelanggan Baru</Button>
              </DialogTrigger>
            )}
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Tambah Pelanggan</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                {formFields}
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setNewOpen(false)}>Batal</Button>
                  <Button type="submit" disabled={submitting}>{submitting ? 'Menyimpan...' : 'Simpan'}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Dialog Edit */}
      <Dialog open={editOpen} onOpenChange={o => { setEditOpen(o); if (!o) setError('') }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit Pelanggan</DialogTitle></DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            {formFields}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Batal</Button>
              <Button type="submit" disabled={submitting}>{submitting ? 'Menyimpan...' : 'Simpan'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={filters.search} onChange={e => setFilter('search', e.target.value)} placeholder="Cari nama pelanggan..." className="pl-9" />
        </div>
        <Select value={filters.customerType || 'all'} onValueChange={v => setFilter('customerType', v === 'all' ? '' : v)}>
          <SelectTrigger className="w-32"><SelectValue placeholder="Tipe" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Tipe</SelectItem>
            {TYPE_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.rayonId || 'all'} onValueChange={v => setFilter('rayonId', v === 'all' ? '' : v)}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Rayon" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Rayon</SelectItem>
            {(rayons ?? []).map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6"><LoadingState rows={6} /></div>
          ) : customers.length === 0 ? (
            <EmptyState title="Tidak ada pelanggan" description="Belum ada pelanggan terdaftar." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead>Rayon</TableHead>
                  <TableHead>No. HP</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell><Badge variant="secondary">{c.customerType}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.rayon?.name ?? '-'}</TableCell>
                    <TableCell className="text-sm">{c.phone ?? '-'}</TableCell>
                    <TableCell>
                      <Badge variant={c.activeStatus ? 'success' : 'destructive'}>
                        {c.activeStatus ? 'Aktif' : 'Nonaktif'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {canManage && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {isAdmin && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(c.id, c.name)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Link href={`/customers/${c.id}`}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </Link>
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

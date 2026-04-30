'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
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
import { formatCurrency } from '@/lib/utils'

const CUSTOMER_TYPES = ['WARUNG', 'DEPOT', 'TOKO']
const CHANNELS = ['PREORDER', 'HOTLINE', 'CANVAS', 'ADMIN_INPUT']
const CHANNEL_LABELS: Record<string, string> = {
  PREORDER:    'Pre-order',
  HOTLINE:     'Hotline',
  CANVAS:      'Canvas',
  ADMIN_INPUT: 'Admin Input',
}

const emptyForm = {
  customerType: 'WARUNG',
  channel:      'HOTLINE',
  rayonId:      '',
  price:        '',
  validFrom:    '',
  validUntil:   '',
}

function buildKey(filters: { customerType: string; channel: string; rayonId: string }) {
  const p = new URLSearchParams()
  if (filters.customerType) p.set('customerType', filters.customerType)
  if (filters.channel)      p.set('channel',      filters.channel)
  if (filters.rayonId)      p.set('rayonId',       filters.rayonId)
  const qs = p.toString()
  return `/api/price-profiles${qs ? `?${qs}` : ''}`
}

export default function PriceProfilesPage() {
  const [filters, setFilters] = useState({ customerType: '', channel: '', rayonId: '' })
  const [open, setOpen]       = useState(false)
  const [editId, setEditId]   = useState<string | null>(null)
  const [form, setForm]       = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]     = useState('')

  const { isAdmin } = useRole()
  const key = buildKey(filters)
  const { data: profiles, isLoading } = useSWR(key)
  const { data: rayons }              = useSWR('/api/rayons')

  const setFilter = (k: string, v: string) => setFilters(f => ({ ...f, [k]: v }))

  function openCreate() {
    setEditId(null)
    setForm(emptyForm)
    setError('')
    setOpen(true)
  }

  function openEdit(p: any) {
    setEditId(p.id)
    setForm({
      customerType: p.customerType,
      channel:      p.channel,
      rayonId:      p.rayonId ?? '',
      price:        String(p.price),
      validFrom:    format(new Date(p.validFrom), 'yyyy-MM-dd'),
      validUntil:   format(new Date(p.validUntil), 'yyyy-MM-dd'),
    })
    setError('')
    setOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const body = {
        ...form,
        price:   Number(form.price),
        rayonId: form.rayonId || undefined,
      }
      const url    = editId ? `/api/price-profiles/${editId}` : '/api/price-profiles'
      const method = editId ? 'PATCH' : 'POST'
      const res    = await fetch(url, {
        method,
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

  async function handleDelete(id: string, label: string) {
    if (!confirm(`Hapus harga "${label}"?`)) return
    const res  = await fetch(`/api/price-profiles/${id}`, { method: 'DELETE' })
    const json = await res.json()
    if (!res.ok) { alert(json.message ?? 'Gagal menghapus'); return }
    mutate(key)
  }

  const razonList = (rayons ?? []) as any[]

  return (
    <div>
      <PageHeader
        title="Harga Jual"
        description="Tabel harga berdasarkan tipe pelanggan, channel, dan rayon"
        action={isAdmin ? (
          <Button size="sm" className="gap-1.5" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Tambah Harga
          </Button>
        ) : undefined}
      />

      <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) setError('') }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Harga' : 'Tambah Harga'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipe Pelanggan <span className="text-destructive">*</span></Label>
                <Select value={form.customerType} onValueChange={v => setForm(f => ({ ...f, customerType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CUSTOMER_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Channel <span className="text-destructive">*</span></Label>
                <Select value={form.channel} onValueChange={v => setForm(f => ({ ...f, channel: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CHANNELS.map(c => <SelectItem key={c} value={c}>{CHANNEL_LABELS[c]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Rayon <span className="text-muted-foreground text-xs">(opsional — kosong = semua rayon)</span></Label>
              <Select value={form.rayonId || 'all'} onValueChange={v => setForm(f => ({ ...f, rayonId: v === 'all' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Semua rayon" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">— Semua rayon —</SelectItem>
                  {razonList.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Harga (Rp/sak) <span className="text-destructive">*</span></Label>
              <Input
                type="number"
                min={0}
                value={form.price}
                onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                placeholder="0"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Berlaku Mulai <span className="text-destructive">*</span></Label>
                <Input
                  type="date"
                  value={form.validFrom}
                  onChange={e => setForm(f => ({ ...f, validFrom: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Berlaku Sampai <span className="text-destructive">*</span></Label>
                <Input
                  type="date"
                  value={form.validUntil}
                  onChange={e => setForm(f => ({ ...f, validUntil: e.target.value }))}
                  required
                />
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button>
              <Button type="submit" disabled={submitting}>{submitting ? 'Menyimpan...' : 'Simpan'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <Select value={filters.customerType || 'all'} onValueChange={v => setFilter('customerType', v === 'all' ? '' : v)}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Tipe" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Tipe</SelectItem>
            {CUSTOMER_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.channel || 'all'} onValueChange={v => setFilter('channel', v === 'all' ? '' : v)}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Channel" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Channel</SelectItem>
            {CHANNELS.map(c => <SelectItem key={c} value={c}>{CHANNEL_LABELS[c]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.rayonId || 'all'} onValueChange={v => setFilter('rayonId', v === 'all' ? '' : v)}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Rayon" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Rayon</SelectItem>
            {razonList.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6"><LoadingState rows={5} /></div>
          ) : !(profiles ?? []).length ? (
            <EmptyState title="Belum ada harga" description="Tambah harga jual untuk setiap tipe pelanggan dan channel." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipe Pelanggan</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Rayon</TableHead>
                  <TableHead className="text-right">Harga/sak</TableHead>
                  <TableHead>Berlaku Mulai</TableHead>
                  <TableHead>Berlaku Sampai</TableHead>
                  {isAdmin && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(profiles ?? []).map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell><Badge variant="secondary">{p.customerType}</Badge></TableCell>
                    <TableCell className="text-sm">{CHANNEL_LABELS[p.channel] ?? p.channel}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.rayon?.name ?? <span className="italic">Semua</span>}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(p.price)}</TableCell>
                    <TableCell className="text-sm">{format(new Date(p.validFrom), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="text-sm">{format(new Date(p.validUntil), 'dd/MM/yyyy')}</TableCell>
                    {isAdmin && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(p.id, `${p.customerType} / ${CHANNEL_LABELS[p.channel]}`)}
                          >
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

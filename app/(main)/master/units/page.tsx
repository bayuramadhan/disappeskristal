'use client'

import useSWR, { mutate } from 'swr'
import { useState } from 'react'
import { Plus, Pencil, Trash2, Star } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'

type Unit = {
  id: string
  name: string
  abbreviation: string
  unitsPerSak: number
  isBase: boolean
  isActive: boolean
}

const fetcher = (url: string) => fetch(url).then(r => r.json()).then(d => d.data)
const KEY = '/api/units'

export default function MasterUnitsPage() {
  const { data: units = [] } = useSWR<Unit[]>(KEY, fetcher)


  const [open, setOpen]     = useState(false)
  const [editing, setEditing] = useState<Unit | null>(null)
  const [form, setForm]     = useState({ name: '', abbreviation: '', unitsPerSak: '' })
  const [saving, setSaving] = useState(false)

  function openNew() {
    setEditing(null)
    setForm({ name: '', abbreviation: '', unitsPerSak: '' })
    setOpen(true)
  }

  function openEdit(u: Unit) {
    setEditing(u)
    setForm({ name: u.name, abbreviation: u.abbreviation, unitsPerSak: String(u.unitsPerSak) })
    setOpen(true)
  }

  async function handleSave() {
    const unitsPerSak = parseFloat(form.unitsPerSak)
    if (!form.name || !form.abbreviation || isNaN(unitsPerSak) || unitsPerSak <= 0) {
      toast({ title: 'Isi semua field dengan benar', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const url    = editing ? `${KEY}/${editing.id}` : KEY
      const method = editing ? 'PATCH' : 'POST'
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, abbreviation: form.abbreviation, unitsPerSak }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message)
      toast({ title: json.message ?? 'Tersimpan' })
      mutate(KEY)
      setOpen(false)
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(u: Unit) {
    if (u.isBase) return
    const res  = await fetch(`${KEY}/${u.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !u.isActive }),
    })
    const json = await res.json()
    if (!res.ok) { toast({ title: json.message, variant: 'destructive' }); return }
    mutate(KEY)
  }

  async function handleDelete(u: Unit) {
    if (!confirm(`Hapus unit "${u.name}"?`)) return
    const res  = await fetch(`${KEY}/${u.id}`, { method: 'DELETE' })
    const json = await res.json()
    if (!res.ok) { toast({ title: json.message, variant: 'destructive' }); return }
    toast({ title: json.message })
    mutate(KEY)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Satuan (UOM)"
        description="Kelola satuan pesanan selain sak dan faktor konversinya"
        action={<Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Tambah Unit</Button>}
      />

      {/* Info konversi */}
      <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
        <strong className="text-foreground">Cara membaca konversi:</strong>{' '}
        Kolom <em>"Unit per sak"</em> menunjukkan berapa unit = 1 sak.{' '}
        Contoh: <strong>kg = 25</strong> artinya 25 kg = 1 sak.{' '}
        Harga pesanan selalu dihitung dalam sak: <em>total = (qty ÷ unit-per-sak) × harga/sak</em>.
      </div>

      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Singkatan</TableHead>
              <TableHead className="text-right">Unit per sak</TableHead>
              <TableHead className="text-center">Contoh konversi</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {units.map(u => (
              <TableRow key={u.id} className={!u.isActive ? 'opacity-50' : ''}>
                <TableCell className="font-medium">
                  {u.name}
                  {u.isBase && <Star className="inline w-3 h-3 ml-1 text-amber-500" fill="currentColor" />}
                </TableCell>
                <TableCell>
                  <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{u.abbreviation}</code>
                </TableCell>
                <TableCell className="text-right font-mono">{u.unitsPerSak}</TableCell>
                <TableCell className="text-center text-xs text-muted-foreground">
                  {u.isBase
                    ? '—'
                    : `${u.unitsPerSak} ${u.abbreviation} = 1 sak`}
                </TableCell>
                <TableCell className="text-center">
                  {u.isBase
                    ? <Badge variant="secondary">Unit Dasar</Badge>
                    : u.isActive
                      ? <Badge className="bg-green-100 text-green-700 border-green-200">Aktif</Badge>
                      : <Badge variant="outline">Nonaktif</Badge>
                  }
                </TableCell>
                <TableCell>
                  <div className="flex gap-1 justify-end">
                    {!u.isBase && (
                      <>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(u)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"
                          onClick={() => handleToggleActive(u)}
                          title={u.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                        >
                          {u.isActive ? '⏸' : '▶'}
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(u)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Dialog tambah/edit */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Unit' : 'Tambah Unit Baru'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nama <span className="text-destructive">*</span></Label>
              <Input
                placeholder="Kilogram"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Singkatan <span className="text-destructive">*</span></Label>
              <Input
                placeholder="kg"
                value={form.abbreviation}
                onChange={e => setForm(f => ({ ...f, abbreviation: e.target.value.toLowerCase() }))}
                disabled={!!editing} // singkatan tidak bisa diubah setelah dibuat
              />
              {editing && (
                <p className="text-xs text-muted-foreground">Singkatan tidak dapat diubah setelah disimpan</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Unit per sak <span className="text-destructive">*</span></Label>
              <Input
                type="number" min="0.001" step="0.001"
                placeholder="25"
                value={form.unitsPerSak}
                onChange={e => setForm(f => ({ ...f, unitsPerSak: e.target.value }))}
              />
              {form.unitsPerSak && parseFloat(form.unitsPerSak) > 0 && (
                <p className="text-xs text-muted-foreground">
                  {parseFloat(form.unitsPerSak)} {form.abbreviation || '…'} = 1 sak
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

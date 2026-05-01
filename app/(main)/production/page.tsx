'use client'

import { useState } from 'react'
import { format, addDays } from 'date-fns'
import { id } from 'date-fns/locale'
import { AlertTriangle, CheckCircle2, Package, TrendingUp, Factory, Truck, Warehouse } from 'lucide-react'
import { useProductionRecommendation, useWarehouseStock } from '@/hooks/useProduction'
import { useRole } from '@/hooks/useRole'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingCards } from '@/components/shared/LoadingState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { mutate } from 'swr'

export default function ProductionPage() {
  const today    = format(new Date(), 'yyyy-MM-dd')
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd')
  const [date, setDate] = useState(tomorrow)

  // Production plan state
  const [actualQty, setActualQty] = useState('')
  const [saving, setSaving]       = useState(false)
  const [saveMsg, setSaveMsg]     = useState('')

  // Warehouse stock state
  const [adjQty, setAdjQty]         = useState('')
  const [adjNotes, setAdjNotes]     = useState('')
  const [adjSaving, setAdjSaving]   = useState(false)
  const [adjMsg, setAdjMsg]         = useState('')
  const [initQty, setInitQty]       = useState('')
  const [initSaving, setInitSaving] = useState(false)

  const { isAdmin } = useRole()
  const { data, isLoading, error } = useProductionRecommendation(date)
  const { data: stock, mutate: mutateStock } = useWarehouseStock(today)

  const calc     = data?.calculation
  const ctx      = data?.context
  const existing = data?.existingPlan
  const warnings = data?.warnings ?? []

  async function savePlan() {
    if (!actualQty) return
    setSaving(true)
    setSaveMsg('')
    try {
      const method = existing ? 'PATCH' : 'POST'
      const url    = existing ? `/api/production/plans/${existing.id}` : '/api/production/plans'
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productionDate: date, plannedQty: Number(actualQty) }),
      })
      const json = await res.json()
      if (res.ok) {
        setSaveMsg('Rencana produksi berhasil disimpan')
        mutate(`/api/production/recommendation?date=${date}`)
        mutateStock()
        setActualQty('')
      } else {
        setSaveMsg(json.message ?? 'Gagal menyimpan')
      }
    } finally {
      setSaving(false)
    }
  }

  async function initStock() {
    if (!initQty) return
    setInitSaving(true)
    try {
      const res  = await fetch('/api/warehouse/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'init', date: today, openingStock: Number(initQty) }),
      })
      const json = await res.json()
      if (res.ok) {
        mutateStock()
        setInitQty('')
      } else {
        setAdjMsg(json.message ?? 'Gagal mencatat stok awal')
      }
    } finally {
      setInitSaving(false)
    }
  }

  async function applyAdjustment() {
    if (!adjQty) return
    setAdjSaving(true)
    setAdjMsg('')
    try {
      const res  = await fetch('/api/warehouse/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'adjust', date: today, adjustment: Number(adjQty), notes: adjNotes || undefined }),
      })
      const json = await res.json()
      if (res.ok) {
        setAdjMsg('Penyesuaian berhasil diterapkan')
        mutateStock()
        setAdjQty('')
        setAdjNotes('')
      } else {
        setAdjMsg(json.message ?? 'Gagal menyimpan')
      }
    } finally {
      setAdjSaving(false)
    }
  }

  return (
    <div>
      <PageHeader title="Produksi" description="Rekomendasi & rencana produksi es kristal" />

      {/* Date picker */}
      <div className="flex items-center gap-3 mb-6">
        <Label className="text-sm shrink-0">Tanggal Produksi</Label>
        <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-40 h-8 text-sm" />
        <Button variant="ghost" size="sm" onClick={() => setDate(tomorrow)} className="h-8 text-xs">Besok</Button>
      </div>

      {isLoading ? (
        <LoadingCards count={6} />
      ) : error ? (
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertTriangle className="h-4 w-4" /> Gagal memuat rekomendasi
        </div>
      ) : (
        <>
          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="space-y-2 mb-6">
              {warnings.map((w: string, i: number) => (
                <div key={i} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          {/* Main recommendation card */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card className="border-sky-200 bg-sky-50/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Factory className="h-5 w-5 text-sky-600" />
                  Rekomendasi Produksi
                </CardTitle>
                <p className="text-xs text-muted-foreground capitalize">
                  {data?.targetDate ? format(new Date(data.targetDate + 'T00:00:00'), 'EEEE, dd MMMM yyyy', { locale: id }) : ''}
                </p>
              </CardHeader>
              <CardContent>
                <p className="text-5xl font-black text-sky-700 mt-2">{calc?.recommendedProductionQty ?? 0}</p>
                <p className="text-sm text-muted-foreground mt-1">sak yang direkomendasikan</p>
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">PreOrder terkonfirmasi</span>
                    <span className="font-medium">{calc?.confirmedPreorderQty ?? 0} sak ({calc?.confirmedPreorderCount ?? 0} order)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Estimasi Canvas</span>
                    <span className="font-medium">{calc?.estimatedCanvasQty ?? 0} sak</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Estimasi Hotline</span>
                    <span className="font-medium">{calc?.estimatedHotlineQty ?? 0} sak</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-muted-foreground">Buffer risiko ({((calc?.riskPct ?? 0.05) * 100).toFixed(0)}%)</span>
                    <span className="font-medium">+{calc?.riskAdjustmentQty ?? 0} sak</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Context */}
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span>Stok Gudang Saat Ini</span>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold">{ctx?.currentWarehouseStock ?? 0} sak</span>
                      <Badge variant={ctx?.stockSufficiency === 'CUKUP' ? 'success' : 'destructive'} className="ml-2">
                        {ctx?.stockSufficiency === 'CUKUP' ? 'Cukup' : 'Kurang'}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      <span>Kapasitas Armada Aktif</span>
                    </div>
                    <span className="font-semibold">{ctx?.totalFleetCapacitySak ?? 0} sak</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      <span>Avg Canvas 7 hari</span>
                    </div>
                    <span className="font-semibold">{ctx?.avgCanvasQtyPerDay ?? 0} sak/hari</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      <span>Avg Hotline 7 hari</span>
                    </div>
                    <span className="font-semibold">{ctx?.avgHotlineQtyPerDay ?? 0} sak/hari</span>
                  </div>
                </CardContent>
              </Card>

              {existing && (
                <Card className="border-emerald-200 bg-emerald-50/50">
                  <CardContent className="pt-5">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <p className="text-sm font-medium text-emerald-800">Rencana sudah ada</p>
                    </div>
                    <p className="text-2xl font-bold text-emerald-700">{existing.actualProductionQty} sak</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Production plan input — ADMIN only */}
          {isAdmin && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-base">{existing ? 'Update Rencana Produksi' : 'Tetapkan Rencana Produksi'}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-3">
                  <div className="space-y-1.5 flex-1 max-w-xs">
                    <Label>Jumlah Produksi (sak)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={actualQty}
                      onChange={e => setActualQty(e.target.value)}
                      placeholder={String(calc?.recommendedProductionQty ?? '')}
                    />
                  </div>
                  <Button onClick={savePlan} disabled={saving || !actualQty}>
                    {saving ? 'Menyimpan...' : existing ? 'Update' : 'Simpan'}
                  </Button>
                </div>
                {saveMsg && (
                  <p className={`text-sm mt-2 ${saveMsg.includes('berhasil') ? 'text-emerald-600' : 'text-destructive'}`}>
                    {saveMsg}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Warehouse stock — today */}
          {isAdmin && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Warehouse className="h-5 w-5 text-slate-600" />
                  Stok Gudang Hari Ini
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!stock ? (
                  /* No record yet — show init form */
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">Belum ada catatan stok untuk hari ini. Masukkan stok awal untuk mulai tracking.</p>
                    <div className="flex items-end gap-3">
                      <div className="space-y-1.5 flex-1 max-w-xs">
                        <Label>Stok Awal (sak)</Label>
                        <Input type="number" min={0} value={initQty} onChange={e => setInitQty(e.target.value)} placeholder="0" />
                      </div>
                      <Button onClick={initStock} disabled={initSaving || !initQty}>
                        {initSaving ? 'Menyimpan...' : 'Catat Stok Awal'}
                      </Button>
                    </div>
                    {adjMsg && <p className="text-sm text-destructive">{adjMsg}</p>}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Stock breakdown */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: 'Stok Awal',   value: stock.openingStock, color: 'text-slate-700' },
                        { label: 'Produksi',     value: stock.productionIn, color: 'text-emerald-600' },
                        { label: 'Terkirim',     value: -stock.loadingOut,  color: 'text-red-600' },
                        { label: 'Retur Masuk',  value: stock.returnedIn,   color: 'text-sky-600' },
                      ].map(item => (
                        <div key={item.label} className="rounded-lg border px-3 py-2 text-center">
                          <p className="text-xs text-muted-foreground">{item.label}</p>
                          <p className={`text-lg font-bold ${item.color}`}>
                            {item.value > 0 ? '+' : ''}{item.value}
                          </p>
                        </div>
                      ))}
                    </div>

                    {stock.adjustment !== 0 && (
                      <div className="text-sm text-muted-foreground">
                        Penyesuaian: <span className={stock.adjustment > 0 ? 'text-emerald-600 font-medium' : 'text-destructive font-medium'}>
                          {stock.adjustment > 0 ? '+' : ''}{stock.adjustment} sak
                        </span>
                        {stock.adjustmentNotes && <span className="ml-1">({stock.adjustmentNotes})</span>}
                      </div>
                    )}

                    <Separator />

                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Stok Akhir Saat Ini</span>
                      <span className={`text-2xl font-black ${stock.closingStock < 50 ? 'text-amber-600' : 'text-slate-800'}`}>
                        {stock.closingStock} sak
                      </span>
                    </div>

                    {/* Adjustment form */}
                    <Separator />
                    <p className="text-sm font-medium">Penyesuaian Manual</p>
                    <p className="text-xs text-muted-foreground">Gunakan nilai positif untuk penambahan (produksi tambahan, temuan stok) atau negatif untuk pengurangan (susut, pecah, hilang).</p>
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Jumlah (±sak)</Label>
                        <Input
                          type="number"
                          value={adjQty}
                          onChange={e => setAdjQty(e.target.value)}
                          placeholder="mis. -5 atau +10"
                          className="w-36"
                        />
                      </div>
                      <div className="space-y-1.5 flex-1 min-w-48">
                        <Label className="text-xs">Keterangan</Label>
                        <Input value={adjNotes} onChange={e => setAdjNotes(e.target.value)} placeholder="Susut, pecah, dll." />
                      </div>
                      <Button variant="outline" onClick={applyAdjustment} disabled={adjSaving || !adjQty}>
                        {adjSaving ? 'Menyimpan...' : 'Terapkan'}
                      </Button>
                    </div>
                    {adjMsg && (
                      <p className={`text-sm ${adjMsg.includes('berhasil') ? 'text-emerald-600' : 'text-destructive'}`}>
                        {adjMsg}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

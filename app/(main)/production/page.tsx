'use client'

import { useState } from 'react'
import { format, addDays } from 'date-fns'
import { id } from 'date-fns/locale'
import { AlertTriangle, CheckCircle2, Package, TrendingUp, Factory, Truck } from 'lucide-react'
import { useProductionRecommendation } from '@/hooks/useProduction'
import { useRole } from '@/hooks/useRole'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingCards } from '@/components/shared/LoadingState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { mutate } from 'swr'

export default function ProductionPage() {
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd')
  const [date, setDate] = useState(tomorrow)
  const [actualQty, setActualQty] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  const { isAdmin } = useRole()
  const { data, isLoading, error } = useProductionRecommendation(date)

  const calc = data?.calculation
  const ctx = data?.context
  const existing = data?.existingPlan
  const warnings = data?.warnings ?? []

  async function savePlan() {
    if (!actualQty) return
    setSaving(true)
    setSaveMsg('')
    try {
      const method = existing ? 'PATCH' : 'POST'
      const url = existing ? `/api/production/plans/${existing.id}` : '/api/production/plans'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productionDate: date, plannedQty: Number(actualQty) }),
      })
      if (res.ok) {
        setSaveMsg('Rencana produksi berhasil disimpan')
        mutate(`/api/production/recommendation?date=${date}`)
        setActualQty('')
      } else {
        setSaveMsg('Gagal menyimpan')
      }
    } finally {
      setSaving(false)
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

              {/* Existing plan */}
              {existing && (
                <Card className="border-emerald-200 bg-emerald-50/50">
                  <CardContent className="pt-5">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <p className="text-sm font-medium text-emerald-800">Rencana sudah ada</p>
                    </div>
                    <p className="text-2xl font-bold text-emerald-700">{existing.plannedQty} sak</p>
                    <p className="text-xs text-emerald-600 mt-1">
                      Realisasi: {existing.actualQty ?? '-'} sak
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Set actual quantity — ADMIN only */}
          {isAdmin && (
            <Card>
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
        </>
      )}
    </div>
  )
}

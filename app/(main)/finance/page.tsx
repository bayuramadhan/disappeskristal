'use client'

import { useState } from 'react'
import { format, subDays } from 'date-fns'
import { TrendingUp, TrendingDown, DollarSign, Package, Download } from 'lucide-react'
import * as XLSX from 'xlsx'
import { useFinance } from '@/hooks/useFinance'
import { useRole } from '@/hooks/useRole'
import { toast } from '@/hooks/use-toast'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingState } from '@/components/shared/LoadingState'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'

export default function FinancePage() {
  const today = format(new Date(), 'yyyy-MM-dd')
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 6), 'yyyy-MM-dd'))
  const [endDate, setEndDate]     = useState(today)
  const [groupBy, setGroupBy]     = useState<'day' | 'vehicle' | 'rayon'>('day')

  const { canViewFinance } = useRole()
  const { data, isLoading } = useFinance({ startDate, endDate, groupBy })

  const totals = data?.totals
  const rows   = data?.data ?? []

  // ── Excel Export ──────────────────────────────────────────────────────────
  function exportExcel() {
    if (!rows.length) {
      toast({ title: 'Tidak ada data untuk diekspor', variant: 'destructive' })
      return
    }

    const groupLabel = groupBy === 'day' ? 'Tanggal' : groupBy === 'vehicle' ? 'Kendaraan' : 'Rayon'

    const sheetData = rows.map((r: any) => ({
      [groupLabel]: groupBy === 'day'
        ? format(new Date(r.date + 'T00:00:00'), 'dd/MM/yyyy')
        : groupBy === 'vehicle' ? (r.plateNumber ?? '-') : (r.rayonName ?? '-'),
      'Total Pesanan':    r.totalOrders,
      'Total Terkirim':   r.totalDeliveredQty,
      'Total Retur':      r.totalReturnedQty,
      'Gross Revenue':    r.grossRevenue,
      'Biaya Kendaraan':  r.vehicleCost,
      'Net Revenue':      r.netRevenue,
    }))

    // Summary row
    sheetData.push({} as any)
    sheetData.push({
      [groupLabel]: 'TOTAL',
      'Total Pesanan':    totals?.totalOrders ?? 0,
      'Total Terkirim':   totals?.totalDeliveredQty ?? 0,
      'Total Retur':      totals?.totalReturnedQty ?? 0,
      'Gross Revenue':    totals?.grossRevenue ?? 0,
      'Biaya Kendaraan':  totals?.vehicleCost ?? 0,
      'Net Revenue':      totals?.netRevenue ?? 0,
    } as any)

    const ws = XLSX.utils.json_to_sheet(sheetData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Revenue')

    // Column widths
    ws['!cols'] = [{ wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 16 }]

    XLSX.writeFile(wb, `laporan-revenue-${startDate}_${endDate}.xlsx`)
    toast({ title: `Laporan revenue diekspor ke Excel`, variant: 'success' })
  }

  return (
    <div>
      <PageHeader title="Keuangan" description="Laporan pendapatan dan biaya operasional" />

      {/* Filters + Export */}
      <div className="flex flex-wrap gap-3 items-end mb-6">
        <div className="space-y-1">
          <Label className="text-xs">Dari</Label>
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-36 h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Sampai</Label>
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-36 h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Kelompokkan</Label>
          <Select value={groupBy} onValueChange={v => setGroupBy(v as any)}>
            <SelectTrigger className="w-36 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Per Hari</SelectItem>
              <SelectItem value="vehicle">Per Kendaraan</SelectItem>
              <SelectItem value="rayon">Per Rayon</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {canViewFinance && (
          <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={exportExcel}>
            <Download className="h-3.5 w-3.5" /> Export Excel
          </Button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Gross Revenue',    value: formatCurrency(totals?.grossRevenue ?? 0),   icon: DollarSign,  color: 'text-emerald-600' },
          { label: 'Biaya Kendaraan',  value: formatCurrency(totals?.vehicleCost ?? 0),    icon: TrendingDown, color: 'text-destructive' },
          { label: 'Net Revenue',      value: formatCurrency(totals?.netRevenue ?? 0),     icon: TrendingUp,  color: 'text-sky-600' },
          { label: 'Total Terkirim',   value: `${totals?.totalDeliveredQty ?? 0} sak`,    icon: Package,     color: 'text-violet-600' },
        ].map(m => (
          <Card key={m.label}>
            <CardContent className="pt-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{m.label}</p>
                  <p className="text-lg font-bold mt-1">{m.value}</p>
                </div>
                <m.icon className={`h-5 w-5 ${m.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Rincian {groupBy === 'day' ? 'Harian' : groupBy === 'vehicle' ? 'per Kendaraan' : 'per Rayon'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6"><LoadingState rows={7} /></div>
          ) : rows.length === 0 ? (
            <EmptyState title="Tidak ada data" description="Tidak ada transaksi dalam periode ini." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{groupBy === 'day' ? 'Tanggal' : groupBy === 'vehicle' ? 'Kendaraan' : 'Rayon'}</TableHead>
                  <TableHead className="text-right">Pesanan</TableHead>
                  <TableHead className="text-right">Terkirim</TableHead>
                  <TableHead className="text-right">Retur</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Biaya</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium text-sm">
                      {groupBy === 'day'
                        ? format(new Date(r.date + 'T00:00:00'), 'dd/MM/yyyy')
                        : groupBy === 'vehicle' ? (r.plateNumber ?? 'Tidak ada')
                        : (r.rayonName ?? 'Tidak ada')}
                    </TableCell>
                    <TableCell className="text-right text-sm">{r.totalOrders}</TableCell>
                    <TableCell className="text-right text-sm">{r.totalDeliveredQty}</TableCell>
                    <TableCell className="text-right text-sm text-destructive">{r.totalReturnedQty}</TableCell>
                    <TableCell className="text-right text-sm">{formatCurrency(r.grossRevenue)}</TableCell>
                    <TableCell className="text-right text-sm text-destructive">{formatCurrency(r.vehicleCost)}</TableCell>
                    <TableCell className="text-right font-semibold text-sm text-emerald-600">{formatCurrency(r.netRevenue)}</TableCell>
                  </TableRow>
                ))}
                {/* Totals row */}
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell className="text-sm">Total</TableCell>
                  <TableCell className="text-right text-sm">{totals?.totalOrders ?? 0}</TableCell>
                  <TableCell className="text-right text-sm">{totals?.totalDeliveredQty ?? 0}</TableCell>
                  <TableCell className="text-right text-sm text-destructive">{totals?.totalReturnedQty ?? 0}</TableCell>
                  <TableCell className="text-right text-sm">{formatCurrency(totals?.grossRevenue ?? 0)}</TableCell>
                  <TableCell className="text-right text-sm text-destructive">{formatCurrency(totals?.vehicleCost ?? 0)}</TableCell>
                  <TableCell className="text-right text-sm text-emerald-600">{formatCurrency(totals?.netRevenue ?? 0)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

'use client'

import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { TrendingUp, ShoppingCart, Truck, Package, AlertTriangle } from 'lucide-react'
import { useDashboard } from '@/hooks/useDashboard'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { LoadingCards } from '@/components/shared/LoadingState'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency } from '@/lib/utils'

function MetricCard({
  title, value, sub, icon: Icon, color = 'text-sky-600',
}: {
  title: string; value: string; sub?: string
  icon: React.ElementType; color?: string
}) {
  const bgMap: Record<string, string> = {
    'text-sky-600':    'bg-sky-50',
    'text-emerald-600':'bg-emerald-50',
    'text-violet-600': 'bg-violet-50',
    'text-amber-600':  'bg-amber-50',
    'text-slate-600':  'bg-slate-50',
  }
  const bgColor = bgMap[color] ?? 'bg-sky-50'
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className={`rounded-lg ${bgColor} p-2`}>
            <Icon className={`h-5 w-5 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function AlertBanner({ type, message }: { type: 'danger' | 'warning'; message: string }) {
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
      type === 'danger'
        ? 'border-red-200 bg-red-50 text-red-800'
        : 'border-amber-200 bg-amber-50 text-amber-800'
    }`}>
      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  )
}

export default function DashboardPage() {
  const today = format(new Date(), 'yyyy-MM-dd')
  const { data, isLoading, error } = useDashboard(today)

  // ── Alert conditions ──────────────────────────────────────────────────────
  const totalDelivered = data?.orders?.totalDelivered ?? 0
  const totalReturned  = data?.orders?.totalReturned  ?? 0
  const returnRate     = totalDelivered > 0 ? (totalReturned / totalDelivered) * 100 : 0
  const stockLevel     = data?.warehouse?.closingStock ?? 0

  const alerts: Array<{ type: 'danger' | 'warning'; message: string }> = []
  if (!isLoading && data) {
    if (returnRate > 10) {
      alerts.push({ type: 'danger', message: `⚠️ Return rate hari ini ${returnRate.toFixed(1)}% (>10%). Periksa kualitas atau rute pengiriman.` })
    }
    if (stockLevel < 50 && stockLevel >= 0) {
      alerts.push({ type: 'warning', message: `⚠️ Stok gudang rendah: ${stockLevel} sak (< 50 sak). Segera rencanakan produksi.` })
    }
  }

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={format(new Date(), 'EEEE, dd MMMM yyyy', { locale: id })}
      />

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2 mb-6">
          {alerts.map((a, i) => <AlertBanner key={i} type={a.type} message={a.message} />)}
        </div>
      )}

      {isLoading ? (
        <LoadingCards count={4} />
      ) : error ? (
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertTriangle className="h-4 w-4" /> Gagal memuat data dashboard
        </div>
      ) : (
        <>
          {/* Metric cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <MetricCard
              title="Total Pesanan"
              value={String(data?.orders?.total ?? 0)}
              sub={`${data?.orders?.totalOrderedQty ?? 0} sak dipesan`}
              icon={ShoppingCart}
              color="text-sky-600"
            />
            <MetricCard
              title="Pendapatan Bersih"
              value={formatCurrency(data?.finance?.netRevenue ?? 0)}
              sub={`Gross: ${formatCurrency(data?.finance?.grossRevenue ?? 0)}`}
              icon={TrendingUp}
              color="text-emerald-600"
            />
            <MetricCard
              title="Armada Aktif"
              value={String(data?.fleet?.activeCount ?? 0)}
              sub="kendaraan beroperasi"
              icon={Truck}
              color="text-violet-600"
            />
            <MetricCard
              title="Stok Gudang"
              value={`${stockLevel} sak`}
              sub={`Update: ${data?.warehouse?.date ? format(new Date(data.warehouse.date), 'dd/MM') : '-'}`}
              icon={Package}
              color={stockLevel < 50 ? 'text-amber-600' : 'text-slate-600'}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Status pesanan */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Status Pesanan Hari Ini</CardTitle>
              </CardHeader>
              <CardContent>
                {!data?.orders?.byStatus || Object.keys(data.orders.byStatus).length === 0 ? (
                  <EmptyState title="Belum ada pesanan" description="Tidak ada pesanan untuk hari ini." />
                ) : (
                  <div className="space-y-2">
                    {Object.entries(data.orders.byStatus as Record<string, number>).map(([status, count]) => (
                      <div key={status} className="flex items-center justify-between py-1.5">
                        <StatusBadge status={status} />
                        <span className="font-semibold text-sm">{count} pesanan</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top customers */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top 5 Pelanggan</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {!data?.topCustomers?.length ? (
                  <div className="p-6">
                    <EmptyState title="Belum ada data" description="Belum ada pengiriman hari ini." />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pelanggan</TableHead>
                        <TableHead>Tipe</TableHead>
                        <TableHead className="text-right">Terkirim</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.topCustomers.map((c: any) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium text-sm">{c.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{c.customerType}</TableCell>
                          <TableCell className="text-right font-semibold text-sm">{c.totalDelivered} sak</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Return breakdown + rate */}
          {(data?.returnBreakdown?.length > 0 || returnRate > 0) && (
            <Card className="mt-6">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Alasan Retur Hari Ini</CardTitle>
                  {returnRate > 0 && (
                    <span className={`text-sm font-semibold ${returnRate > 10 ? 'text-destructive' : 'text-muted-foreground'}`}>
                      Return rate: {returnRate.toFixed(1)}%
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {data?.returnBreakdown?.length > 0 ? (
                  <div className="flex flex-wrap gap-3">
                    {data.returnBreakdown.map((r: any) => (
                      <div key={r.reason} className="rounded-lg border px-3 py-2 text-sm">
                        <span className="font-medium">{r.reason}</span>
                        <span className="text-muted-foreground ml-2">({r.count}x, {r.totalQty} sak)</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Belum ada retur hari ini.</p>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

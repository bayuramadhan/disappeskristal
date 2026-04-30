'use client'

import { useParams, useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ArrowLeft, MapPin, Phone, Tag } from 'lucide-react'
import { useCustomer } from '@/hooks/useCustomers'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ChannelTag } from '@/components/shared/ChannelTag'
import { LoadingState } from '@/components/shared/LoadingState'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency } from '@/lib/utils'

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data: customer, isLoading, error } = useCustomer(id)

  if (isLoading) return (
    <div className="space-y-4">
      <LoadingState rows={3} />
    </div>
  )

  if (error || !customer) return (
    <div className="text-center py-16">
      <p className="text-muted-foreground">Pelanggan tidak ditemukan</p>
      <Button variant="ghost" className="mt-4" onClick={() => router.back()}>Kembali</Button>
    </div>
  )

  const stats = customer.stats
  const orders = customer.recentOrders ?? []

  return (
    <div className="max-w-4xl">
      <Button variant="ghost" size="sm" className="gap-1.5 mb-4 -ml-2" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4" /> Kembali
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Profile card */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Info Pelanggan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="font-semibold text-lg">{customer.name}</p>
            </div>
            <div className="flex gap-2">
              <Badge variant="secondary">{customer.customerType}</Badge>
              <Badge variant={customer.activeStatus ? 'success' : 'destructive'}>
                {customer.activeStatus ? 'Aktif' : 'Nonaktif'}
              </Badge>
            </div>
            {customer.rayon && (
              <div className="flex items-center gap-2 text-sm">
                <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Rayon {customer.rayon.name}</span>
              </div>
            )}
            {customer.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{customer.phone}</span>
              </div>
            )}
            {customer.address && (
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <span>{customer.address}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-4">
          {[
            { label: 'Total Pesanan', value: stats?.totalOrders ?? 0, unit: 'pesanan' },
            { label: 'Total Terkirim', value: stats?.totalDeliveredQty ?? 0, unit: 'sak' },
            { label: 'Total Retur', value: stats?.totalReturnedQty ?? 0, unit: 'sak' },
            { label: 'Total Pendapatan', value: formatCurrency(stats?.totalRevenue ?? 0), unit: '' },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="pt-5">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-bold mt-1">{s.value}</p>
                {s.unit && <p className="text-xs text-muted-foreground">{s.unit}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Recent Orders */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Riwayat Pesanan (20 Terakhir)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6">Belum ada riwayat pesanan.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No. Pesanan</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Tanggal Kirim</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Nilai</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o: any) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs">{o.orderNumber}</TableCell>
                    <TableCell><ChannelTag channel={o.orderChannel} /></TableCell>
                    <TableCell className="text-sm">{o.deliveryDate ? format(new Date(o.deliveryDate), 'dd/MM/yyyy') : '-'}</TableCell>
                    <TableCell className="text-right text-sm">{o.orderedQty} sak</TableCell>
                    <TableCell className="text-right text-sm">{formatCurrency((o.deliveredQty ?? 0) * o.pricePerUnit)}</TableCell>
                    <TableCell><StatusBadge status={o.status} /></TableCell>
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

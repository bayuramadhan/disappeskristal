'use client'

import { useParams, useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ArrowLeft, MapPin, Phone, Tag, ShoppingBag } from 'lucide-react'
import { useCustomer } from '@/hooks/useCustomers'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ChannelTag } from '@/components/shared/ChannelTag'
import { LoadingState } from '@/components/shared/LoadingState'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency } from '@/lib/utils'

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data: customer, isLoading, error } = useCustomer(id)

  if (isLoading) return <div className="p-6"><LoadingState rows={6} /></div>

  if (error || !customer) return (
    <div className="text-center py-16">
      <p className="text-muted-foreground">Pelanggan tidak ditemukan</p>
      <Button variant="ghost" className="mt-4" onClick={() => router.back()}>Kembali</Button>
    </div>
  )

  const stats  = customer.stats
  const orders = customer.recentOrders ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold">{customer.name}</h1>
          <p className="text-sm text-muted-foreground">Detail pelanggan</p>
        </div>
      </div>

      {/* Info utama */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <Tag className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Tipe & Status</p>
              <div className="flex gap-1.5 mt-0.5 flex-wrap">
                <Badge variant="secondary">{customer.customerType}</Badge>
                <Badge variant={customer.activeStatus ? 'success' : 'destructive'}>
                  {customer.activeStatus ? 'Aktif' : 'Nonaktif'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <MapPin className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Rayon</p>
              <p className="font-medium truncate">{customer.rayon?.name ?? '-'}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <Phone className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">No. HP</p>
              <p className="font-medium truncate">{customer.phone ?? '-'}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <ShoppingBag className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Alamat</p>
              <p className="font-medium text-sm line-clamp-2">{customer.address ?? '-'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Statistik */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Total Pesanan',    value: stats?.totalOrders ?? 0,        unit: 'pesanan' },
          { label: 'Total Terkirim',   value: stats?.totalDeliveredQty ?? 0,  unit: 'sak' },
          { label: 'Total Retur',      value: stats?.totalReturnedQty ?? 0,   unit: 'sak' },
          { label: 'Total Pendapatan', value: formatCurrency(stats?.totalRevenue ?? 0), unit: '' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold mt-1">{s.value}</p>
              {s.unit && <p className="text-xs text-muted-foreground">{s.unit}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Riwayat Pesanan */}
      <Card>
        <CardHeader className="pb-2">
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

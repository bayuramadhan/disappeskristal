'use client'

import { useParams, useRouter } from 'next/navigation'
import useSWR from 'swr'
import { ArrowLeft, Phone, Truck, Activity, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LoadingState } from '@/components/shared/LoadingState'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'

const STATUS_LABELS: Record<string, string> = { ACTIVE: 'Aktif', INACTIVE: 'Tidak Aktif', ON_LEAVE: 'Cuti' }
const STATUS_VARIANTS: Record<string, 'success' | 'warning' | 'secondary'> = { ACTIVE: 'success', ON_LEAVE: 'warning', INACTIVE: 'secondary' }

const ATT_LABELS: Record<string, string> = { PRESENT: 'Hadir', ABSENT: 'Tidak Hadir', SICK: 'Sakit', LEAVE: 'Cuti' }
const ATT_VARIANTS: Record<string, 'success' | 'destructive' | 'warning' | 'secondary'> = {
  PRESENT: 'success', ABSENT: 'destructive', SICK: 'warning', LEAVE: 'secondary',
}

export default function DriverDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data: driver, isLoading } = useSWR(`/api/drivers/${id}`)

  if (isLoading) return <div className="p-6"><LoadingState rows={6} /></div>
  if (!driver) return <div className="p-6 text-muted-foreground">Driver tidak ditemukan.</div>

  const avgEfficiency = driver.driverPerformances?.length
    ? (driver.driverPerformances.reduce((s: number, p: any) => s + p.efficiencyScore, 0) / driver.driverPerformances.length * 100).toFixed(1)
    : null

  const totalDelivered = driver.driverPerformances?.reduce((s: number, p: any) => s + p.totalDelivered, 0) ?? 0
  const totalReturned  = driver.driverPerformances?.reduce((s: number, p: any) => s + p.totalReturned, 0) ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold">{driver.name}</h1>
          <p className="text-sm text-muted-foreground">Detail driver</p>
        </div>
      </div>

      {/* Info utama */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <Phone className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">No. HP</p>
              <p className="font-medium">{driver.phone ?? '-'}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <Truck className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Kendaraan</p>
              <p className="font-medium">{driver.assignedVehicle?.plateNumber ?? '-'}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <Activity className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <Badge variant={STATUS_VARIANTS[driver.status] ?? 'secondary'}>
                {STATUS_LABELS[driver.status] ?? driver.status}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Statistik performa */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Total Pengiriman (14 hari)</p>
            <p className="text-2xl font-bold">{totalDelivered} <span className="text-sm font-normal text-muted-foreground">sak</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Total Retur (14 hari)</p>
            <p className="text-2xl font-bold">{totalReturned} <span className="text-sm font-normal text-muted-foreground">sak</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Rata-rata Efisiensi (14 hari)</p>
            <p className="text-2xl font-bold">{avgEfficiency ? `${avgEfficiency}%` : '-'}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Absensi */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Absensi 14 Hari Terakhir
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!driver.driverAttendances?.length ? (
              <p className="p-4 text-sm text-muted-foreground">Belum ada data absensi.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {driver.driverAttendances.map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-sm">
                        {format(new Date(a.date), 'EEE, dd MMM yyyy', { locale: localeId })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={ATT_VARIANTS[a.status] ?? 'secondary'}>
                          {ATT_LABELS[a.status] ?? a.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Performa harian */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" /> Performa 14 Hari Terakhir
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!driver.driverPerformances?.length ? (
              <p className="p-4 text-sm text-muted-foreground">Belum ada data performa.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead className="text-right">Terkirim</TableHead>
                    <TableHead className="text-right">Retur</TableHead>
                    <TableHead className="text-right">Efisiensi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {driver.driverPerformances.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-sm">
                        {format(new Date(p.date), 'dd MMM', { locale: localeId })}
                      </TableCell>
                      <TableCell className="text-right text-sm">{p.totalDelivered}</TableCell>
                      <TableCell className="text-right text-sm">{p.totalReturned}</TableCell>
                      <TableCell className="text-right text-sm">{(p.efficiencyScore * 100).toFixed(0)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

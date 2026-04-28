import { Badge } from '@/components/ui/badge'

type OrderStatus = 'CREATED' | 'CONFIRMED' | 'LOADED' | 'DELIVERED' | 'PARTIAL' | 'RETURNED' | 'CANCELLED'

const statusConfig: Record<OrderStatus, { label: string; variant: 'default' | 'success' | 'warning' | 'destructive' | 'secondary' | 'info' }> = {
  CREATED:   { label: 'Dibuat',     variant: 'secondary' },
  CONFIRMED: { label: 'Dikonfirm',  variant: 'info' },
  LOADED:    { label: 'Dimuat',     variant: 'warning' },
  DELIVERED: { label: 'Terkirim',   variant: 'success' },
  PARTIAL:   { label: 'Sebagian',   variant: 'warning' },
  RETURNED:  { label: 'Dikembalik', variant: 'destructive' },
  CANCELLED: { label: 'Dibatalkan', variant: 'destructive' },
}

export function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status as OrderStatus] ?? { label: status, variant: 'secondary' as const }
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>
}

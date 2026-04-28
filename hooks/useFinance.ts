import useSWR from 'swr'

interface FinanceFilters {
  startDate?: string
  endDate?: string
  groupBy?: 'day' | 'vehicle' | 'rayon'
  vehicleId?: string
  rayonId?: string
}

export function useFinance(filters: FinanceFilters = {}) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== '') params.set(k, String(v))
  })
  const qs = params.toString()
  return useSWR(`/api/finance/revenue${qs ? `?${qs}` : ''}`)
}

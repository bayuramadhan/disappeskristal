import useSWR from 'swr'

interface OrderFilters {
  date?: string
  status?: string
  channel?: string
  rayonId?: string
  search?: string
  page?: number
  limit?: number
}

export function useOrders(filters: OrderFilters = {}) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== '') params.set(k, String(v))
  })
  const qs = params.toString()
  return useSWR(`/api/orders${qs ? `?${qs}` : ''}`)
}

export function useOrder(id: string | null) {
  return useSWR(id ? `/api/orders/${id}` : null)
}

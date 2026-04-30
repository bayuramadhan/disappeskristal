import useSWR from 'swr'

interface CustomerFilters {
  search?: string
  customerType?: string
  rayonId?: string
  page?: number
}

export function useCustomers(filters: CustomerFilters = {}) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== '') params.set(k, String(v))
  })
  const qs = params.toString()
  return useSWR(`/api/customers${qs ? `?${qs}` : ''}`)
}

export function useCustomer(id: string | null) {
  return useSWR(id ? `/api/customers/${id}` : null)
}

export function useRayons() {
  return useSWR('/api/rayons')
}

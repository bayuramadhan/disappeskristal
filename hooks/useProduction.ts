import useSWR from 'swr'

export function useProductionRecommendation(date?: string) {
  const params = date ? `?date=${date}` : ''
  return useSWR(`/api/production/recommendation${params}`)
}

export function useWarehouseStock(date?: string) {
  const params = date ? `?date=${date}` : ''
  return useSWR(`/api/warehouse/stock${params}`)
}

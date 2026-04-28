import useSWR from 'swr'

export function useDashboard(date?: string) {
  const params = date ? `?date=${date}` : ''
  return useSWR(`/api/dashboard/summary${params}`)
}

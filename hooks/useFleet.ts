import useSWR from 'swr'

export function useFleet(date?: string) {
  const params = date ? `?date=${date}` : ''
  return useSWR(`/api/fleet${params}`)
}

export function useVehicles() {
  return useSWR('/api/vehicles')
}

export function useDrivers() {
  return useSWR('/api/drivers')
}

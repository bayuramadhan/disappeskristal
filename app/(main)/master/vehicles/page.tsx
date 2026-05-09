'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function VehiclesRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/master/armada') }, [router])
  return null
}

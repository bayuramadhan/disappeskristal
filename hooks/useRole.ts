'use client'

import { useSession } from 'next-auth/react'

export type AppRole = 'ADMIN' | 'SUPERVISOR' | 'OPERATOR' | 'DRIVER' | 'SALES'

export function useRole() {
  const { data: session } = useSession()
  const role = ((session?.user as any)?.role ?? 'OPERATOR') as AppRole

  return {
    role,
    isAdmin:      role === 'ADMIN',
    isSupervisor: role === 'SUPERVISOR',
    isOperator:   role === 'OPERATOR',
    canWrite:     ['ADMIN', 'OPERATOR'].includes(role),
    canManage:    role === 'ADMIN',
    canViewFinance: ['ADMIN', 'SUPERVISOR'].includes(role),
  }
}

'use client'

import { SessionProvider } from 'next-auth/react'
import { SWRConfig } from 'swr'
import { fetcher } from '@/lib/fetcher'
import { Toaster } from '@/components/ui/toaster'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SWRConfig value={{ fetcher, revalidateOnFocus: false }}>
        {children}
        <Toaster />
      </SWRConfig>
    </SessionProvider>
  )
}

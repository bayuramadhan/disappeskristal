'use client'

import { useSession, signOut } from 'next-auth/react'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { LogOut, User, ChevronDown } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

export function Topbar() {
  const { data: session } = useSession()
  const today = format(new Date(), 'EEEE, dd MMMM yyyy', { locale: id })

  return (
    <header className="flex h-14 items-center justify-between border-b bg-white px-6 shrink-0">
      <div className="flex items-center gap-3">
        <div className="h-2 w-2 rounded-full bg-emerald-500" />
        <span className="text-sm text-muted-foreground capitalize">{today}</span>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex items-center gap-2 h-9 px-2">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="text-xs bg-sky-100 text-sky-700">
                {session?.user?.name?.slice(0, 2).toUpperCase() ?? 'AD'}
              </AvatarFallback>
            </Avatar>
            <div className="text-left hidden sm:block">
              <p className="text-xs font-medium leading-none">{session?.user?.name ?? 'Admin'}</p>
              <p className="text-xs text-muted-foreground">{(session?.user as any)?.role ?? 'ADMIN'}</p>
            </div>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Akun Saya</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="gap-2">
            <User className="h-4 w-4" /> Profil
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="gap-2 text-destructive focus:text-destructive"
            onClick={() => signOut({ callbackUrl: '/login' })}
          >
            <LogOut className="h-4 w-4" /> Keluar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}

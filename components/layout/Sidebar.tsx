'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard, ShoppingCart, Truck, Users, BarChart3,
  Factory, ChevronLeft, ChevronRight, IceCream2, UserCheck, MapPin, Tag,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRole } from '@/hooks/useRole'

type NavItem = { href: string; label: string; icon: React.ElementType; roles: string[] }

const operationalNav: NavItem[] = [
  { href: '/dashboard',  label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'SUPERVISOR', 'OPERATOR'] },
  { href: '/orders',     label: 'Pesanan',   icon: ShoppingCart,    roles: ['ADMIN', 'SUPERVISOR', 'OPERATOR'] },
  { href: '/fleet',      label: 'Armada',    icon: Truck,           roles: ['ADMIN', 'SUPERVISOR', 'OPERATOR'] },
  { href: '/finance',    label: 'Keuangan',  icon: BarChart3,       roles: ['ADMIN', 'SUPERVISOR'] },
  { href: '/production', label: 'Produksi',  icon: Factory,         roles: ['ADMIN', 'SUPERVISOR'] },
]

const masterNav: NavItem[] = [
  { href: '/customers',       label: 'Pelanggan', icon: Users,      roles: ['ADMIN', 'SUPERVISOR', 'OPERATOR'] },
  { href: '/master/vehicles', label: 'Kendaraan', icon: Truck,      roles: ['ADMIN', 'SUPERVISOR'] },
  { href: '/master/drivers',  label: 'Driver',    icon: UserCheck,  roles: ['ADMIN', 'SUPERVISOR'] },
  { href: '/master/rayons',          label: 'Rayon',       icon: MapPin,     roles: ['ADMIN', 'SUPERVISOR'] },
  { href: '/master/price-profiles',  label: 'Harga Jual',  icon: Tag,        roles: ['ADMIN', 'SUPERVISOR'] },
]

const roleLabel: Record<string, string> = {
  ADMIN:      'Admin',
  SUPERVISOR: 'Supervisor',
  OPERATOR:   'Operator',
  DRIVER:     'Driver',
  SALES:      'Sales',
}

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const { role } = useRole()

  function NavGroup({ items, label }: { items: NavItem[]; label?: string }) {
    const visible = items.filter(i => i.roles.includes(role))
    if (!visible.length) return null
    return (
      <div className="space-y-1">
        {label && !collapsed && (
          <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-500">{label}</p>
        )}
        {label && collapsed && <div className="my-2 border-t border-gray-700" />}
        {visible.map(({ href, label: itemLabel, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-md px-2 py-2.5 text-sm font-medium transition-colors',
                active ? 'bg-sky-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white',
                collapsed && 'justify-center'
              )}
              title={collapsed ? itemLabel : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{itemLabel}</span>}
            </Link>
          )
        })}
      </div>
    )
  }

  return (
    <aside
      className={cn(
        'relative flex flex-col bg-gray-900 text-gray-100 transition-all duration-300 ease-in-out',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className={cn('flex items-center gap-3 px-4 py-5 border-b border-gray-700', collapsed && 'justify-center px-2')}>
        <IceCream2 className="h-7 w-7 text-sky-400 shrink-0" />
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="font-bold text-sm leading-tight text-white">DistribusiPro</p>
            <p className="text-xs text-gray-400">Es Kristal</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
        <NavGroup items={operationalNav} />
        <NavGroup items={masterNav} label="Master Data" />
      </nav>

      {/* Role badge */}
      {!collapsed && (
        <div className="px-4 pb-4">
          <span className="inline-flex items-center rounded-full bg-gray-800 px-2.5 py-1 text-xs text-gray-400">
            {roleLabel[role] ?? role}
          </span>
        </div>
      )}

      {/* Collapse button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-gray-700 bg-gray-800 text-gray-400 hover:text-white shadow-md"
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>
    </aside>
  )
}

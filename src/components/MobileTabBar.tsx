'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

function Tab({ href, label }: { href: string; label: string }) {
  const pathname = usePathname()
  const active = pathname === href
  return (
    <Link
      href={href}
      prefetch={false}
      className={active ? 'tabItem tabItemActive' : 'tabItem'}
    >
      {label}
    </Link>
  )
}

export function MobileTabBar() {
  return (
    <nav className="tabBar" aria-label="Primary">
      <Tab href="/app/add" label="Add" />
      <Tab href="/app/expenses" label="Expenses" />
      <Tab href="/app/dashboard" label="Dashboard" />
      <Tab href="/app/account" label="Account" />
    </nav>
  )
}

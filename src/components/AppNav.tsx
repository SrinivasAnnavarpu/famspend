'use client'

import { usePathname, useRouter } from 'next/navigation'

function NavBtn({
  label,
  href,
}: {
  label: string
  href: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const active = pathname === href

  return (
    <button
      className={active ? 'btn btnPrimary' : 'btn'}
      onClick={() => router.push(href)}
      style={active ? { padding: '10px 12px' } : { padding: '10px 12px' }}
    >
      {label}
    </button>
  )
}

export function AppNav() {
  return (
    <div className="row">
      <NavBtn label="Add" href="/app/add" />
      <NavBtn label="Expenses" href="/app/expenses" />
      <NavBtn label="Dashboard" href="/app/dashboard" />
      <NavBtn label="Invite" href="/app#invite" />
      <NavBtn label="Settings" href="/app" />
    </div>
  )
}

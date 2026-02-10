'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useCurrentFamily } from '@/lib/familyContext'
import { MobileTabBar } from '@/components/MobileTabBar'

function NavLink({
  href,
  label,
  onNavigate,
}: {
  href: string
  label: string
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const active = pathname === href

  return (
    <Link
      href={href}
      className={active ? 'sideLink sideLinkActive' : 'sideLink'}
      prefetch={false}
      onClick={() => onNavigate?.()}
    >
      {label}
    </Link>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { profile } = useCurrentFamily()

  const [open, setOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  // Mobile: drawer closed by default. Desktop: sidebar open by default.
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 860px)')

    function sync() {
      setOpen(!mq.matches)
    }

    sync()
    mq.addEventListener?.('change', sync)
    return () => mq.removeEventListener?.('change', sync)
  }, [])

  const who = useMemo(() => {
    const name = profile?.display_name?.trim()
    return name && name.length > 0 ? name : 'Account'
  }, [profile?.display_name])

  async function signOut() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <div className="appShell">
      <header className="topNav">
        <div className="topNavLeft">
          <button className="iconBtn" onClick={() => setOpen((v) => !v)} aria-label="Toggle menu">
            ☰
          </button>
          <Link href="/app/add" className="brand" prefetch={false}>
            <span className="logo" aria-hidden />
            <span className="brandTitle">FamSpend</span>
          </Link>
        </div>

        <div className="topNavRight">
          <div className="profileWrap">
            <button className="profileBtn" onClick={() => setMenuOpen((v) => !v)}>
              <span className="avatar" aria-hidden>
                {(who[0] ?? 'A').toUpperCase()}
              </span>
              <span className="profileName">{who}</span>
              <span className="caret" aria-hidden>▾</span>
            </button>

            {menuOpen ? (
              <div className="profileMenu" role="menu">
                <button className="menuItem" onClick={() => { setMenuOpen(false); router.push('/app/account') }}>
                  Account
                </button>
                <button className="menuItem" onClick={() => { setMenuOpen(false); router.push('/app/account/invite') }}>
                  Invite
                </button>
                <div className="menuSep" />
                <button className="menuItem" onClick={() => { setMenuOpen(false); void signOut() }}>
                  Sign out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className={open ? 'appBody' : 'appBody appBodyClosed'}>
        <aside className={open ? 'sideNav sideNavOpen' : 'sideNav sideNavClosed'}>
          <div className="sideSection">Main</div>
          <NavLink href="/app/add" label="Add" onNavigate={() => setOpen(false)} />
          <NavLink href="/app/expenses" label="Expenses" onNavigate={() => setOpen(false)} />
          <NavLink href="/app/dashboard" label="Dashboard" onNavigate={() => setOpen(false)} />

          <div className="sideSection" style={{ marginTop: 12 }}>Account</div>
          <NavLink href="/app/account" label="Account" onNavigate={() => setOpen(false)} />
          <NavLink href="/app/account/invite" label="Invite" onNavigate={() => setOpen(false)} />

          <div className="sideFooter">
            <span className="help">{pathname}</span>
          </div>
        </aside>

        {open ? <div className="sideBackdrop" onClick={() => setOpen(false)} /> : null}

        <main className="appMain">{children}</main>
        <MobileTabBar />
      </div>
    </div>
  )
}

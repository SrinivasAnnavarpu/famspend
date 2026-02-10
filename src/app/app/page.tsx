'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type Family = {
  id: string
  name: string
  base_currency: string
  created_by: string
}

type Membership = {
  family_id: string
  role: string
}

export default function AppHome() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [email, setEmail] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [family, setFamily] = useState<Family | null>(null)
  const [membership, setMembership] = useState<Membership | null>(null)
  const [error, setError] = useState<string | null>(null)

  const authed = useMemo(() => Boolean(userId), [userId])

  const load = useCallback(async () => {
    setError(null)
    const { data } = await supabase.auth.getSession()
    const session = data.session
    if (!session) {
      router.replace('/login')
      return
    }

    setEmail(session.user.email ?? null)
    setUserId(session.user.id)

    // Fetch membership(s). For MVP we assume a user is in 0 or 1 family.
    const { data: memberships, error: mErr } = await supabase
      .from('family_members')
      .select('family_id, role')
      .eq('user_id', session.user.id)
      .limit(1)

    if (mErr) {
      setError(mErr.message)
      return
    }

    const m = memberships?.[0] ?? null
    setMembership(m)

    if (!m) {
      setFamily(null)
      return
    }

    const { data: fam, error: fErr } = await supabase
      .from('families')
      .select('id, name, base_currency, created_by')
      .eq('id', m.family_id)
      .maybeSingle()

    if (fErr) {
      setError(fErr.message)
      return
    }

    setFamily(fam ?? null)
  }, [router])

  useEffect(() => {
    let mounted = true

    load().finally(() => {
      if (!mounted) return
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace('/login')
      else void load()
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [router, load])

  async function signOut() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  async function createFamily() {
    if (!userId) return
    setBusy(true)
    setError(null)
    try {
      // 1) create family
      const { data: fam, error: famErr } = await supabase
        .from('families')
        .insert({ name: 'My Family', base_currency: 'USD', created_by: userId })
        .select('id, name, base_currency, created_by')
        .single()

      if (famErr) throw famErr

      // 2) add creator as owner
      const { error: memErr } = await supabase
        .from('family_members')
        .insert({ family_id: fam.id, user_id: userId, role: 'owner' })

      if (memErr) throw memErr

      // 3) seed categories
      const seed = ['Food', 'Rent', 'Utilities', 'Travel', 'Shopping', 'Health', 'Other']
      const { error: catErr } = await supabase.from('categories').insert(
        seed.map((name, idx) => ({ family_id: fam.id, name, sort_order: idx }))
      )

      if (catErr) throw catErr

      await load()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: '40px auto', padding: 16 }}>
      <h1 style={{ fontSize: 28, margin: 0 }}>FamSpend</h1>
      <p style={{ color: '#475569', marginTop: 8 }}>
        Signed in as: <b>{email ?? '…'}</b>
      </p>

      <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
        <button
          onClick={signOut}
          style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #cbd5e1', background: 'white', fontWeight: 700 }}
        >
          Sign out
        </button>
      </div>

      {error ? (
        <div style={{ marginTop: 14, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: 10, borderRadius: 10 }}>
          {error}
        </div>
      ) : null}

      <hr style={{ margin: '24px 0', border: 0, borderTop: '1px solid #e2e8f0' }} />

      {!authed ? (
        <p style={{ color: '#64748b' }}>Loading…</p>
      ) : family ? (
        <>
          <h2 style={{ fontSize: 18, margin: 0 }}>Family</h2>
          <p style={{ color: '#334155', marginTop: 8 }}>
            <b>{family.name}</b> (base currency: {family.base_currency})
          </p>
          <p style={{ color: '#64748b', marginTop: 8 }}>
            Next: Add Expense screen.
          </p>
        </>
      ) : (
        <>
          <h2 style={{ fontSize: 18, margin: 0 }}>Get started</h2>
          <p style={{ color: '#64748b', marginTop: 8 }}>
            You’re not in a family yet. Create one to start tracking expenses.
          </p>
          <button
            disabled={busy}
            onClick={createFamily}
            style={{ marginTop: 10, padding: '10px 12px', borderRadius: 10, border: '1px solid #0f172a', background: '#0f172a', color: 'white', fontWeight: 800 }}
          >
            {busy ? 'Creating…' : 'Create My Family'}
          </button>
          {membership ? (
            <p style={{ color: '#64748b', marginTop: 10 }}>
              (Found membership but couldn’t load family. This usually means an RLS/policy issue.)
            </p>
          ) : null}
        </>
      )}
    </main>
  )
}

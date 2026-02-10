'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = searchParams.get('next')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace(nextPath ?? '/app')
    })
  }, [router, nextPath])

  async function signUp() {
    setBusy(true)
    setError(null)
    try {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) throw error
      alert('Signup successful. If email confirmation is enabled, check your inbox.')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  async function signIn() {
    setBusy(true)
    setError(null)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      router.replace(nextPath ?? '/app')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  async function signInWithGoogle() {
    setBusy(true)
    setError(null)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) throw error
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      setBusy(false)
    }
  }

  return (
    <div className="container" style={{ maxWidth: 560 }}>
      <div className="header">
        <div className="brand">
          <div className="logo" aria-hidden />
          <div className="brandTitle">FamSpend</div>
        </div>
      </div>

      <div className="card">
        <div className="cardBody" style={{ padding: 22 }}>
          <h1 className="h1" style={{ fontSize: 30 }}>Welcome back</h1>
          <p className="p">Sign in with email or Google.</p>

          <div style={{ marginTop: 16, display: 'grid', gap: 10 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span className="help">Email</span>
              <input
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span className="help">Password</span>
              <input
                className="input"
                value={password}
                type="password"
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </label>

            {error ? <div className="alertError">{error}</div> : null}

            <div className="row" style={{ marginTop: 4 }}>
              <button className="btn btnPrimary" disabled={busy} onClick={signIn}>
                Sign in
              </button>
              <button className="btn" disabled={busy} onClick={signUp}>
                Sign up
              </button>
            </div>

            <button className="btn btnGhost" disabled={busy} onClick={signInWithGoogle}>
              Continue with Google
            </button>

            <p className="help" style={{ marginTop: 8 }}>
              Tip: Use the same account on both phones to sync into the same family.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

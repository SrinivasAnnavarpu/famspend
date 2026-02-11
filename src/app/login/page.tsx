'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

function LoginInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = searchParams.get('next')
  const signedUp = searchParams.get('signedUp') === '1'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace(nextPath ?? '/app')
    })
  }, [router, nextPath])

  function goToSignUp() {
    const next = nextPath ? `?next=${encodeURIComponent(nextPath)}` : ''
    router.push(`/signup${next}`)
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
      const next = nextPath ? `?next=${encodeURIComponent(nextPath)}` : ''
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback${next}`,
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
          {signedUp ? (
            <div className="card" style={{ marginTop: 12 }}>
              <div className="cardBody" style={{ padding: 12, color: '#475569' }}>
                Account created. If email verification is enabled, please check your inbox and confirm, then sign in.
              </div>
            </div>
          ) : null}

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
              <button className="btn" disabled={busy} onClick={goToSignUp}>
                Sign up
              </button>
            </div>

            <button className="btn btnGhost" disabled={busy} onClick={signInWithGoogle}>
              Continue with Google
            </button>

            <div className="row" style={{ marginTop: 8, justifyContent: 'space-between' }}>
              <button
                className="btn btnGhost"
                disabled={busy}
                onClick={() => router.push(nextPath ? `/forgot?next=${encodeURIComponent(nextPath)}` : '/forgot')}
              >
                Forgot password?
              </button>
              <span className="help" style={{ alignSelf: 'center' }}>
                Tip: Each person should sign in with their own account.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  // Next.js requires useSearchParams usage be wrapped in Suspense.
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  )
}

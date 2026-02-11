'use client'

import { Suspense, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { isEmail } from '@/lib/validate'

function ForgotInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = searchParams.get('next')

  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = useMemo(() => {
    const e = email.trim()
    return Boolean(e) && isEmail(e)
  }, [email])

  async function send() {
    setBusy(true)
    setError(null)
    try {
      const redirectTo = `${window.location.origin}/auth/recovery${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ''}`
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo })
      if (error) throw error

      // Do not leak whether email exists.
      setSent(true)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container" style={{ maxWidth: 560 }}>
      <div className="header">
        <Link href="/" className="brand" prefetch={false}>
          <div className="logo" aria-hidden />
          <div className="brandTitle">FamSpend</div>
        </Link>
      </div>

      <div className="card">
        <div className="cardBody" style={{ padding: 22 }}>
          <h1 className="h1" style={{ fontSize: 30 }}>Forgot password</h1>
          <p className="p">Enter your email and we’ll send a reset link.</p>

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

            {error ? <div className="alertError">{error}</div> : null}

            {sent ? (
              <div className="card" style={{ marginTop: 6 }}>
                <div className="cardBody" style={{ padding: 12, color: '#475569' }}>
                  If an account exists for that email, you’ll receive a password reset link shortly.
                </div>
              </div>
            ) : null}

            <button className="btn btnPrimary" disabled={busy || !canSubmit} onClick={() => void send()}>
              {busy ? 'Sending…' : 'Send reset link'}
            </button>

            <p className="help" style={{ marginTop: 8 }}>
              <Link href={nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : '/login'} prefetch={false}>
                Back to sign in
              </Link>
            </p>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <button className="btn btnGhost" onClick={() => router.push(nextPath ?? '/login')}>Cancel</button>
      </div>
    </div>
  )
}

export default function ForgotPage() {
  return (
    <Suspense>
      <ForgotInner />
    </Suspense>
  )
}

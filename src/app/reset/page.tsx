'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

function ResetInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = searchParams.get('next')

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      // Must have a recovery session to reset.
      setReady(Boolean(data.session))
    })
  }, [])

  const canSubmit = useMemo(() => {
    if (password.length < 8) return false
    if (password !== confirm) return false
    return true
  }, [password, confirm])

  async function update() {
    setBusy(true)
    setError(null)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error

      // After reset, sign out recovery session and go to login.
      await supabase.auth.signOut()
      const next = nextPath ? `?next=${encodeURIComponent(nextPath)}` : ''
      router.replace(`/login${next}`)
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
          <h1 className="h1" style={{ fontSize: 30 }}>Reset password</h1>
          {!ready ? (
            <p className="p">This reset link is invalid or expired. Please request a new one.</p>
          ) : (
            <>
              <p className="p">Choose a new password.</p>
              <div style={{ marginTop: 16, display: 'grid', gap: 10 }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span className="help">New password</span>
                  <input
                    className="input"
                    value={password}
                    type="password"
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </label>

                <label style={{ display: 'grid', gap: 6 }}>
                  <span className="help">Confirm password</span>
                  <input
                    className="input"
                    value={confirm}
                    type="password"
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
                  />
                </label>

                {error ? <div className="alertError">{error}</div> : null}

                <button className="btn btnPrimary" disabled={busy || !canSubmit} onClick={() => void update()}>
                  {busy ? 'Updating…' : 'Update password'}
                </button>
              </div>
            </>
          )}

          <p className="help" style={{ marginTop: 10 }}>
            <Link href={nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : '/login'} prefetch={false}>
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function ResetPage() {
  return (
    <Suspense>
      <ResetInner />
    </Suspense>
  )
}

'use client'

import { Suspense, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

function guessCurrency(country: string) {
  const c = country.toLowerCase()
  if (c === 'india') return 'INR'
  if (c === 'united kingdom' || c === 'uk') return 'GBP'
  if (c === 'canada') return 'CAD'
  if (c === 'australia') return 'AUD'
  if (c === 'japan') return 'JPY'
  if (c === 'singapore') return 'SGD'
  if (c === 'germany' || c === 'france' || c === 'spain' || c === 'italy' || c === 'netherlands') return 'EUR'
  return 'USD'
}

function SignupInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = searchParams.get('next')

  const [username, setUsername] = useState('')
  const [country, setCountry] = useState('United States')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const countries = useMemo(
    () => [
      'United States',
      'India',
      'Canada',
      'United Kingdom',
      'Australia',
      'Germany',
      'France',
      'Japan',
      'Singapore',
      'Other',
    ],
    []
  )

  async function signUp() {
    setBusy(true)
    setError(null)
    try {
      const u = username.trim()
      if (!u) throw new Error('Enter a username')
      if (!email.trim()) throw new Error('Enter an email')
      if (password.length < 6) throw new Error('Password must be at least 6 characters')
      if (password !== confirm) throw new Error('Passwords do not match')

      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC'
      const defaultCurrency = guessCurrency(country)

      const { data, error: sErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            username: u,
            country,
          },
        },
      })
      if (sErr) throw sErr

      // If email confirmations are OFF, we should have a session and can create the profile row.
      const userId = data.user?.id
      if (userId) {
        // Best-effort: profile RLS may block in some envs.
        await supabase.from('profiles').upsert(
          {
            user_id: userId,
            display_name: u,
            default_currency: defaultCurrency,
            timezone: tz,
          },
          { onConflict: 'user_id' }
        )
      }

      router.replace(nextPath ?? '/app')
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
          <h1 className="h1" style={{ fontSize: 30 }}>Create account</h1>
          <p className="p">Set up your profile. You can join a family via invite link after signing in.</p>

          <div style={{ marginTop: 16, display: 'grid', gap: 10 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span className="help">Username</span>
              <input
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g., Manash"
                autoComplete="name"
              />
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span className="help">Location (Country)</span>
              <select className="input" value={country} onChange={(e) => setCountry(e.target.value)}>
                {countries.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <span className="help">We’ll use this to set a default timezone and currency (you can change later if owner).</span>
            </label>

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
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </label>

            {error ? <div className="alertError">{error}</div> : null}

            <button className="btn btnPrimary" disabled={busy} onClick={() => void signUp()}>
              {busy ? 'Creating…' : 'Create account'}
            </button>

            <p className="help" style={{ marginTop: 8 }}>
              Already have an account?{' '}
              <Link href={nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : '/login'} prefetch={false}>
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SignupPage() {
  // Next.js requires useSearchParams usage be wrapped in Suspense.
  return (
    <Suspense>
      <SignupInner />
    </Suspense>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/app')
    })
  }, [router])

  async function signUp() {
    setBusy(true)
    setError(null)
    try {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) throw error
      alert('Signup successful. If email confirmation is enabled, check your inbox.')
    } catch (e: any) {
      setError(e?.message ?? String(e))
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
      router.replace('/app')
    } catch (e: any) {
      setError(e?.message ?? String(e))
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
    } catch (e: any) {
      setError(e?.message ?? String(e))
      setBusy(false)
    }
  }

  return (
    <main style={{ maxWidth: 420, margin: '60px auto', padding: 16 }}>
      <h1 style={{ fontSize: 28, margin: 0 }}>Login</h1>
      <p style={{ color: '#64748b', marginTop: 6 }}>Email/password or Google.</p>

      <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 13, color: '#334155' }}>Email</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{ padding: 10, borderRadius: 10, border: '1px solid #cbd5e1' }}
          />
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 13, color: '#334155' }}>Password</span>
          <input
            value={password}
            type="password"
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            style={{ padding: 10, borderRadius: 10, border: '1px solid #cbd5e1' }}
          />
        </label>

        {error ? (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: 10, borderRadius: 10 }}>
            {error}
          </div>
        ) : null}

        <button
          disabled={busy}
          onClick={signIn}
          style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #0f172a', background: '#0f172a', color: 'white', fontWeight: 700 }}
        >
          Sign in
        </button>

        <button
          disabled={busy}
          onClick={signUp}
          style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #cbd5e1', background: 'white', color: '#0f172a', fontWeight: 700 }}
        >
          Sign up
        </button>

        <button
          disabled={busy}
          onClick={signInWithGoogle}
          style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a', fontWeight: 700 }}
        >
          Continue with Google
        </button>
      </div>
    </main>
  )
}

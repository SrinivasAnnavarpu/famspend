'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function AppHome() {
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      if (!data.session) {
        router.replace('/login')
        return
      }
      setEmail(data.session.user.email ?? null)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace('/login')
      else setEmail(session.user.email ?? null)
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [router])

  async function signOut() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <main style={{ maxWidth: 720, margin: '40px auto', padding: 16 }}>
      <h1 style={{ fontSize: 28, margin: 0 }}>FamSpend (App)</h1>
      <p style={{ color: '#475569', marginTop: 8 }}>
        Signed in as: <b>{email ?? '…'}</b>
      </p>

      <div style={{ marginTop: 16 }}>
        <button
          onClick={signOut}
          style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #cbd5e1', background: 'white', fontWeight: 700 }}
        >
          Sign out
        </button>
      </div>

      <hr style={{ margin: '24px 0', border: 0, borderTop: '1px solid #e2e8f0' }} />
      <p style={{ color: '#64748b' }}>
        Next: create the database tables (families, categories, expenses) and build the Add Expense screen.
      </p>
    </main>
  )
}

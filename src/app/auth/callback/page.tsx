'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    // Supabase JS will parse the URL hash/query and store the session automatically.
    // We just wait a moment and then route to the app.
    supabase.auth.getSession().then(() => {
      router.replace('/app')
    })
  }, [router])

  return (
    <main style={{ maxWidth: 520, margin: '60px auto', padding: 16 }}>
      <h1 style={{ fontSize: 24, margin: 0 }}>Signing you in…</h1>
      <p style={{ color: '#64748b', marginTop: 8 }}>If this takes more than a few seconds, go back and try again.</p>
    </main>
  )
}

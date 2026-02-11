'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

function AuthCallbackInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = searchParams.get('next')

  useEffect(() => {
    // Supabase JS will parse the URL hash/query and store the session automatically.
    // We just wait a moment and then route where the user intended to go.
    supabase.auth.getSession().then(() => {
      router.replace(nextPath ?? '/app')
    })
  }, [router, nextPath])

  return (
    <main style={{ maxWidth: 520, margin: '60px auto', padding: 16 }}>
      <h1 style={{ fontSize: 24, margin: 0 }}>Signing you in…</h1>
      <p style={{ color: '#64748b', marginTop: 8 }}>If this takes more than a few seconds, go back and try again.</p>
    </main>
  )
}

export default function AuthCallbackPage() {
  // Next.js requires useSearchParams usage be wrapped in Suspense.
  return (
    <Suspense>
      <AuthCallbackInner />
    </Suspense>
  )
}

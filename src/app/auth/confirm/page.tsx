'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

function ConfirmInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = searchParams.get('next')

  const [msg, setMsg] = useState('Confirming your email…')

  useEffect(() => {
    async function run() {
      try {
        // For email confirmation links (PKCE), Supabase provides a `code` query param.
        // exchangeCodeForSession will store the session.
        const { error } = await supabase.auth.exchangeCodeForSession(window.location.href)
        if (error) throw error
        setMsg('Email confirmed. Redirecting…')
        router.replace(nextPath ?? '/login')
      } catch (e: unknown) {
        const emsg = e instanceof Error ? e.message : String(e)
        setMsg(`Confirmation failed: ${emsg}`)
      }
    }

    void run()
  }, [router, nextPath])

  return (
    <main style={{ maxWidth: 520, margin: '60px auto', padding: 16 }}>
      <h1 style={{ fontSize: 24, margin: 0 }}>FamSpend</h1>
      <p style={{ color: '#475569', marginTop: 10 }}>{msg}</p>
      <p style={{ color: '#64748b', marginTop: 10 }}>
        If this doesn’t work, go back to Login and try signing in again.
      </p>
    </main>
  )
}

export default function ConfirmPage() {
  // Next.js requires useSearchParams usage be wrapped in Suspense.
  return (
    <Suspense>
      <ConfirmInner />
    </Suspense>
  )
}

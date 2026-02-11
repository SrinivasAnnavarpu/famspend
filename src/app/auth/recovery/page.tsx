'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

function RecoveryInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = searchParams.get('next')
  const [msg, setMsg] = useState('Opening reset form…')

  useEffect(() => {
    async function run() {
      try {
        // Exchange recovery code for a session.
        const { error } = await supabase.auth.exchangeCodeForSession(window.location.href)
        if (error) throw error
        router.replace(nextPath ? `/reset?next=${encodeURIComponent(nextPath)}` : '/reset')
      } catch (e: unknown) {
        const emsg = e instanceof Error ? e.message : String(e)
        setMsg(`Recovery failed: ${emsg}`)
      }
    }

    void run()
  }, [router, nextPath])

  return (
    <main style={{ maxWidth: 520, margin: '60px auto', padding: 16 }}>
      <h1 style={{ fontSize: 24, margin: 0 }}>FamSpend</h1>
      <p style={{ color: '#475569', marginTop: 10 }}>{msg}</p>
    </main>
  )
}

export default function RecoveryPage() {
  return (
    <Suspense>
      <RecoveryInner />
    </Suspense>
  )
}

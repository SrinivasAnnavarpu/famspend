'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ToastProvider'

export default function InviteAcceptPage() {
  const params = useParams<{ token: string }>()
  const token = params?.token
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(true)

  useEffect(() => {
    async function run() {
      try {
        const { data } = await supabase.auth.getSession()
        const session = data.session
        if (!session) {
          router.replace(`/login?next=${encodeURIComponent(`/invite/${token}`)}`)
          return
        }

        const { error } = await supabase.rpc('accept_invite', { p_token: token })
        if (error) throw error

        toast.success('Invite accepted')
        router.replace('/app')
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        toast.error(msg, 'Invite failed')
      } finally {
        setBusy(false)
      }
    }

    if (token) void run()
  }, [token, router, toast])

  return (
    <div className="container" style={{ maxWidth: 720 }}>
      <div className="card">
        <div className="cardBody" style={{ padding: 22 }}>
          <div className="badge">FamSpend</div>
          <h1 className="h1" style={{ fontSize: 30, marginTop: 12 }}>Joining family…</h1>
          <p className="p">{busy ? 'Please wait.' : 'You can close this tab.'}</p>
        </div>
      </div>
    </div>
  )
}

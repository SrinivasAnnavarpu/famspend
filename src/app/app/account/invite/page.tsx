'use client'

import { useMemo, useState } from 'react'
import { useCurrentFamily } from '@/lib/familyContext'
import { useToast } from '@/components/ToastProvider'
import { supabase } from '@/lib/supabaseClient'
import { randomHex } from '@/lib/invite'

export default function InvitePage() {
  const toast = useToast()
  const { family, userId, members } = useCurrentFamily()
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteLink, setInviteLink] = useState<string | null>(null)

  const isOwner = useMemo(() => {
    if (!userId) return false
    return members.some((m) => m.user_id === userId && m.role === 'owner')
  }, [members, userId])

  async function createInvite() {
    if (!family) return
    if (!isOwner) {
      toast.error('Only the family owner can create invite links')
      return
    }
    setInviteBusy(true)

    async function copy(url: string) {
      setInviteLink(url)
      await navigator.clipboard.writeText(url)
      toast.success('Invite link copied')
    }

    try {
      // Preferred path: DB RPC
      const { data: token, error } = await supabase.rpc('create_invite', { p_family_id: family.id })
      if (!error && token) {
        const url = `${window.location.origin}/invite/${token}`
        await copy(url)
        return
      }

      // Fallback path: direct insert (works if RLS policy allows and table exists)
      const token2 = randomHex(16)
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      const { data: sessionData } = await supabase.auth.getSession()
      const userId = sessionData.session?.user.id
      if (!userId) throw error ?? new Error('Not authenticated')

      const { error: insErr } = await supabase.from('family_invites').insert({
        family_id: family.id,
        created_by: userId,
        token: token2,
        expires_at: expiresAt,
      })

      if (insErr) throw error ?? insErr

      const url = `${window.location.origin}/invite/${token2}`
      await copy(url)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      toast.error(msg, 'Invite failed')
    } finally {
      setInviteBusy(false)
    }
  }

  return (
    <div className="container">
      <div className="card">
        <div className="cardBody" style={{ padding: 22 }}>
          <div className="badge">Invite</div>
          <h1 className="h1" style={{ fontSize: 30, marginTop: 12 }}>Invite family member</h1>
          <p className="p">Generate a single-use link (expires in 7 days).</p>

          <div className="row" style={{ marginTop: 14, alignItems: 'center' }}>
            <button className="btn btnPrimary" disabled={inviteBusy} onClick={() => void createInvite()}>
              {inviteBusy ? 'Generating…' : 'Create invite link'}
            </button>
            {inviteLink ? (
              <div className="badge" style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {inviteLink}
              </div>
            ) : null}
          </div>

          <p className="help" style={{ marginTop: 10 }}>
            Tip: open the link on the other phone. They’ll be asked to sign in, then joined to your family.
          </p>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useCurrentFamily } from '@/lib/familyContext'
import { useToast } from '@/components/ToastProvider'
import { supabase } from '@/lib/supabaseClient'

export default function InvitePage() {
  const toast = useToast()
  const { family } = useCurrentFamily()
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteLink, setInviteLink] = useState<string | null>(null)

  async function createInvite() {
    if (!family) return
    setInviteBusy(true)
    try {
      const { data: token, error } = await supabase.rpc('create_invite', { p_family_id: family.id })
      if (error) throw error
      const url = `${window.location.origin}/invite/${token}`
      setInviteLink(url)
      await navigator.clipboard.writeText(url)
      toast.success('Invite link copied')
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

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ToastProvider'
import { supabase } from '@/lib/supabaseClient'
import { clampLen } from '@/lib/validate'

type Family = {
  id: string
  name: string
  base_currency: string
}

type Membership = {
  family_id: string
  role: string
}

function extractInviteToken(input: string) {
  const s = input.trim()
  if (!s) return null

  // Accept token itself, full URL, or /invite/<token>
  const m1 = s.match(/\/invite\/([a-f0-9]{16,64})/i)
  if (m1?.[1]) return m1[1]

  const m2 = s.match(/^([a-f0-9]{16,64})$/i)
  if (m2?.[1]) return m2[1]

  return null
}

export default function AppHome() {
  const router = useRouter()
  const toast = useToast()

  const [busyCreate, setBusyCreate] = useState(false)
  const [busyJoin, setBusyJoin] = useState(false)

  const [email, setEmail] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [family, setFamily] = useState<Family | null>(null)
  const [membership, setMembership] = useState<Membership | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [familyName, setFamilyName] = useState('My Family')
  const [inviteInput, setInviteInput] = useState('')
  const [errs, setErrs] = useState<{ familyName?: string; invite?: string }>({})

  const authed = useMemo(() => Boolean(userId), [userId])

  const load = useCallback(async () => {
    setError(null)
    const { data } = await supabase.auth.getSession()
    const session = data.session
    if (!session) {
      router.replace('/login')
      return
    }

    setEmail(session.user.email ?? null)
    setUserId(session.user.id)

    const { data: memberships, error: mErr } = await supabase
      .from('family_members')
      .select('family_id, role')
      .eq('user_id', session.user.id)
      .limit(1)

    if (mErr) {
      setError(mErr.message)
      return
    }

    const m = memberships?.[0] ?? null
    setMembership(m)

    if (!m) {
      setFamily(null)
      return
    }

    const { data: fam, error: fErr } = await supabase
      .from('families')
      .select('id, name, base_currency')
      .eq('id', m.family_id)
      .maybeSingle()

    if (fErr) {
      setError(fErr.message)
      return
    }

    setFamily((fam as Family) ?? null)

    // User has a family → send to dashboard.
    router.replace('/app/dashboard')
  }, [router])

  useEffect(() => {
    void load()
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace('/login')
      else void load()
    })
    return () => sub.subscription.unsubscribe()
  }, [router, load])

  async function createFamily() {
    if (!userId) return

    const name = familyName.trim()
    const nextErrs: { familyName?: string } = {}
    if (!name) nextErrs.familyName = 'Enter a family name'
    setErrs((p) => ({ ...p, ...nextErrs }))
    if (Object.keys(nextErrs).length > 0) {
      toast.error('Please fix the highlighted fields')
      return
    }

    setBusyCreate(true)
    setError(null)
    try {
      const { data: familyId, error: rpcErr } = await supabase.rpc('create_family', {
        p_name: clampLen(name, 60),
      })

      if (rpcErr) throw rpcErr
      if (!familyId) throw new Error('Failed to create family')

      toast.success('Family created')
      await load()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      toast.error(msg, 'Create family failed')
    } finally {
      setBusyCreate(false)
    }
  }

  async function joinWithInvite() {
    const token = extractInviteToken(inviteInput)
    const nextErrs: { invite?: string } = {}
    if (!token) nextErrs.invite = 'Paste a valid invite link or token'

    setErrs((p) => ({ ...p, ...nextErrs }))
    if (Object.keys(nextErrs).length > 0) {
      toast.error('Please fix the highlighted fields')
      return
    }

    setBusyJoin(true)
    try {
      router.push(`/invite/${token}`)
    } finally {
      setBusyJoin(false)
    }
  }

  return (
    <div className="container">
      <div className="header">
        <div>
          <div className="brandTitle">Welcome</div>
          <div className="help">Let’s get you set up.</div>
        </div>
      </div>

      <div className="card">
        <div className="cardBody" style={{ padding: 22 }}>
          <div className="h2">Account</div>
          <p className="p" style={{ marginTop: 6 }}>
            Signed in as: <b>{email ?? '…'}</b>
          </p>

          {error ? <div className="alertError" style={{ marginTop: 12 }}>{error}</div> : null}

          <hr style={{ margin: '18px 0', border: 0, borderTop: '1px solid rgba(15, 23, 42, 0.10)' }} />

          {!authed ? (
            <p className="help">Loading…</p>
          ) : family ? (
            <p className="help">Redirecting to your dashboard…</p>
          ) : (
            <div className="row" style={{ alignItems: 'stretch', gap: 14 }}>
              <div className="card" style={{ flex: '1 1 320px' }}>
                <div className="cardBody">
                  <div className="h2">Create a family</div>
                  <p className="help" style={{ marginTop: 6 }}>You’ll be the owner and can invite others.</p>

                  <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
                    <label style={{ display: 'grid', gap: 6 }}>
                      <span className="help">Family name</span>
                      <input
                        className={errs.familyName ? 'input inputInvalid' : 'input'}
                        value={familyName}
                        onChange={(e) => {
                          setFamilyName(e.target.value)
                          setErrs((p) => ({ ...p, familyName: undefined }))
                        }}
                        placeholder="My Family"
                      />
                    </label>

                    <button className="btn btnPrimary" disabled={busyCreate} onClick={() => void createFamily()}>
                      {busyCreate ? 'Creating…' : 'Create family'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="card" style={{ flex: '1 1 320px' }}>
                <div className="cardBody">
                  <div className="h2">Join with an invite</div>
                  <p className="help" style={{ marginTop: 6 }}>Paste the link your family owner shared.</p>

                  <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
                    <label style={{ display: 'grid', gap: 6 }}>
                      <span className="help">Invite link or token</span>
                      <input
                        className={errs.invite ? 'input inputInvalid' : 'input'}
                        value={inviteInput}
                        onChange={(e) => {
                          setInviteInput(e.target.value)
                          setErrs((p) => ({ ...p, invite: undefined }))
                        }}
                        placeholder="https://…/invite/abcd… or abcd…"
                      />
                    </label>

                    <button className="btn" disabled={busyJoin} onClick={() => void joinWithInvite()}>
                      {busyJoin ? 'Opening…' : 'Open invite'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {membership && !family ? (
            <p className="help" style={{ marginTop: 10 }}>
              (Found membership but couldn’t load family. This usually means an RLS/policy issue.)
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ToastProvider'
import { useCurrentFamily } from '@/lib/familyContext'
import { supabase } from '@/lib/supabaseClient'

export default function SettingsPage() {
  const router = useRouter()
  const toast = useToast()
  const { loading, userId, familyId, family, profile, members, refresh } = useCurrentFamily()

  const [savingProfile, setSavingProfile] = useState(false)
  const [savingFamily, setSavingFamily] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const [displayName, setDisplayName] = useState('')
  const [defaultCurrency, setDefaultCurrency] = useState('USD')
  const [timezone, setTimezone] = useState('UTC')

  const [familyName, setFamilyName] = useState('')
  const [baseCurrency, setBaseCurrency] = useState('USD')

  const currencyChoices = useMemo(
    () => ['USD', 'INR', 'EUR', 'GBP', 'CAD', 'AUD', 'SGD', 'JPY'],
    []
  )

  const isOwner = useMemo(() => {
    if (!userId) return false
    return members.some((m) => m.user_id === userId && m.role === 'owner')
  }, [members, userId])

  useEffect(() => {
    if (!loading && !familyId) router.replace('/app')
  }, [loading, familyId, router])

  useEffect(() => {
    setDisplayName(profile?.display_name ?? '')
    setDefaultCurrency((profile?.default_currency ?? 'USD').toUpperCase())
    setTimezone(profile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC')
  }, [profile])

  useEffect(() => {
    setFamilyName(family?.name ?? '')
    setBaseCurrency((family?.base_currency ?? 'USD').toUpperCase())
  }, [family])

  async function saveProfile() {
    if (!userId) return
    setSavingProfile(true)
    try {
      // Members can edit their display name + default currency.
      // Timezone is owner-only for now.
      const patch: Record<string, unknown> = {
        display_name: displayName.trim() ? displayName.trim() : null,
        default_currency: defaultCurrency.toUpperCase(),
      }
      if (isOwner) {
        patch.timezone = timezone.trim() || 'UTC'
      }

      const { error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('user_id', userId)

      if (error) throw error
      toast.success('Profile updated')
      await refresh()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      toast.error(msg, 'Save failed')
    } finally {
      setSavingProfile(false)
    }
  }

  async function saveFamily() {
    if (!familyId) return
    if (!isOwner) {
      toast.error('Only the family owner can change family settings')
      return
    }

    setSavingFamily(true)
    try {
      const { error } = await supabase
        .from('families')
        .update({
          name: familyName.trim() ? familyName.trim() : 'My Family',
          base_currency: baseCurrency.toUpperCase(),
        })
        .eq('id', familyId)

      if (error) throw error
      toast.success('Family updated')
      await refresh()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      toast.error(msg, 'Save failed')
    } finally {
      setSavingFamily(false)
    }
  }

  async function removeMember(memberUserId: string) {
    if (!familyId) return
    if (!isOwner) return
    if (memberUserId === userId) {
      toast.error('You cannot remove yourself')
      return
    }

    const target = members.find((m) => m.user_id === memberUserId)
    if (!target) return
    if (target.role === 'owner') {
      toast.error('Cannot remove the owner')
      return
    }

    if (!confirm(`Remove ${target.display_name ?? 'member'} from the family?`)) return

    setRemovingId(memberUserId)
    try {
      const { error } = await supabase
        .from('family_members')
        .delete()
        .eq('family_id', familyId)
        .eq('user_id', memberUserId)

      if (error) throw error
      toast.success('Member removed')
      await refresh()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      toast.error(msg, 'Remove failed')
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <div className="container">
      <div className="header">
        <div>
          <div className="brandTitle">Settings</div>
          <div className="help">Update your profile and family settings.</div>
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" onClick={() => router.push('/app/account')}>Back</button>
        </div>
      </div>

      <div className="row" style={{ alignItems: 'stretch', marginTop: 14 }}>
        <div className="card" style={{ flex: '1 1 360px' }}>
          <div className="cardBody" style={{ padding: 22 }}>
            <div className="h2">Profile</div>
            <p className="help" style={{ marginTop: 6 }}>
              {isOwner
                ? 'These settings affect your default currency and how your name appears in expenses.'
                : 'You can update your display name and default currency. Other settings are managed by the family owner.'}
            </p>

            <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="help">Display name</span>
                <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g., Manash" />
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span className="help">Default currency</span>
                <select
                  className="input"
                  value={defaultCurrency}
                  onChange={(e) => setDefaultCurrency(e.target.value)}
                >
                  {currencyChoices.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span className="help">Timezone</span>
                <input
                  className="input"
                  value={timezone}
                  disabled={!isOwner}
                  onChange={(e) => setTimezone(e.target.value)}
                  placeholder="America/Chicago"
                />
                <span className="help">Used for date context; you can paste something like America/Chicago.</span>
              </label>

              <div className="row" style={{ marginTop: 4 }}>
                <button className="btn btnPrimary" disabled={savingProfile} onClick={() => void saveProfile()}>
                  {savingProfile ? 'Saving…' : isOwner ? 'Save profile' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ flex: '1 1 360px' }}>
          <div className="cardBody" style={{ padding: 22 }}>
            <div className="h2">Family</div>
            <p className="help" style={{ marginTop: 6 }}>
              {isOwner ? 'Only you (owner) can change these.' : 'View only. Only the family owner can change these.'}
            </p>

            <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="help">Family name</span>
                <input
                  className="input"
                  value={familyName}
                  disabled={!isOwner}
                  onChange={(e) => setFamilyName(e.target.value)}
                  placeholder="My Family"
                />
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span className="help">Base currency</span>
                <select
                  className="input"
                  value={baseCurrency}
                  disabled={!isOwner}
                  onChange={(e) => setBaseCurrency(e.target.value)}
                >
                  {currencyChoices.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <span className="help">Dashboard totals are shown in base currency.</span>
              </label>

              <div className="row" style={{ marginTop: 4 }}>
                <button className="btn btnPrimary" disabled={savingFamily || !isOwner} onClick={() => void saveFamily()}>
                  {savingFamily ? 'Saving…' : 'Save family'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="cardBody" style={{ padding: 18 }}>
          <div className="help" style={{ fontWeight: 800 }}>Family members</div>
          <div className="help" style={{ marginTop: 6 }}>
            {isOwner ? 'As owner, you can remove members.' : 'Only the owner can remove members.'}
          </div>

          <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
            {members.map((m) => (
              <div key={m.user_id} className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.display_name ?? m.user_id}
                    {m.user_id === userId ? ' (you)' : ''}
                  </div>
                  <div className="help">Role: {m.role}</div>
                </div>

                {isOwner && m.role !== 'owner' ? (
                  <button
                    className="btn"
                    disabled={removingId === m.user_id}
                    onClick={() => void removeMember(m.user_id)}
                  >
                    {removingId === m.user_id ? 'Removing…' : 'Remove'}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="cardBody" style={{ padding: 18 }}>
          <div className="help" style={{ fontWeight: 800 }}>Note</div>
          <div className="help" style={{ marginTop: 6 }}>
            Changing base currency will not retroactively rewrite historical FX rates; existing expenses keep their stored base amounts.
          </div>
        </div>
      </div>
    </div>
  )
}

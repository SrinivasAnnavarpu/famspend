'use client'

import { useRouter } from 'next/navigation'
import { useCurrentFamily } from '@/lib/familyContext'
import { useToast } from '@/components/ToastProvider'
import { supabase } from '@/lib/supabaseClient'

export default function AccountPage() {
  const router = useRouter()
  const toast = useToast()
  const { profile, family } = useCurrentFamily()

  async function signOut() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <div className="container">
      <div className="card">
        <div className="cardBody" style={{ padding: 22 }}>
          <div className="badge">Account</div>
          <h1 className="h1" style={{ fontSize: 30, marginTop: 12 }}>Your account</h1>
          <p className="p">Manage profile, invites, and sign out.</p>

          <div className="row" style={{ marginTop: 16 }}>
            <div className="card" style={{ flex: '1 1 320px' }}>
              <div className="cardBody">
                <div className="h2">Profile</div>
                <p className="p" style={{ marginTop: 6 }}>
                  Name: <b>{profile?.display_name ?? '—'}</b>
                </p>
                <p className="p" style={{ marginTop: 6 }}>
                  Default currency: <b>{profile?.default_currency ?? '—'}</b>
                </p>
                <p className="p" style={{ marginTop: 6 }}>
                  Timezone: <b>{profile?.timezone ?? '—'}</b>
                </p>
              </div>
            </div>

            <div className="card" style={{ flex: '1 1 320px' }}>
              <div className="cardBody">
                <div className="h2">Family</div>
                <p className="p" style={{ marginTop: 6 }}>
                  {family ? (
                    <>
                      <b>{family.name}</b> (base: {family.base_currency})
                    </>
                  ) : (
                    '—'
                  )}
                </p>
                <div className="row" style={{ marginTop: 10 }}>
                  <button className="btn" onClick={() => router.push('/app/account/invite')}>
                    Invite
                  </button>
                  <button className="btn" onClick={() => router.push('/app/account/settings')}>
                    Settings
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn" onClick={() => void signOut()}>Sign out</button>
          </div>
        </div>
      </div>
    </div>
  )
}

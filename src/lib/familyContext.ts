'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export type Family = { id: string; name: string; base_currency: string }
export type Profile = { user_id: string; display_name: string | null; default_currency: string; timezone: string }
export type Member = { user_id: string; role: string; display_name: string | null }

export function useCurrentFamily() {
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [familyId, setFamilyId] = useState<string | null>(null)
  const [family, setFamily] = useState<Family | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await supabase.auth.getSession()
      const session = data.session
      if (!session) {
        setUserId(null)
        setFamilyId(null)
        setFamily(null)
        setProfile(null)
        setMembers([])
        return
      }

      const uid = session.user.id
      setUserId(uid)

      // Ensure a profile row exists (used for display names across family members)
      // We only create it if missing to avoid overwriting user changes.
      try {
        const { data: existingProf, error: exErr } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('user_id', uid)
          .maybeSingle()
        if (!exErr && !existingProf) {
          const meta = (session.user.user_metadata ?? {}) as Record<string, unknown>
          const rawName =
            (typeof meta.full_name === 'string' && meta.full_name) ||
            (typeof meta.name === 'string' && meta.name) ||
            (typeof session.user.email === 'string' && session.user.email.split('@')[0]) ||
            null

          await supabase.from('profiles').insert({
            user_id: uid,
            display_name: rawName,
            default_currency: 'USD',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
          })
        }
      } catch {
        // Non-fatal (RLS/migration may not be ready yet)
      }

      const { data: memberships, error: mErr } = await supabase
        .from('family_members')
        .select('family_id')
        .eq('user_id', uid)
        .limit(1)

      if (mErr) throw mErr

      const fid = memberships?.[0]?.family_id ?? null
      setFamilyId(fid)

      if (!fid) {
        setFamily(null)
        setMembers([])
      } else {
        const { data: fam, error: fErr } = await supabase
          .from('families')
          .select('id, name, base_currency')
          .eq('id', fid)
          .maybeSingle()
        if (fErr) throw fErr
        setFamily(fam ?? null)

        const { data: mems, error: memErr } = await supabase
          .from('family_members')
          .select('user_id, role')
          .eq('family_id', fid)
        if (memErr) throw memErr

        const userIds = (mems ?? []).map((m) => m.user_id)
        let profMap = new Map<string, { display_name: string | null }>()
        if (userIds.length > 0) {
          const { data: profs, error: pErr } = await supabase
            .from('profiles')
            .select('user_id, display_name')
            .in('user_id', userIds)
          if (pErr) throw pErr
          profMap = new Map((profs ?? []).map((p) => [p.user_id, { display_name: p.display_name }]))
        }

        setMembers(
          (mems ?? []).map((m) => ({
            user_id: m.user_id,
            role: m.role,
            display_name: profMap.get(m.user_id)?.display_name ?? null,
          }))
        )
      }

      const { data: prof, error: pErr } = await supabase
        .from('profiles')
        .select('user_id, display_name, default_currency, timezone')
        .eq('user_id', uid)
        .maybeSingle()

      if (pErr) throw pErr
      setProfile(prof ?? null)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void refresh()
    })
    return () => sub.subscription.unsubscribe()
  }, [refresh])

  return useMemo(
    () => ({ loading, error, userId, familyId, family, profile, members, refresh }),
    [loading, error, userId, familyId, family, profile, members, refresh]
  )
}

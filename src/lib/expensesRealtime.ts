'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

export function useExpensesRealtime(params: {
  familyId: string | null
  onChange: () => void
}) {
  const { familyId, onChange } = params

  useEffect(() => {
    if (!familyId) return

    const channel = supabase
      .channel(`expenses:${familyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'expenses',
          filter: `family_id=eq.${familyId}`,
        },
        () => onChange()
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [familyId, onChange])
}

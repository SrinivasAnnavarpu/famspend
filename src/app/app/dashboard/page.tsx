'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ToastProvider'

type Family = { id: string; name: string; base_currency: string }

type ExpenseRow = { amount_base_minor: number }

export default function DashboardPage() {
  const router = useRouter()
  const toast = useToast()

  const [family, setFamily] = useState<Family | null>(null)
  const [monthTotalMinor, setMonthTotalMinor] = useState<number>(0)

  const monthRange = useMemo(() => {
    const d = new Date()
    const start = new Date(d.getFullYear(), d.getMonth(), 1)
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    const toYmd = (x: Date) => {
      const yyyy = x.getFullYear()
      const mm = String(x.getMonth() + 1).padStart(2, '0')
      const dd = String(x.getDate()).padStart(2, '0')
      return `${yyyy}-${mm}-${dd}`
    }
    return { start: toYmd(start), end: toYmd(end) }
  }, [])

  useEffect(() => {
    async function load() {
      const { data } = await supabase.auth.getSession()
      const session = data.session
      if (!session) {
        router.replace('/login')
        return
      }

      const { data: memberships, error: mErr } = await supabase
        .from('family_members')
        .select('family_id')
        .eq('user_id', session.user.id)
        .limit(1)

      if (mErr) {
        toast.error(mErr.message)
        return
      }

      const familyId = memberships?.[0]?.family_id
      if (!familyId) {
        router.replace('/app')
        return
      }

      const { data: fam, error: fErr } = await supabase
        .from('families')
        .select('id, name, base_currency')
        .eq('id', familyId)
        .maybeSingle()

      if (fErr || !fam) {
        toast.error(fErr?.message ?? 'Family not found')
        return
      }
      setFamily(fam)

      const { data: rows, error: eErr } = await supabase
        .from('expenses')
        .select('amount_base_minor')
        .eq('family_id', familyId)
        .gte('expense_date', monthRange.start)
        .lte('expense_date', monthRange.end)

      if (eErr) {
        toast.error(eErr.message)
        return
      }

      const total = (rows as ExpenseRow[] | null)?.reduce((acc, r) => acc + Number(r.amount_base_minor ?? 0), 0) ?? 0
      setMonthTotalMinor(total)
    }

    void load()
  }, [router, toast, monthRange.start, monthRange.end])

  const pretty = useMemo(() => {
    const n = monthTotalMinor / 100
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }, [monthTotalMinor])

  return (
    <div className="container">
      <div className="header">
        <div className="brand">
          <div className="logo" aria-hidden />
          <div>
            <div className="brandTitle">Dashboard</div>
            <div className="help">{family ? family.name : 'Loading…'}</div>
          </div>
        </div>
        <div className="row">
          <button className="btn btnPrimary" onClick={() => router.push('/app/add')}>Add expense</button>
        </div>
      </div>

      <div className="card">
        <div className="cardBody" style={{ padding: 22 }}>
          <div className="badge">This month</div>
          <h1 className="h1" style={{ marginTop: 12 }}>
            {pretty} {family?.base_currency ?? ''}
          </h1>
          <p className="p">MVP dashboard — next we’ll add category breakdown + export.</p>
        </div>
      </div>
    </div>
  )
}

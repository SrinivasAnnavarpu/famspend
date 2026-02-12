'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ToastProvider'
import { useCurrentFamily } from '@/lib/familyContext'
import { useExpensesRealtime } from '@/lib/expensesRealtime'
import { supabase } from '@/lib/supabaseClient'
import { downloadText, toCsv } from '@/lib/csv'
// (nav handled by AppShell)

type ExpenseRow = {
  id: string
  created_by: string
  expense_date: string
  amount_base_minor: number
  currency_base: string
  notes: string | null
  categories: { name: string } | null
}

type DbExpenseRow = Omit<ExpenseRow, 'categories'> & {
  // Supabase sometimes returns related rows as an array depending on relationship inference
  categories: { name: string } | { name: string }[] | null
}

function normalizeCategory(x: DbExpenseRow['categories']): { name: string } | null {
  if (!x) return null
  return Array.isArray(x) ? x[0] ?? null : x
}

export default function DashboardPage() {
  const router = useRouter()
  const toast = useToast()
  const { loading, familyId, family, members } = useCurrentFamily()

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

  const [start, setStart] = useState(monthRange.start)
  const [end, setEnd] = useState(monthRange.end)
  const [userFilter, setUserFilter] = useState<string>('all')
  const [monthTotalMinor, setMonthTotalMinor] = useState<number>(0)
  const [byUserMinor, setByUserMinor] = useState<Record<string, number>>({})

  const load = useCallback(async () => {
    if (!familyId) return

    const q = supabase
      .from('expenses')
      .select(
        'id, created_by, expense_date, amount_base_minor, currency_base, notes, categories(name)',
        { count: 'exact' }
      )
      .eq('family_id', familyId)
      .gte('expense_date', start)
      .lte('expense_date', end)

    if (userFilter !== 'all') q.eq('created_by', userFilter)

    const { data: rows, error } = await q

    if (error) {
      toast.error(error.message, 'Dashboard load failed')
      return
    }

    const list = ((rows ?? []) as DbExpenseRow[]).map((r) => ({ ...r, categories: normalizeCategory(r.categories) }))
    const total = list.reduce((acc, r) => acc + Number(r.amount_base_minor ?? 0), 0)
    setMonthTotalMinor(total)

    const agg: Record<string, number> = {}
    for (const r of list) {
      agg[r.created_by] = (agg[r.created_by] ?? 0) + Number(r.amount_base_minor ?? 0)
    }
    setByUserMinor(agg)
  }, [familyId, start, end, userFilter, toast])

  useEffect(() => {
    if (!familyId && !loading) router.replace('/app')
  }, [familyId, loading, router])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  useExpensesRealtime({ familyId, onChange: load })

  const pretty = useMemo(() => {
    const n = monthTotalMinor / 100
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }, [monthTotalMinor])

  async function exportCsv() {
    if (!familyId) return

    const q = supabase
      .from('expenses')
      .select('expense_date, amount_original_minor, currency_original, amount_base_minor, currency_base, fx_rate, fx_date, notes, created_by, categories(name)')
      .eq('family_id', familyId)
      .gte('expense_date', start)
      .lte('expense_date', end)

    if (userFilter !== 'all') q.eq('created_by', userFilter)

    const { data: rows, error } = await q
    if (error) {
      toast.error(error.message, 'Export failed')
      return
    }

    const memberName = (uid: string) => members.find((m) => m.user_id === uid)?.display_name ?? uid

    type ExportRow = {
      expense_date: string
      amount_original_minor: number
      currency_original: string
      amount_base_minor: number
      currency_base: string
      fx_rate: number
      fx_date: string
      notes: string | null
      created_by: string
      categories: { name: string } | null
    }

    const out = ((rows ?? []) as (Omit<ExportRow, 'categories'> & { categories: ExportRow['categories'] | ExportRow['categories'][] })[]).map((r) => {
      const cat = Array.isArray(r.categories) ? (r.categories[0] ?? null) : r.categories
      return {
        date: r.expense_date,
        category: cat?.name ?? '',
      added_by: memberName(r.created_by),
      amount_original: (Number(r.amount_original_minor) / 100).toFixed(2),
      currency_original: r.currency_original,
      fx_rate: r.fx_rate,
      fx_date: r.fx_date,
      amount_base: (Number(r.amount_base_minor) / 100).toFixed(2),
      currency_base: r.currency_base,
        notes: r.notes ?? '',
      }
    })

    const csv = toCsv(out)
    const filename = `famspend-${start}_to_${end}.csv`
    downloadText(filename, csv)
    toast.success('Downloaded CSV')
  }

  return (
    <div className="container">
      <div className="header">
        <div>
          <div className="brandTitle">Dashboard</div>
          <div className="help">{family ? `${family.name} • Base: ${family.base_currency}` : 'Loading…'}</div>
        </div>
        <div className="row" style={{ alignItems: 'center', justifyContent: 'flex-end' }}>
          <button className="btn" onClick={exportCsv}>Export CSV</button>
        </div>
      </div>

      <div className="filtersGrid dashboardFilters">
        <div className="dateRangeRow">
          <div>
            <div className="help">From</div>
            <input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div>
            <div className="help">To</div>
            <input className="input" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
        <div>
          <div className="help">User</div>
          <select className="input" value={userFilter} onChange={(e) => setUserFilter(e.target.value)}>
            <option value="all">All users</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.display_name ?? m.user_id}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="row" style={{ marginTop: 14, alignItems: 'stretch' }}>
        {/* Selected range + Users same height on desktop; wraps on mobile */}
        <div className="card" style={{ flex: '1 1 340px', display: 'flex' }}>
          <div className="cardBody" style={{ padding: 22, flex: '1 1 auto', display: 'flex', flexDirection: 'column' }}>
            <div className="badge">Selected range</div>
            <h1 className="h1" style={{ marginTop: 12, fontSize: 'clamp(32px, 4.2vw, 44px)' }}>
              {pretty} {family?.base_currency ?? ''}
            </h1>
            <p className="p" style={{ marginTop: 'auto' }}>Realtime enabled for this family.</p>
          </div>
        </div>

        <div className="card" style={{ flex: '1 1 340px', display: 'flex' }}>
          <div className="cardBody" style={{ flex: '1 1 auto' }}>
            <div className="h2">Users</div>
            <p className="p" style={{ marginTop: 6 }}>Totals in {family?.base_currency ?? 'base currency'} for selected range.</p>
            <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
              {members.map((m) => {
                const v = (byUserMinor[m.user_id] ?? 0) / 100
                return (
                  <div key={m.user_id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ fontWeight: 750 }}>{m.display_name ?? m.user_id}</div>
                    <div style={{ fontVariantNumeric: 'tabular-nums' }}>{v.toFixed(2)}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="cardBody">
          <div className="h2">Next</div>
          <p className="p" style={{ marginTop: 6 }}>
            We’ll add category breakdown and a full expenses table (edit/delete + filter) next.
          </p>
        </div>
      </div>
    </div>
  )
}

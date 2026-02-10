'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ToastProvider'
import { useCurrentFamily } from '@/lib/familyContext'
import { useExpensesRealtime } from '@/lib/expensesRealtime'
import { supabase } from '@/lib/supabaseClient'

type Category = { id: string; name: string }

type ExpenseRow = {
  id: string
  created_by: string
  expense_date: string
  amount_original_minor: number
  currency_original: string
  amount_base_minor: number
  currency_base: string
  fx_rate: number
  fx_date: string
  notes: string | null
  categories: { id: string; name: string } | null
}

function fmtMoney(minor: number, currency: string) {
  const n = (Number(minor) || 0) / 100
  return `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
}

export default function ExpensesPage() {
  const router = useRouter()
  const toast = useToast()
  const { loading, familyId, family, members } = useCurrentFamily()

  const [categories, setCategories] = useState<Category[]>([])
  const [rows, setRows] = useState<ExpenseRow[]>([])
  const [busy, setBusy] = useState(false)

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
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  const memberName = useCallback(
    (uid: string) => members.find((m) => m.user_id === uid)?.display_name ?? uid.slice(0, 8),
    [members]
  )

  const load = useCallback(async () => {
    if (!familyId) return
    setBusy(true)
    try {
      const { data: cats, error: cErr } = await supabase
        .from('categories')
        .select('id, name')
        .eq('family_id', familyId)
        .eq('active', true)
        .order('sort_order', { ascending: true })

      if (cErr) throw cErr
      setCategories((cats ?? []) as Category[])

      const q = supabase
        .from('expenses')
        .select(
          'id, created_by, expense_date, amount_original_minor, currency_original, amount_base_minor, currency_base, fx_rate, fx_date, notes, categories(id, name)'
        )
        .eq('family_id', familyId)
        .gte('expense_date', start)
        .lte('expense_date', end)
        .order('expense_date', { ascending: false })
        .limit(200)

      if (userFilter !== 'all') q.eq('created_by', userFilter)
      if (categoryFilter !== 'all') q.eq('category_id', categoryFilter)

      const { data: ex, error: eErr } = await q
      if (eErr) throw eErr
      setRows((ex ?? []) as ExpenseRow[])
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      toast.error(msg, 'Failed to load expenses')
    } finally {
      setBusy(false)
    }
  }, [familyId, start, end, userFilter, categoryFilter, toast])

  useEffect(() => {
    if (!familyId && !loading) router.replace('/app')
  }, [familyId, loading, router])

  useEffect(() => {
    void load()
  }, [load])

  useExpensesRealtime({ familyId, onChange: load })

  const totalBaseMinor = useMemo(
    () => rows.reduce((acc, r) => acc + Number(r.amount_base_minor ?? 0), 0),
    [rows]
  )

  return (
    <div className="container">
      <div className="header">
        <div className="brand">
          <div className="logo" aria-hidden />
          <div>
            <div className="brandTitle">Expenses</div>
            <div className="help">
              {family ? `${family.name} • Base: ${family.base_currency}` : 'Loading…'}
            </div>
          </div>
        </div>
        <div className="row">
          <button className="btn btnPrimary" onClick={() => router.push('/app/add')}>Add expense</button>
          <button className="btn" onClick={() => router.push('/app/dashboard')}>Dashboard</button>
        </div>
      </div>

      <div className="row" style={{ alignItems: 'flex-end' }}>
        <div style={{ minWidth: 200 }}>
          <div className="help">From</div>
          <input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div style={{ minWidth: 200 }}>
          <div className="help">To</div>
          <input className="input" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <div style={{ minWidth: 220 }}>
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
        <div style={{ minWidth: 220 }}>
          <div className="help">Category</div>
          <select className="input" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="badge" style={{ marginLeft: 'auto' }}>
          Total: {fmtMoney(totalBaseMinor, family?.base_currency ?? 'USD')}
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="cardBody" style={{ padding: 0 }}>
          <div className="tableWrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Added by</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th style={{ textAlign: 'right' }}>Base</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 18, color: '#64748b' }}>
                      {busy ? 'Loading…' : 'No expenses for this range.'}
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{r.expense_date}</td>
                      <td>{r.categories?.name ?? '—'}</td>
                      <td>{memberName(r.created_by)}</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {fmtMoney(r.amount_original_minor, r.currency_original)}
                      </td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {fmtMoney(r.amount_base_minor, r.currency_base)}
                      </td>
                      <td style={{ maxWidth: 340, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.notes ?? ''}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <p className="help" style={{ marginTop: 10 }}>
        Realtime is enabled — this table updates when a family member adds expenses.
      </p>
    </div>
  )
}

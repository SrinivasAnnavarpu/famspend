'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ToastProvider'
import { useCurrentFamily } from '@/lib/familyContext'
import { useExpensesRealtime } from '@/lib/expensesRealtime'
import { getFxRate } from '@/lib/fx'
import { toMinorUnits } from '@/lib/money'
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

type EditState = {
  id: string
  category_id: string | null
  expense_date: string
  amount: string
  currency_original: string
  notes: string
}

function fmtMoney(minor: number, currency: string) {
  const n = (Number(minor) || 0) / 100
  return `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
}

function toMajor(minor: number) {
  return ((Number(minor) || 0) / 100).toFixed(2)
}

export default function ExpensesPage() {
  const router = useRouter()
  const toast = useToast()
  const { loading, familyId, family, members, profile } = useCurrentFamily()

  const [categories, setCategories] = useState<Category[]>([])
  const [rows, setRows] = useState<ExpenseRow[]>([])
  const [busy, setBusy] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const pageSize = 50
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  const [edit, setEdit] = useState<EditState | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const currencyChoices = useMemo(
    () => ['USD', 'INR', 'EUR', 'GBP', 'CAD', 'AUD', 'SGD', 'JPY'],
    []
  )

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

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
    }, 350)
    return () => window.clearTimeout(t)
  }, [search])

  const fetchPage = useCallback(
    async (offset: number) => {
      if (!familyId) return [] as ExpenseRow[]

      const q = supabase
        .from('expenses')
        .select(
          'id, created_by, expense_date, amount_original_minor, currency_original, amount_base_minor, currency_base, fx_rate, fx_date, notes, categories(id, name)'
        )
        .eq('family_id', familyId)
        .gte('expense_date', start)
        .lte('expense_date', end)
        .order('expense_date', { ascending: false })
        .range(offset, offset + pageSize - 1)

      if (userFilter !== 'all') q.eq('created_by', userFilter)
      if (categoryFilter !== 'all') q.eq('category_id', categoryFilter)

      const s = debouncedSearch
      if (s) {
        const cleaned = s.replaceAll('%', '').replaceAll(',', '').replaceAll('(', '').replaceAll(')', '')
        const pattern = `%${cleaned}%`
        q.or(`notes.ilike.${pattern},categories.name.ilike.${pattern}`)
      }

      const { data: ex, error: eErr } = await q
      if (eErr) throw eErr
      return (ex ?? []) as ExpenseRow[]
    },
    [familyId, start, end, userFilter, categoryFilter, debouncedSearch]
  )

  const load = useCallback(async () => {
    if (!familyId) return
    setBusy(true)
    setHasMore(true)
    try {
      const { data: cats, error: cErr } = await supabase
        .from('categories')
        .select('id, name')
        .eq('family_id', familyId)
        .eq('active', true)
        .order('sort_order', { ascending: true })

      if (cErr) throw cErr
      setCategories((cats ?? []) as Category[])

      const first = await fetchPage(0)
      setRows(first)
      setHasMore(first.length === pageSize)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      toast.error(msg, 'Failed to load expenses')
    } finally {
      setBusy(false)
    }
  }, [familyId, fetchPage, toast])

  const loadMore = useCallback(async () => {
    if (!familyId) return
    if (busy || loadingMore || !hasMore) return

    setLoadingMore(true)
    try {
      const next = await fetchPage(rows.length)
      setRows((prev) => [...prev, ...next])
      setHasMore(next.length === pageSize)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      toast.error(msg, 'Failed to load more')
    } finally {
      setLoadingMore(false)
    }
  }, [familyId, busy, loadingMore, hasMore, fetchPage, rows.length, toast])

  useEffect(() => {
    if (!familyId && !loading) router.replace('/app')
  }, [familyId, loading, router])

  useEffect(() => {
    void load()
  }, [load])

  useExpensesRealtime({
    familyId,
    onChange: () => {
      // reset list on realtime change (simple + consistent)
      void load()
    },
  })

  useEffect(() => {
    if (!loadMoreRef.current) return
    if (!hasMore) return

    const el = loadMoreRef.current
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          void loadMore()
        }
      },
      { root: null, rootMargin: '200px', threshold: 0 }
    )

    obs.observe(el)
    return () => obs.disconnect()
  }, [loadMore, hasMore])

  const totalBaseMinor = useMemo(
    () => rows.reduce((acc, r) => acc + Number(r.amount_base_minor ?? 0), 0),
    [rows]
  )

  const openEdit = useCallback(
    (r: ExpenseRow) => {
      setEdit({
        id: r.id,
        category_id: r.categories?.id ?? null,
        expense_date: r.expense_date,
        amount: toMajor(r.amount_original_minor),
        currency_original: r.currency_original,
        notes: r.notes ?? '',
      })
    },
    []
  )

  const closeEdit = useCallback(() => setEdit(null), [])

  const saveEdit = useCallback(async () => {
    if (!familyId || !family) return
    if (!edit) return

    setSaving(true)
    try {
      const originalMinor = toMinorUnits(edit.amount)
      const baseCurrency = family.base_currency
      const fromCurrency = edit.currency_original
      const date = edit.expense_date

      const fxRate = await getFxRate({ from: fromCurrency, to: baseCurrency, date })
      const baseMinor = Math.round(originalMinor * fxRate)

      const { error } = await supabase
        .from('expenses')
        .update({
          category_id: edit.category_id,
          expense_date: edit.expense_date,
          amount_original_minor: originalMinor,
          currency_original: fromCurrency,
          fx_rate: fxRate,
          fx_date: date,
          amount_base_minor: baseMinor,
          currency_base: baseCurrency,
          notes: edit.notes.trim() ? edit.notes.trim() : null,
        })
        .eq('id', edit.id)
        .eq('family_id', familyId)

      if (error) throw error

      toast.success('Expense updated')
      closeEdit()
      await load()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      toast.error(msg, 'Update failed')
    } finally {
      setSaving(false)
    }
  }, [familyId, family, edit, toast, closeEdit, load])

  const deleteExpense = useCallback(
    async (id: string) => {
      if (!familyId) return
      if (!confirm('Delete this expense?')) return

      setDeletingId(id)
      try {
        const { error } = await supabase.from('expenses').delete().eq('id', id).eq('family_id', familyId)
        if (error) throw error
        toast.success('Deleted')
        await load()
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        toast.error(msg, 'Delete failed')
      } finally {
        setDeletingId(null)
      }
    },
    [familyId, toast, load]
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
        <div style={{ minWidth: 260, flex: '1 1 260px' }}>
          <div className="help">Search</div>
          <input
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes, category, user…"
          />
        </div>
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
          {busy ? <div className="tableBusyBar" /> : null}
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
                  <th style={{ width: 140 }} />
                </tr>
              </thead>
              <tbody>
                {busy && rows.length === 0 ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={`sk-${i}`}>
                      <td><div className="skeleton" style={{ width: 92 }} /></td>
                      <td><div className="skeleton" style={{ width: 120 }} /></td>
                      <td><div className="skeleton" style={{ width: 110 }} /></td>
                      <td style={{ textAlign: 'right' }}><div className="skeleton" style={{ width: 130, marginLeft: 'auto' }} /></td>
                      <td style={{ textAlign: 'right' }}><div className="skeleton" style={{ width: 130, marginLeft: 'auto' }} /></td>
                      <td><div className="skeleton" style={{ width: 220 }} /></td>
                      <td><div className="skeleton" style={{ width: 90, marginLeft: 'auto' }} /></td>
                    </tr>
                  ))
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 18, color: '#64748b' }}>
                      No expenses for this range.
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
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button className="btn" style={{ padding: '6px 10px', borderRadius: 10 }} onClick={() => openEdit(r)}>
                          Edit
                        </button>
                        <button
                          className="btn"
                          style={{ padding: '6px 10px', borderRadius: 10, marginLeft: 8 }}
                          disabled={deletingId === r.id}
                          onClick={() => void deleteExpense(r.id)}
                        >
                          {deletingId === r.id ? '…' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div ref={loadMoreRef} style={{ height: 1 }} />

      <p className="help" style={{ marginTop: 10 }}>
        {loadingMore ? 'Loading more…' : hasMore ? 'Scroll to load more.' : 'End of list.'} Realtime is enabled.
      </p>

      {edit ? (
        <div className="modalBackdrop" role="dialog" aria-modal="true" onClick={closeEdit}>
          <div className="card modal" onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div>
                <div style={{ fontWeight: 850, letterSpacing: -0.2 }}>Edit expense</div>
                <div className="help">Changes will recalculate FX for the expense date.</div>
              </div>
              <button className="btn btnGhost" onClick={closeEdit}>
                Close
              </button>
            </div>
            <div className="modalBody">
              <div className="row" style={{ alignItems: 'flex-end' }}>
                <div style={{ flex: '1 1 220px' }}>
                  <div className="help">Category</div>
                  <select
                    className="input"
                    value={edit.category_id ?? ''}
                    onChange={(e) => setEdit((p) => (p ? { ...p, category_id: e.target.value || null } : p))}
                  >
                    <option value="">—</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: '1 1 160px' }}>
                  <div className="help">Date</div>
                  <input
                    className="input"
                    type="date"
                    value={edit.expense_date}
                    onChange={(e) => setEdit((p) => (p ? { ...p, expense_date: e.target.value } : p))}
                  />
                </div>
              </div>

              <div className="row" style={{ marginTop: 12, alignItems: 'flex-end' }}>
                <div style={{ flex: '1 1 220px' }}>
                  <div className="help">Amount</div>
                  <input
                    className="input"
                    inputMode="decimal"
                    value={edit.amount}
                    onChange={(e) => setEdit((p) => (p ? { ...p, amount: e.target.value } : p))}
                  />
                </div>
                <div style={{ flex: '1 1 220px' }}>
                  <div className="help">Currency</div>
                  <input
                    className="input"
                    list="currency-list"
                    value={edit.currency_original}
                    onChange={(e) => setEdit((p) => (p ? { ...p, currency_original: e.target.value.toUpperCase() } : p))}
                    placeholder={profile?.default_currency ?? 'USD'}
                  />
                  <datalist id="currency-list">
                    {currencyChoices.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                  <div className="help" style={{ marginTop: 6 }}>
                    Tip: you can type any 3-letter currency code.
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div className="help">Notes</div>
                <input
                  className="input"
                  value={edit.notes}
                  onChange={(e) => setEdit((p) => (p ? { ...p, notes: e.target.value } : p))}
                  placeholder="Optional"
                />
              </div>

              <div className="row" style={{ marginTop: 14 }}>
                <button className="btn btnPrimary" disabled={saving} onClick={() => void saveEdit()}>
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
                <button className="btn" onClick={closeEdit}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

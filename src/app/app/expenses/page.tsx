'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ToastProvider'
import { useCurrentFamily } from '@/lib/familyContext'
import { useExpensesRealtime } from '@/lib/expensesRealtime'
import { getFxRate } from '@/lib/fx'
import { toMinorUnits } from '@/lib/money'
import { supabase } from '@/lib/supabaseClient'
import { clampLen, isYmd, parsePositiveAmount } from '@/lib/validate'
// (nav handled by AppShell)

function errMsg(e: unknown) {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object' && 'message' in e) {
    return String((e as { message: unknown }).message)
  }
  return String(e)
}

type Category = { id: string; name: string; icon: string | null; color: string | null }

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
  // Supabase sometimes returns related rows as an array depending on relationship inference
  categories: { id: string; name: string; icon?: string | null; color?: string | null } | { id: string; name: string; icon?: string | null; color?: string | null }[] | null
}

function normalizeCategory(x: ExpenseRow['categories']): { id: string; name: string; icon?: string | null; color?: string | null } | null {
  if (!x) return null
  return Array.isArray(x) ? x[0] ?? null : x
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
  const { loading, familyId, family, members, profile, userId } = useCurrentFamily()

  const [categories, setCategories] = useState<Category[]>([])
  const [rows, setRows] = useState<ExpenseRow[]>([])
  const [busy, setBusy] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const pageSize = 20
  const scrollRootRef = useRef<HTMLDivElement | null>(null)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  const [edit, setEdit] = useState<EditState | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isMobile, setIsMobile] = useState(false)

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

  const isOwner = useMemo(() => {
    if (!userId) return false
    return members.some((m) => m.user_id === userId && m.role === 'owner')
  }, [members, userId])

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
          'id, created_by, expense_date, amount_original_minor, currency_original, amount_base_minor, currency_base, fx_rate, fx_date, notes, categories(id, name, icon, color)'
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

        const { data: cats, error: cErr } = await supabase
          .from('categories')
          .select('id')
          .eq('family_id', familyId)
          .ilike('name', pattern)
          .limit(50)

        if (cErr) throw cErr

        const ids = (cats ?? []).map((c: { id: string }) => c.id)
        if (ids.length > 0) {
          q.or(`notes.ilike.${pattern},category_id.in.(${ids.join(',')})`)
        } else {
          q.ilike('notes', pattern)
        }
      }

      const { data: ex, error: eErr } = await q
      if (eErr) throw eErr
      const list = ((ex ?? []) as unknown as ExpenseRow[]).map((r) => ({ ...r, categories: normalizeCategory(r.categories) }))
      return list
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
        .select('id, name, icon, color')
        .eq('family_id', familyId)
        .eq('active', true)
        .order('sort_order', { ascending: true })

      if (cErr) throw cErr
      setCategories((cats ?? []) as Category[])

      const first = await fetchPage(0)
      setRows(first)
      setSelectedIds(new Set())
      setHasMore(first.length === pageSize)
    } catch (e: unknown) {
      const msg = errMsg(e)
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
      const msg = errMsg(e)
      toast.error(msg, 'Failed to load more')
      setHasMore(false)
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

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 520px)')
    const sync = () => setIsMobile(mq.matches)
    sync()
    mq.addEventListener?.('change', sync)
    return () => mq.removeEventListener?.('change', sync)
  }, [])

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
    const root = scrollRootRef.current ?? null

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          void loadMore()
        }
      },
      { root, rootMargin: '200px', threshold: 0 }
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
        category_id: normalizeCategory(r.categories)?.id ?? null,
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
      const amt = parsePositiveAmount(edit.amount)
      if (!amt.ok) throw new Error(amt.error)
      if (!isYmd(edit.expense_date)) throw new Error('Pick a valid date')
      if (edit.notes.length > 280) throw new Error('Notes are too long (max 280 characters)')

      const originalMinor = toMinorUnits(amt.value)
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
          notes: edit.notes.trim() ? clampLen(edit.notes.trim(), 280) : null,
        })
        .eq('id', edit.id)
        .eq('family_id', familyId)

      if (error) throw error

      toast.success('Expense updated')
      closeEdit()
      await load()
    } catch (e: unknown) {
      const msg = errMsg(e)
      toast.error(msg, 'Update failed')
    } finally {
      setSaving(false)
    }
  }, [familyId, family, edit, toast, closeEdit, load])

  const deleteExpense = useCallback(
    async (id: string) => {
      if (!familyId) return
      if (!isOwner) {
        toast.error('Only the family owner can delete expenses')
        return
      }
      if (!confirm('Delete this expense?')) return

      setDeletingId(id)
      try {
        const { error } = await supabase.from('expenses').delete().eq('id', id).eq('family_id', familyId)
        if (error) throw error
        toast.success('Deleted')
        setSelectedIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
        closeEdit()
        await load()
      } catch (e: unknown) {
        const msg = errMsg(e)
        toast.error(msg, 'Delete failed')
      } finally {
        setDeletingId(null)
      }
    },
    [familyId, toast, load, closeEdit]
  )

  const allLoadedSelected = useMemo(() => {
    if (rows.length === 0) return false
    return rows.every((r) => selectedIds.has(r.id))
  }, [rows, selectedIds])

  const selectedCount = selectedIds.size

  const toggleSelectAllLoaded = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (rows.every((r) => next.has(r.id))) {
        // unselect all loaded
        for (const r of rows) next.delete(r.id)
      } else {
        // select all loaded
        for (const r of rows) next.add(r.id)
      }
      return next
    })
  }, [rows])

  const toggleSelectOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const deleteSelected = useCallback(async () => {
    if (!familyId) return
    if (!isOwner) {
      toast.error('Only the family owner can delete expenses')
      return
    }
    if (selectedIds.size === 0) return
    if (!confirm(`Delete ${selectedIds.size} expense(s)? This cannot be undone.`)) return

    setBulkDeleting(true)
    try {
      const ids = Array.from(selectedIds)
      const { error } = await supabase.from('expenses').delete().in('id', ids).eq('family_id', familyId)
      if (error) throw error

      toast.success(`Deleted ${ids.length} expense(s)`) 
      setSelectedIds(new Set())
      await load()
    } catch (e: unknown) {
      const msg = errMsg(e)
      toast.error(msg, 'Bulk delete failed')
    } finally {
      setBulkDeleting(false)
    }
  }, [familyId, selectedIds, toast, load, isOwner])

  return (
    <div className="container">
      <div className="header">
        <div>
          <div className="brandTitle">Expenses</div>
          <div className="help">
            {family ? `${family.name} • Base: ${family.base_currency}` : 'Loading…'}
          </div>
        </div>
        {/* nav handled by AppShell */}
      </div>

      <div className="filtersGrid">
        <div>
          <div className="help">Search</div>
          <input
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes, category…"
          />
        </div>
        <div>
          <div className="help">From</div>
          <input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <div className="help">To</div>
          <input className="input" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
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
        <div>
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
      </div>

      <div className="row" style={{ marginTop: 10, justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="row" style={{ alignItems: 'center' }}>
          <div className="badge">Total: {fmtMoney(totalBaseMinor, family?.base_currency ?? 'USD')}</div>
          {selectedCount > 0 && !isMobile && isOwner ? (
            <div className="badge" style={{ marginLeft: 10 }}>
              Selected: {selectedCount}
            </div>
          ) : null}
        </div>

        <div className="row" style={{ alignItems: 'center', justifyContent: 'flex-end' }}>
          {selectedCount > 0 && !isMobile && isOwner ? (
            <button className="btn" disabled={bulkDeleting} onClick={() => void deleteSelected()}>
              {bulkDeleting ? 'Deleting…' : 'Delete selected'}
            </button>
          ) : null}
          <div className="help">Tip: swipe table horizontally for more columns.</div>
        </div>
      </div>

      {isMobile ? (
        <div ref={scrollRootRef} className="expensesScroll" style={{ marginTop: 14, display: 'grid', gap: 10 }}>
          {busy && rows.length === 0 ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div className="card" key={`skm-${i}`}>
                <div className="cardBody" style={{ padding: 14 }}>
                  <div className="skeleton" style={{ width: 140, height: 14 }} />
                  <div className="skeleton" style={{ width: 90, height: 14, marginTop: 10 }} />
                </div>
              </div>
            ))
          ) : rows.length === 0 ? (
            <div className="card">
              <div className="cardBody" style={{ padding: 16, color: '#64748b' }}>
                No expenses for this range.
              </div>
            </div>
          ) : (
            rows.map((r) => (
              <button
                key={r.id}
                className="card"
                style={{ textAlign: 'left', padding: 0, cursor: 'pointer' }}
                onClick={() => openEdit(r)}
              >
                <div
                  className="cardBody"
                  style={{
                    padding: 14,
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 10,
                    alignItems: 'center',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div className="help">Category</div>
                    <div style={{ fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {normalizeCategory(r.categories)?.name ?? '—'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="help">Amount</div>
                    <div style={{ fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>
                      {fmtMoney(r.amount_original_minor, r.currency_original)}
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      ) : (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="cardBody" style={{ padding: 0 }}>
            {busy ? <div className="tableBusyBar" /> : null}
            <div ref={scrollRootRef} className="tableWrap expensesScroll">
              <table className="table">
                <thead>
                  <tr>
                    {isOwner ? (
                      <th style={{ width: 44 }}>
                        <input
                          type="checkbox"
                          checked={allLoadedSelected}
                          aria-label="Select all loaded"
                          onChange={toggleSelectAllLoaded}
                        />
                      </th>
                    ) : null}
                    <th>Date</th>
                    <th>Category</th>
                    <th>Added by</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    <th style={{ textAlign: 'right' }}>Base</th>
                    <th>Notes</th>
                    {isOwner ? <th style={{ width: 140 }} /> : null}
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
                      <td colSpan={isOwner ? 8 : 7} style={{ padding: 18, color: '#64748b' }}>
                        No expenses for this range.
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => (
                      <tr key={r.id}>
                        {isOwner ? (
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(r.id)}
                              aria-label={`Select expense ${r.id}`}
                              onChange={() => toggleSelectOne(r.id)}
                            />
                          </td>
                        ) : null}
                        <td style={{ whiteSpace: 'nowrap' }}>{r.expense_date}</td>
                        <td>{normalizeCategory(r.categories)?.name ?? '—'}</td>
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
                        {isOwner ? (
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
                        ) : null}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

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
              <div className="formGrid2">
                <div className="formCol">
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

                <div className="formCol">
                  <div className="help">Date</div>
                  <input
                    className="input"
                    type="date"
                    value={edit.expense_date}
                    onChange={(e) => setEdit((p) => (p ? { ...p, expense_date: e.target.value } : p))}
                  />
                </div>

                <div className="formCol">
                  <div className="help">Amount</div>
                  <input
                    className="input"
                    inputMode="decimal"
                    value={edit.amount}
                    onChange={(e) => setEdit((p) => (p ? { ...p, amount: e.target.value } : p))}
                  />
                </div>

                <div className="formCol">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 8 }}>
                    <div className="help">Currency</div>
                    <span className="tooltipWrap" tabIndex={0}>
                      <span className="infoIcon" aria-label="Currency info">i</span>
                      <span className="tooltip">
                        Default currency comes from your profile settings. You can change currency here when editing (useful for travel expenses).
                      </span>
                    </span>
                  </div>
                  <select
                    className="input"
                    value={edit.currency_original}
                    onChange={(e) => setEdit((p) => (p ? { ...p, currency_original: e.target.value } : p))}
                  >
                    {(() => {
                      const preferred = (profile?.default_currency ?? 'USD').toUpperCase()
                      const set = new Set([preferred, ...currencyChoices])
                      return Array.from(set)
                    })().map((c) => (
                      <option key={c} value={c}>
                        {c}{c === (profile?.default_currency ?? 'USD').toUpperCase() ? ' (default)' : ''}
                      </option>
                    ))}
                  </select>
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

              <div className="row" style={{ marginTop: 14, justifyContent: 'space-between' }}>
                <div className="row">
                  <button className="btn btnPrimary" disabled={saving} onClick={() => void saveEdit()}>
                    {saving ? 'Saving…' : 'Save changes'}
                  </button>
                  <button className="btn" onClick={closeEdit}>
                    Cancel
                  </button>
                </div>

                {isOwner ? (
                  <button
                    className="btn"
                    disabled={deletingId === edit.id}
                    onClick={() => void deleteExpense(edit.id)}
                  >
                    {deletingId === edit.id ? '…' : 'Delete'}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

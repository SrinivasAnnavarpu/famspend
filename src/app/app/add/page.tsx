'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ToastProvider'
// (nav handled by AppShell)
import { toMinorUnits } from '@/lib/money'
import { getFxRate } from '@/lib/fx'
import { clampLen, isYmd, parsePositiveAmount, sanitizePlainText } from '@/lib/validate'
import { enqueue, flushQueue, peekAll } from '@/lib/offlineQueue'

function stripName(x: string) {
  return sanitizePlainText(x).replace(/\s+/g, ' ').trim()
}

type Family = {
  id: string
  name: string
  base_currency: string
}

type Category = {
  id: string
  name: string
  icon: string | null
  color: string | null
}

type Profile = {
  user_id: string
  default_currency: string
  timezone: string
}

export default function AddExpensePage() {
  const router = useRouter()
  const toast = useToast()

  const [busy, setBusy] = useState(false)
  const [family, setFamily] = useState<Family | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [categories, setCategories] = useState<Category[]>([])

  const today = useMemo(() => {
    const d = new Date()
    // Local date, yyyy-mm-dd
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }, [])

  const [categoryId, setCategoryId] = useState<string>('')
  const [amount, setAmount] = useState<string>('')
  const [date, setDate] = useState<string>('')
  const [notes, setNotes] = useState<string>('')

  const [errs, setErrs] = useState<{ category?: string; amount?: string; date?: string; notes?: string }>({})

  const [catModalOpen, setCatModalOpen] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [creatingCat, setCreatingCat] = useState(false)

  useEffect(() => {
    async function onOnline() {
      try {
        if (!family?.id) return
        const q = peekAll()
        if (q.length === 0) return
        const res = await flushQueue({ supabase, familyId: family.id })
        if (res.flushed > 0) toast.success(`Synced ${res.flushed} offline change(s)`)
      } catch {
        // ignore
      }
    }

    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [family?.id, toast])

  useEffect(() => {
    setDate(today)
  }, [today])

  useEffect(() => {
    async function load() {
      const { data } = await supabase.auth.getSession()
      const session = data.session
      if (!session) {
        router.replace('/login')
        return
      }

      const userId = session.user.id

      // membership
      const { data: memberships, error: mErr } = await supabase
        .from('family_members')
        .select('family_id')
        .eq('user_id', userId)
        .limit(1)

      if (mErr) {
        toast.error(mErr.message, 'Load failed')
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
        toast.error(fErr?.message ?? 'Family not found', 'Load failed')
        return
      }
      setFamily(fam)

      const { data: prof, error: pErr } = await supabase
        .from('profiles')
        .select('user_id, default_currency, timezone')
        .eq('user_id', userId)
        .maybeSingle()

      if (pErr || !prof) {
        toast.error(pErr?.message ?? 'Profile not found', 'Load failed')
        return
      }
      setProfile(prof)

      const { data: cats, error: cErr } = await supabase
        .from('categories')
        .select('id, name, icon, color')
        .eq('family_id', familyId)
        .eq('active', true)
        .order('sort_order', { ascending: true })

      if (cErr) {
        toast.error(cErr.message, 'Load failed')
        return
      }

      setCategories(cats ?? [])
      if ((cats?.length ?? 0) > 0) setCategoryId(String(cats![0].id))
    }

    void load()
  }, [router, toast, today])

  async function createCategory() {
    if (!family) return

    const name = stripName(newCatName)
    if (!name) {
      toast.error('Enter a category name')
      return
    }
    if (name.length > 40) {
      toast.error('Category name is too long (max 40)')
      return
    }

    setCreatingCat(true)
    try {
      const nextOrder = (categories?.reduce((m, c) => Math.max(m, Number((c as any).sort_order ?? 0)), -1) ?? -1) + 1

      const payload = {
        family_id: family.id,
        name: clampLen(name, 40),
        sort_order: nextOrder,
        active: true,
        icon: null,
        color: null,
      }

      const { data: inserted, error } = await supabase
        .from('categories')
        .insert(payload)
        .select('id, name, icon, color')
        .maybeSingle()

      if (error) {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          enqueue({ type: 'category', createdAt: Date.now(), payload })
          toast.info('Category saved offline. Will sync when you’re back online.')
        } else {
          throw error
        }
      }

      // Refresh list
      const { data: cats, error: cErr } = await supabase
        .from('categories')
        .select('id, name, icon, color')
        .eq('family_id', family.id)
        .eq('active', true)
        .order('sort_order', { ascending: true })

      if (cErr) throw cErr

      setCategories(cats ?? [])
      const newId = inserted?.id ?? cats?.find((c) => c.name === name)?.id
      if (newId) setCategoryId(String(newId))

      toast.success('Category added')
      setNewCatName('')
      setCatModalOpen(false)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      toast.error(msg, 'Add category failed')
    } finally {
      setCreatingCat(false)
    }
  }

  async function addExpense() {
    if (!family || !profile) return

    const nextErrs: { category?: string; amount?: string; date?: string; notes?: string } = {}
    if (!categoryId) nextErrs.category = 'Pick a category'

    const amt = parsePositiveAmount(amount)
    if (!amt.ok) nextErrs.amount = amt.error

    if (!date || !isYmd(date)) nextErrs.date = 'Pick a valid date'

    const notesClean = sanitizePlainText(notes)
    if (notesClean.length > 280) nextErrs.notes = 'Notes are too long (max 280 characters)'

    setErrs(nextErrs)
    if (Object.keys(nextErrs).length > 0) {
      toast.error('Please fix the highlighted fields')
      return
    }

    setBusy(true)
    try {
      const { data } = await supabase.auth.getSession()
      const session = data.session
      if (!session) throw new Error('Not signed in')

      if (!amt.ok) throw new Error(amt.error)
      const originalMinor = toMinorUnits(amt.value)
      const originalCurrency = profile.default_currency
      const baseCurrency = family.base_currency

      const fxRate = await getFxRate({ from: originalCurrency, to: baseCurrency, date })
      const baseMinor = Math.round(originalMinor * fxRate)

      const safeNotes = notesClean.trim() ? clampLen(notesClean.trim(), 280) : null

      const payload = {
        family_id: family.id,
        created_by: session.user.id,
        category_id: categoryId,
        expense_date: date,
        timezone: profile.timezone,
        amount_original_minor: originalMinor,
        currency_original: originalCurrency,
        currency_base: baseCurrency,
        fx_rate: fxRate,
        fx_date: date,
        amount_base_minor: baseMinor,
        notes: safeNotes,
      }

      const { error } = await supabase.from('expenses').insert(payload)

      if (error) {
        // If offline (or request failed), queue and continue.
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          enqueue({ type: 'expense', createdAt: Date.now(), payload })
          toast.info('Saved offline. Will sync when you’re back online.')
        } else {
          throw error
        }
      } else {
        toast.success('Expense added')
      }

      setAmount('')
      setNotes('')
      // Keep the same date/category for fast entry.
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      toast.error(msg, 'Add expense failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container">
      <div className="header">
        <div>
          <div className="brandTitle">Add expense</div>
          <div className="help">
            {family ? `${family.name} • Base: ${family.base_currency}` : 'Loading…'}
          </div>
        </div>
        {/* nav handled by AppShell */}
      </div>

      <div className="card" style={{ maxWidth: 720 }}>
        <div className="cardBody" style={{ padding: 22 }}>
          <div style={{ maxWidth: 560, margin: 0, display: 'grid', gap: 12 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="help">Category</span>
                <button className="btn btnGhost btnGhostSmall" type="button" onClick={() => setCatModalOpen(true)}>
                  + New
                </button>
              </div>
              <select
                className={errs.category ? 'input inputInvalid' : 'input'}
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value)
                  setErrs((p) => ({ ...p, category: undefined }))
                }}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {(c.icon ? `${c.icon} ` : '') + c.name}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span className="help">Amount ({profile?.default_currency ?? '—'})</span>
              <input
                className={errs.amount ? 'input inputInvalid' : 'input'}
                inputMode="decimal"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value)
                  setErrs((p) => ({ ...p, amount: undefined }))
                }}
                placeholder="0.00"
              />
              <span className="help">Currency is taken from your settings. Change it later by editing the expense.</span>
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span className="help">Date</span>
              <input
                className={errs.date ? 'input inputInvalid' : 'input'}
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value)
                  setErrs((p) => ({ ...p, date: undefined }))
                }}
              />
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span className="help">Notes (optional)</span>
              <input
                className={errs.notes ? 'input inputInvalid' : 'input'}
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value)
                  setErrs((p) => ({ ...p, notes: undefined }))
                }}
                placeholder="e.g., groceries, Uber, electricity bill"
              />
            </label>

            <button className="btn btnPrimary" disabled={busy} onClick={addExpense}>
              {busy ? 'Adding…' : 'Add expense'}
            </button>
          </div>
        </div>
      </div>

      {catModalOpen ? (
        <div className="modalBackdrop" role="dialog" aria-modal="true" onClick={() => setCatModalOpen(false)}>
          <div className="card modal" onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div>
                <div style={{ fontWeight: 850, letterSpacing: -0.2 }}>New category</div>
                <div className="help">Add a category you can reuse later.</div>
              </div>
              <button className="btn btnGhost" onClick={() => setCatModalOpen(false)}>
                Close
              </button>
            </div>
            <div className="modalBody">
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="help">Name</span>
                <input
                  className="input"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="e.g., Coffee"
                  autoFocus
                />
              </label>

              <div className="row" style={{ marginTop: 14 }}>
                <button className="btn btnPrimary" disabled={creatingCat} onClick={() => void createCategory()}>
                  {creatingCat ? 'Adding…' : 'Add category'}
                </button>
                <button className="btn" onClick={() => setCatModalOpen(false)}>
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

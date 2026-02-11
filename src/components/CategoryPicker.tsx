'use client'

import { useEffect, useMemo, useState } from 'react'

export type PickerCategory = {
  id: string
  name: string
  icon?: string | null
  color?: string | null
}

export function CategoryPicker({
  open,
  title = 'Select category',
  categories,
  selectedId,
  onSelect,
  onClose,
  allowCreate,
  onCreate,
}: {
  open: boolean
  title?: string
  categories: PickerCategory[]
  selectedId: string | null
  onSelect: (id: string) => void
  onClose: () => void
  allowCreate?: boolean
  onCreate?: () => void
}) {
  const [q, setQ] = useState('')

  useEffect(() => {
    if (open) setQ('')
  }, [open])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return categories
    return categories.filter((c) => c.name.toLowerCase().includes(s))
  }, [categories, q])

  if (!open) return null

  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="card modal" onClick={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <div>
            <div style={{ fontWeight: 850, letterSpacing: -0.2 }}>{title}</div>
            <div className="help">Search and pick a category.</div>
          </div>
          <button className="btn btnGhost" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="modalBody">
          <div style={{ display: 'grid', gap: 10 }}>
            <div className="inputWrap">
              <input
                className="input"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search categories…"
                autoFocus
              />
              {q.trim() ? (
                <button className="inputClear" aria-label="Clear search" onClick={() => setQ('')}>
                  ×
                </button>
              ) : null}
            </div>

            {allowCreate && onCreate ? (
              <button className="btn btnGhost" onClick={onCreate}>
                + New category
              </button>
            ) : null}

            <div style={{ maxHeight: '55vh', overflow: 'auto', borderRadius: 14, border: '1px solid rgba(15, 23, 42, 0.10)' }}>
              {filtered.length === 0 ? (
                <div style={{ padding: 12, color: '#64748b' }}>No matches.</div>
              ) : (
                filtered.map((c) => {
                  const active = c.id === selectedId
                  return (
                    <button
                      key={c.id}
                      className="menuItem"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                        background: active ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                      }}
                      onClick={(e) => {
                        // Prevent "click-through" where the modal closes and the click lands on
                        // underlying UI (e.g. the "+ New" button).
                        e.preventDefault()
                        e.stopPropagation()
                        onSelect(c.id)
                        window.setTimeout(() => onClose(), 0)
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <span
                          aria-hidden
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 999,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: c.color ?? 'rgba(148, 163, 184, 0.18)',
                            border: '1px solid rgba(15, 23, 42, 0.08)',
                            flex: '0 0 auto',
                          }}
                        >
                          <span style={{ fontSize: 16 }}>{c.icon ?? '•'}</span>
                        </span>
                        <span style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                      </span>
                      {active ? <span style={{ color: '#1d4ed8', fontWeight: 900 }}>✓</span> : null}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

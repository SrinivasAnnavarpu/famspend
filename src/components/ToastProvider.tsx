'use client'

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'

type ToastType = 'error' | 'success' | 'info'

type Toast = {
  id: string
  type: ToastType
  title?: string
  message: string
}

type ToastContextValue = {
  push: (t: Omit<Toast, 'id'>) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

function randomId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = randomId()
    const toast: Toast = { id, ...t }
    setToasts((prev) => [toast, ...prev].slice(0, 3))

    window.setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id))
    }, 4500)
  }, [])

  const value = useMemo(() => ({ push }), [push])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        style={{
          position: 'fixed',
          top: 16,
          right: 16,
          display: 'grid',
          gap: 10,
          zIndex: 9999,
          width: 360,
          maxWidth: 'calc(100vw - 32px)',
        }}
        aria-live="polite"
        aria-relevant="additions"
      >
        {toasts.map((t) => {
          const border =
            t.type === 'error'
              ? 'rgba(220, 38, 38, 0.35)'
              : t.type === 'success'
                ? 'rgba(22, 163, 74, 0.35)'
                : 'rgba(37, 99, 235, 0.25)'

          const bg =
            t.type === 'error'
              ? 'rgba(220, 38, 38, 0.08)'
              : t.type === 'success'
                ? 'rgba(22, 163, 74, 0.08)'
                : 'rgba(37, 99, 235, 0.08)'

          return (
            <div key={t.id} className="card" style={{ borderColor: border, background: bg }}>
              <div className="cardBody" style={{ padding: 12 }}>
                {t.title ? (
                  <div style={{ fontWeight: 850, letterSpacing: -0.2 }}>{t.title}</div>
                ) : null}
                <div style={{ color: '#0f172a', marginTop: t.title ? 4 : 0, fontSize: 14, lineHeight: 1.35 }}>
                  {t.message}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')

  return {
    error: (message: string, title = 'Error') => ctx.push({ type: 'error', title, message }),
    success: (message: string, title = 'Success') => ctx.push({ type: 'success', title, message }),
    info: (message: string, title = 'Info') => ctx.push({ type: 'info', title, message }),
  }
}

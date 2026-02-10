'use client'

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'

type ToastType = 'error' | 'success' | 'info'

type Toast = {
  id: string
  type: ToastType
  title?: string
  message: string
  state: 'enter' | 'leave'
}

type ToastContextValue = {
  push: (t: { type: ToastType; title?: string; message: string }) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

function randomId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

const TOAST_TTL_MS = 3000
const TOAST_EXIT_MS = 220

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback((t: { type: ToastType; title?: string; message: string }) => {
    const id = randomId()
    const toast: Toast = { id, ...t, state: 'enter' }
    setToasts((prev) => [toast, ...prev].slice(0, 3))

    window.setTimeout(() => {
      setToasts((prev) => prev.map((x) => (x.id === id ? { ...x, state: 'leave' } : x)))
    }, Math.max(0, TOAST_TTL_MS - TOAST_EXIT_MS))

    window.setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id))
    }, TOAST_TTL_MS)
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

          const animStyle: React.CSSProperties =
            t.state === 'leave'
              ? {
                  opacity: 0,
                  transform: 'translateX(8px)',
                  transition: `opacity ${TOAST_EXIT_MS}ms ease, transform ${TOAST_EXIT_MS}ms ease`,
                }
              : {
                  opacity: 1,
                  transform: 'translateX(0px)',
                  transition: `opacity ${TOAST_EXIT_MS}ms ease, transform ${TOAST_EXIT_MS}ms ease`,
                }

          return (
            <div
              key={t.id}
              className="card"
              style={{
                borderColor: border,
                background: bg,
                ...animStyle,
              }}
            >
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

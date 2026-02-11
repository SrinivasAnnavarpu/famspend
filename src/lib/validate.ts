export function isEmail(x: string) {
  const s = x.trim()
  // Simple email check; server still enforces real validity.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

export function clampLen(x: string, max: number) {
  const s = x ?? ''
  return s.length > max ? s.slice(0, max) : s
}

export function isYmd(x: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(x)
}

export function parsePositiveAmount(input: string) {
  const cleaned = input.trim().replaceAll(',', '')
  if (!cleaned) return { ok: false as const, error: 'Enter an amount' }
  if (!/^[0-9]*\.?[0-9]*$/.test(cleaned)) return { ok: false as const, error: 'Amount must be a number' }
  const n = Number(cleaned)
  if (!Number.isFinite(n)) return { ok: false as const, error: 'Amount is invalid' }
  if (n <= 0) return { ok: false as const, error: 'Amount must be > 0' }
  return { ok: true as const, value: cleaned }
}

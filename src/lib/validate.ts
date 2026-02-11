export function isEmail(x: string) {
  const s = x.trim()
  // Simple email check; server still enforces real validity.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

// Basic input sanitation for fields that should be plain text.
// Note: React already escapes on render, so this is mainly to prevent storing HTML tags
// and to reduce the chance of CSV / downstream injection.
export function sanitizePlainText(x: string) {
  const s = (x ?? '').toString()
  // Remove control chars (except common whitespace)
  const noCtl = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
  // Strip basic HTML tags
  const noTags = noCtl.replace(/<[^>]*>/g, '')
  return noTags
}

export function sanitizeForCsv(x: string) {
  const s = sanitizePlainText(x)
  // Prevent formula injection in spreadsheets
  if (/^[=+\-@]/.test(s.trim())) return `'${s}`
  return s
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

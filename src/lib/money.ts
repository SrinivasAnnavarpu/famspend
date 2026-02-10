export function toMinorUnits(amountStr: string): number {
  const n = Number(amountStr)
  if (!Number.isFinite(n)) throw new Error('Invalid amount')
  // MVP: assume 2 decimal places (works for USD/INR/EUR etc.)
  return Math.round(n * 100)
}

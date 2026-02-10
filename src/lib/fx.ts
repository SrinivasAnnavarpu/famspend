export async function getFxRate(params: {
  from: string
  to: string
  date: string // YYYY-MM-DD
}): Promise<number> {
  const { from, to, date } = params
  if (from === to) return 1

  // Frankfurter supports many currencies, uses ECB rates, and supports historical dates.
  // https://www.frankfurter.app/
  const url = `https://api.frankfurter.app/${encodeURIComponent(date)}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`FX fetch failed (${res.status})`)
  const data = (await res.json()) as { rates?: Record<string, number> }
  const rate = data?.rates?.[to]
  if (!rate) throw new Error('FX rate not available')
  return rate
}

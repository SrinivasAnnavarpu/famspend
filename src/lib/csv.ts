export function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])

  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v)
    const needs = /[\n\r,\"]/g.test(s)
    const inner = s.replace(/\"/g, '""')
    return needs ? `"${inner}"` : inner
  }

  const lines = [headers.join(',')]
  for (const r of rows) {
    lines.push(headers.map((h) => esc(r[h])).join(','))
  }
  return lines.join('\n')
}

export function downloadText(filename: string, text: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

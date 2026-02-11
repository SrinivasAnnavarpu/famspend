type QueueItem =
  | { type: 'expense'; createdAt: number; payload: Record<string, unknown> }
  | { type: 'category'; createdAt: number; payload: Record<string, unknown> }

const KEY = 'famspend.offlineQueue.v1'

function safeJsonParse(x: string | null) {
  if (!x) return [] as QueueItem[]
  try {
    const v = JSON.parse(x)
    return Array.isArray(v) ? (v as QueueItem[]) : ([] as QueueItem[])
  } catch {
    return [] as QueueItem[]
  }
}

export function enqueue(item: QueueItem) {
  const existing = safeJsonParse(localStorage.getItem(KEY))
  existing.unshift(item)
  localStorage.setItem(KEY, JSON.stringify(existing.slice(0, 200)))
}

export function peekAll() {
  return safeJsonParse(localStorage.getItem(KEY))
}

export function clearAll() {
  localStorage.removeItem(KEY)
}

export async function flushQueue(opts: {
  supabase: any
  familyId: string
  onProgress?: (n: number) => void
}) {
  const items = peekAll().reverse() // oldest first
  if (items.length === 0) return { flushed: 0 }

  const remaining: QueueItem[] = []
  let flushed = 0

  for (const it of items) {
    try {
      if (it.type === 'category') {
        const { error } = await opts.supabase.from('categories').insert(it.payload)
        if (error) throw error
      } else if (it.type === 'expense') {
        const { error } = await opts.supabase.from('expenses').insert(it.payload)
        if (error) throw error
      }

      flushed += 1
      opts.onProgress?.(flushed)
    } catch {
      // keep it for later
      remaining.push(it)
    }
  }

  if (remaining.length === 0) clearAll()
  else localStorage.setItem(KEY, JSON.stringify(remaining))

  return { flushed }
}

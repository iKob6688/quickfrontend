type StoredDraft<T> = {
  version: 1
  updatedAt: string
  data: T
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function loadDraft<T>(key: string): StoredDraft<T> | null {
  if (typeof window === 'undefined') return null
  return safeParse<StoredDraft<T>>(window.localStorage.getItem(key))
}

export function saveDraft<T>(key: string, data: T) {
  if (typeof window === 'undefined') return
  const payload: StoredDraft<T> = {
    version: 1,
    updatedAt: new Date().toISOString(),
    data,
  }
  window.localStorage.setItem(key, JSON.stringify(payload))
}

export function clearDraft(key: string) {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(key)
}

export function loadRecentNotes(key: string): string[] {
  if (typeof window === 'undefined') return []
  const parsed = safeParse<string[]>(window.localStorage.getItem(key))
  return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string' && x.trim()) : []
}

export function pushRecentNote(key: string, note: string, max = 8) {
  if (typeof window === 'undefined') return
  const normalized = note.trim()
  if (!normalized) return
  const prev = loadRecentNotes(key)
  const next = [normalized, ...prev.filter((n) => n !== normalized)].slice(0, max)
  window.localStorage.setItem(key, JSON.stringify(next))
}


import { z } from 'zod'

export type StoreEnvelope<T> = {
  schemaVersion: number
  savedAt: string
  data: T
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function safeJsonParse(input: string): unknown {
  try {
    return JSON.parse(input) as unknown
  } catch {
    return undefined
  }
}

export function loadFromLocalStorage<T>(
  key: string,
  schema: z.ZodType<T>,
): T | undefined {
  const raw = localStorage.getItem(key)
  if (!raw) return undefined
  const parsed = safeJsonParse(raw)
  const result = schema.safeParse(parsed)
  if (!result.success) return undefined
  return result.data
}

export function saveToLocalStorage<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value))
}



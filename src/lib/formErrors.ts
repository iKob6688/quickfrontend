import { ApiError } from '@/api/response'
import { useCallback, useState } from 'react'

export type FieldErrors = Record<string, string>

export function useFormErrors() {
  const [globalError, setGlobalError] = useState<string | undefined>(undefined)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const clearErrors = useCallback(() => {
    setGlobalError(undefined)
    setFieldErrors({})
  }, [])

  return { globalError, fieldErrors, setGlobalError, setFieldErrors, clearErrors }
}

/**
 * Best-effort mapping of backend error details into field-level errors.
 * Backend may return `details` in different shapes; we support a few common patterns:
 * - { field_errors: { fieldName: "message" } }
 * - { errors: [{ field: "name", message: "..." }] }
 */
export function extractFieldErrors(err: unknown): FieldErrors | null {
  const apiErr = err instanceof ApiError ? err : null
  const details = apiErr?.details
  if (!details || typeof details !== 'object') return null

  const d = details as Record<string, unknown>

  if (d.field_errors && typeof d.field_errors === 'object') {
    const fe = d.field_errors as Record<string, unknown>
    const out: FieldErrors = {}
    for (const [k, v] of Object.entries(fe)) {
      if (typeof v === 'string' && v.trim()) out[k] = v
    }
    return Object.keys(out).length ? out : null
  }

  if (Array.isArray(d.errors)) {
    const out: FieldErrors = {}
    for (const item of d.errors) {
      if (!item || typeof item !== 'object') continue
      const it = item as Record<string, unknown>
      const field = typeof it.field === 'string' ? it.field : null
      const msg = typeof it.message === 'string' ? it.message : null
      if (field && msg) out[field] = msg
    }
    return Object.keys(out).length ? out : null
  }

  return null
}



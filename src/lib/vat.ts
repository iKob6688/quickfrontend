export function sanitizeVatNumber(value?: string | null): string {
  return String(value || '')
    .replace(/\D/g, '')
    .slice(0, 13)
}

export function normalizeVatNumber(value?: string | null): string | undefined {
  const sanitized = sanitizeVatNumber(value)
  return sanitized || undefined
}

export function isValidThaiVatNumber(value?: string | null): boolean {
  const sanitized = sanitizeVatNumber(value)
  return sanitized.length === 13
}

export function thaiVatValidationMessage(value?: string | null): string | null {
  const raw = String(value || '').trim()
  if (!raw) return null
  const sanitized = sanitizeVatNumber(raw)
  if (sanitized.length !== 13) return 'เลขผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก'
  return null
}

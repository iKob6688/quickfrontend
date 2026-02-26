const SCOPE_ALIAS: Record<string, string[]> = {
  reports: ['accounting_reports'],
  accounting_reports: ['reports'],
  purchases: ['purchase'],
  purchase: ['purchases'],
  expenses: ['expense'],
  expense: ['expenses'],
}

const RUNTIME_SCOPE_KEY = 'qf18_allowed_scopes'

function normalizeScope(scope: string): string {
  return scope.trim().toLowerCase()
}

function getNormalizedAllowedScopeSet(): Set<string> | null {
  // Source of truth should come from backend runtime payload, not hardcoded .env.
  const allowedScopes =
    typeof window !== 'undefined' ? window.localStorage.getItem(RUNTIME_SCOPE_KEY) || '' : ''
  if (!allowedScopes || !allowedScopes.trim()) return null

  const normalized = normalizeScope(allowedScopes)
  if (normalized === '*' || normalized === 'all' || normalized === 'all_scopes') {
    return null
  }

  return new Set(
    allowedScopes
      .split(',')
      .map((s: string) => normalizeScope(s))
      .filter(Boolean),
  )
}

export function setRuntimeAllowedScopes(scopes: string[] | string | null | undefined) {
  if (typeof window === 'undefined') return

  if (!scopes) {
    window.localStorage.removeItem(RUNTIME_SCOPE_KEY)
    return
  }

  const value = Array.isArray(scopes) ? scopes.join(',') : String(scopes)
  if (!value.trim()) {
    window.localStorage.removeItem(RUNTIME_SCOPE_KEY)
    return
  }
  window.localStorage.setItem(RUNTIME_SCOPE_KEY, value)
}

export function clearRuntimeAllowedScopes() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(RUNTIME_SCOPE_KEY)
}

/**
 * Checks if a scope is allowed based on VITE_ALLOWED_SCOPES
 * @param scope The scope to check (e.g., 'auth', 'invoice', 'excel')
 * @returns true if the scope is allowed, false otherwise
 */
export function hasScope(scope: string): boolean {
  // If scopes are not configured in .env, don't hard-block the UI.
  // Backend will still enforce scopes; this prevents "everything disabled" UX.
  const allowed = getNormalizedAllowedScopeSet()
  if (!allowed) return true

  const target = normalizeScope(scope)
  if (allowed.has(target)) return true

  const aliases = SCOPE_ALIAS[target] ?? []
  return aliases.some((alias) => allowed.has(alias))
}

/**
 * Gets all allowed scopes from environment variable
 * @returns Array of allowed scope strings
 */
export function getAllowedScopes(): string[] {
  const allowedScopes =
    typeof window !== 'undefined' ? window.localStorage.getItem(RUNTIME_SCOPE_KEY) : null
  if (!allowedScopes) return []

  return allowedScopes
    .split(',')
    .map((s: string) => s.trim())
    .filter(Boolean)
}

export function isScopesConfigured(): boolean {
  return Boolean(typeof window !== 'undefined' && window.localStorage.getItem(RUNTIME_SCOPE_KEY))
}

/**
 * Checks if any of the provided scopes are allowed
 * @param scopes Array of scopes to check
 * @returns true if at least one scope is allowed
 */
export function hasAnyScope(scopes: string[]): boolean {
  return scopes.some((scope: string) => hasScope(scope))
}

/**
 * Checks if all of the provided scopes are allowed
 * @param scopes Array of scopes to check
 * @returns true if all scopes are allowed
 */
export function hasAllScopes(scopes: string[]): boolean {
  return scopes.every((scope: string) => hasScope(scope))
}

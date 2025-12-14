/**
 * Checks if a scope is allowed based on VITE_ALLOWED_SCOPES
 * @param scope The scope to check (e.g., 'auth', 'invoice', 'excel')
 * @returns true if the scope is allowed, false otherwise
 */
export function hasScope(scope: string): boolean {
  const allowedScopes = import.meta.env.VITE_ALLOWED_SCOPES
  // If scopes are not configured in .env, don't hard-block the UI.
  // Backend will still enforce scopes; this prevents "everything disabled" UX.
  if (!allowedScopes || !allowedScopes.trim()) return true

  const normalized = allowedScopes.trim().toLowerCase()
  // Support common "all scopes" notations from bootstrap/backends
  if (normalized === '*' || normalized === 'all' || normalized === 'all_scopes') return true
  
  const scopes = allowedScopes.split(',').map((s: string) => s.trim())
  return scopes.includes(scope)
}

/**
 * Gets all allowed scopes from environment variable
 * @returns Array of allowed scope strings
 */
export function getAllowedScopes(): string[] {
  const allowedScopes = import.meta.env.VITE_ALLOWED_SCOPES
  if (!allowedScopes) return []
  
  return allowedScopes.split(',').map((s: string) => s.trim())
}

export function isScopesConfigured(): boolean {
  return Boolean(import.meta.env.VITE_ALLOWED_SCOPES)
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


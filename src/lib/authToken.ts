const ACCESS_TOKEN_KEY = 'qf18_access_token'

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(ACCESS_TOKEN_KEY)
  } catch {
    return null
  }
}

export function setAccessToken(token: string | null) {
  if (typeof window === 'undefined') return
  try {
    if (token) {
      window.localStorage.setItem(ACCESS_TOKEN_KEY, token)
    } else {
      window.localStorage.removeItem(ACCESS_TOKEN_KEY)
    }
  } catch {
    // ignore storage errors to avoid breaking auth flow
  }
}

export function clearAuthStorage() {
  setAccessToken(null)
}


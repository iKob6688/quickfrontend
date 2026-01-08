const AGENT_TOKEN_KEY = 'qf18_agent_token'

export function getAgentToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(AGENT_TOKEN_KEY)
  } catch {
    return null
  }
}

export function setAgentToken(token: string | null) {
  if (typeof window === 'undefined') return
  try {
    if (token) {
      window.localStorage.setItem(AGENT_TOKEN_KEY, token)
    } else {
      window.localStorage.removeItem(AGENT_TOKEN_KEY)
    }
  } catch {
    // ignore storage errors
  }
}

export function clearAgentToken() {
  setAgentToken(null)
}


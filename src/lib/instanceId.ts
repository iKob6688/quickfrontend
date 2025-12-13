const INSTANCE_KEY = 'qf18_instance_public_id'

export function getInstanceId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(INSTANCE_KEY)
  } catch {
    return null
  }
}

export function setInstanceId(id: string | null) {
  if (typeof window === 'undefined') return
  try {
    if (id) {
      window.localStorage.setItem(INSTANCE_KEY, id)
    } else {
      window.localStorage.removeItem(INSTANCE_KEY)
    }
  } catch {
    // ignore storage errors
  }
}

export function clearInstanceId() {
  setInstanceId(null)
}



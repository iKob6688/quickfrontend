export type ThemeMode = 'light' | 'dark'

const STORAGE_KEY = 'qf.theme.mode'
const ROOT_ATTR = 'data-qf-theme'

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark'
}

export function getThemeMode(): ThemeMode {
  if (typeof window === 'undefined') return 'light'
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return isThemeMode(stored) ? stored : 'light'
  } catch {
    return 'light'
  }
}

export function applyThemeMode(mode: ThemeMode) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute(ROOT_ATTR, mode)
  document.documentElement.style.colorScheme = mode
}

export function setThemeMode(mode: ThemeMode) {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, mode)
    } catch {
      // Ignore storage errors and still apply the theme for this session.
    }
  }
  applyThemeMode(mode)
}

export function initializeThemeMode(): ThemeMode {
  const mode = getThemeMode()
  applyThemeMode(mode)
  return mode
}


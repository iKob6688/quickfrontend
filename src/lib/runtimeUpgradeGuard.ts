const RELOAD_MARKER_PREFIX = 'qf:upgrade-reload:'

function shouldHandleError(message: string): boolean {
  const text = message.toLowerCase()
  return (
    text.includes('failed to fetch dynamically imported module') ||
    text.includes('chunkloaderror') ||
    text.includes('importing a module script failed')
  )
}

export function installRuntimeUpgradeGuard(buildId: string) {
  if (typeof window === 'undefined') return
  const markerKey = `${RELOAD_MARKER_PREFIX}${buildId}`

  const tryReload = () => {
    if (sessionStorage.getItem(markerKey) === '1') return
    sessionStorage.setItem(markerKey, '1')
    window.location.reload()
  }

  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault()
    tryReload()
  })

  window.addEventListener('error', (event) => {
    const msg = String((event as ErrorEvent).message || '')
    if (shouldHandleError(msg)) tryReload()
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    const msg =
      typeof reason === 'string'
        ? reason
        : String(reason?.message || reason?.toString?.() || '')
    if (shouldHandleError(msg)) {
      event.preventDefault()
      tryReload()
    }
  })
}

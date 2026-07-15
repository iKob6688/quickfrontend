import { useEffect } from 'react'

type Options = {
  enabled?: boolean
  onSave?: () => void
  onPrint?: () => void
}

export function useDocumentKeyboardShortcuts({ enabled = true, onSave, onPrint }: Options) {
  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      const metaOrCtrl = event.metaKey || event.ctrlKey

      if (metaOrCtrl && key === 's') {
        event.preventDefault()
        onSave?.()
        return
      }

      if (metaOrCtrl && key === 'p') {
        event.preventDefault()
        onPrint?.()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled, onPrint, onSave])
}

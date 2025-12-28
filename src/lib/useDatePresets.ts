/**
 * React hook for date presets with keyboard shortcuts
 */

import { useEffect } from 'react'
import { DATE_PRESETS, toISODate } from './datePresets'

export interface UseDatePresetsOptions {
  onPreset: (dateFrom: string, dateTo: string) => void
  enabled?: boolean
}

/**
 * Hook to handle date preset keyboard shortcuts
 * @param onPreset Callback when a preset is selected
 * @param enabled Whether keyboard shortcuts are enabled
 */
export function useDatePresets({ onPreset, enabled = true }: UseDatePresetsOptions) {
  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt+1: เดือนนี้
      if (e.altKey && e.key === '1' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        const preset = DATE_PRESETS[0]
        onPreset(toISODate(preset.getDateFrom()), toISODate(preset.getDateTo()))
        return
      }

      // Alt+2: เดือนก่อนหน้า
      if (e.altKey && e.key === '2' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        const preset = DATE_PRESETS[1]
        onPreset(toISODate(preset.getDateFrom()), toISODate(preset.getDateTo()))
        return
      }

      // Alt+3: ปีปัจจุบัน
      if (e.altKey && e.key === '3' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        const preset = DATE_PRESETS[2]
        onPreset(toISODate(preset.getDateFrom()), toISODate(preset.getDateTo()))
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onPreset, enabled])
}


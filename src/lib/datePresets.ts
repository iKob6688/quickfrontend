/**
 * Date preset utilities for accounting reports
 */

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function firstDayOfThisMonth(): Date {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export function lastDayOfThisMonth(): Date {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}

export function firstDayOfLastMonth(): Date {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth() - 1, 1)
}

export function lastDayOfLastMonth(): Date {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 0)
}

export function firstDayOfThisYear(): Date {
  const d = new Date()
  return new Date(d.getFullYear(), 0, 1)
}

export function lastDayOfThisYear(): Date {
  const d = new Date()
  return new Date(d.getFullYear(), 11, 31)
}

/**
 * Date presets for quick selection
 */
export interface DatePreset {
  label: string
  hotkey?: string // e.g., "Alt+1"
  getDateFrom: () => Date
  getDateTo: () => Date
}

export const DATE_PRESETS: DatePreset[] = [
  {
    label: 'เดือนนี้',
    hotkey: 'Alt+1',
    getDateFrom: firstDayOfThisMonth,
    getDateTo: lastDayOfThisMonth,
  },
  {
    label: 'เดือนก่อนหน้า',
    hotkey: 'Alt+2',
    getDateFrom: firstDayOfLastMonth,
    getDateTo: lastDayOfLastMonth,
  },
  {
    label: 'ปีปัจจุบัน',
    hotkey: 'Alt+3',
    getDateFrom: firstDayOfThisYear,
    getDateTo: lastDayOfThisYear,
  },
]


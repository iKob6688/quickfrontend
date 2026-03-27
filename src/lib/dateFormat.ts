import { useSettingsStore } from '@/app/core/storage/settingsStore'

type DateDisplayFormat = 'DD/MM/YYYY' | 'DD-MM-YYYY' | 'D MMMM YYYY'
type DateCalendar = 'gregorian' | 'buddhist'

export type DateFormatSettings = {
  dateDisplayFormat?: DateDisplayFormat
  dateCalendar?: DateCalendar
}

function normalizeDateInput(value?: string | Date | null): Date | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date
}

function formatDateNumeric(
  date: Date,
  settings?: DateFormatSettings,
  separator: '/' | '-' = '/',
): string {
  const dateCalendar = settings?.dateCalendar || 'buddhist'
  const year = dateCalendar === 'buddhist' ? date.getFullYear() + 543 : date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${day}${separator}${month}${separator}${year}`
}

function formatTimeHHmm(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

export function formatAppDate(
  value?: string | Date | null,
  settings?: DateFormatSettings,
  fallback = '—',
): string {
  const date = normalizeDateInput(value)
  if (!date) return fallback

  const dateDisplayFormat = settings?.dateDisplayFormat || 'DD/MM/YYYY'
  if (dateDisplayFormat === 'DD-MM-YYYY') {
    return formatDateNumeric(date, settings, '-')
  }
  if (dateDisplayFormat === 'DD/MM/YYYY') {
    return formatDateNumeric(date, settings, '/')
  }
  const dateCalendar = settings?.dateCalendar || 'buddhist'
  const locale = dateCalendar === 'buddhist' ? 'th-TH-u-ca-buddhist' : 'th-TH'
  const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' }

  return new Intl.DateTimeFormat(locale, options).format(date)
}

export function formatAppDateTime(
  value?: string | Date | null,
  settings?: DateFormatSettings,
  fallback = '—',
): string {
  const date = normalizeDateInput(value)
  if (!date) return fallback

  const dateDisplayFormat = settings?.dateDisplayFormat || 'DD/MM/YYYY'
  if (dateDisplayFormat === 'DD-MM-YYYY') {
    return `${formatDateNumeric(date, settings, '-')} ${formatTimeHHmm(date)}`
  }
  if (dateDisplayFormat === 'DD/MM/YYYY') {
    return `${formatDateNumeric(date, settings, '/')} ${formatTimeHHmm(date)}`
  }
  const dateCalendar = settings?.dateCalendar || 'buddhist'
  const locale = dateCalendar === 'buddhist' ? 'th-TH-u-ca-buddhist' : 'th-TH'
  const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }

  return new Intl.DateTimeFormat(locale, options).format(date)
}

export function useAppDateFormatter() {
  const settings = useSettingsStore((state) => state.settings)
  return (value?: string | Date | null, fallback = '—') =>
    formatAppDate(value, settings, fallback)
}

export function useAppDateTimeFormatter() {
  const settings = useSettingsStore((state) => state.settings)
  return (value?: string | Date | null, fallback = '—') =>
    formatAppDateTime(value, settings, fallback)
}

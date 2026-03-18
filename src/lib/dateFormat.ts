import { useSettingsStore } from '@/app/core/storage/settingsStore'

type DateDisplayFormat = 'DD/MM/YYYY' | 'D MMMM YYYY'
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

export function formatAppDate(
  value?: string | Date | null,
  settings?: DateFormatSettings,
  fallback = '—',
): string {
  const date = normalizeDateInput(value)
  if (!date) return fallback

  const dateDisplayFormat = settings?.dateDisplayFormat || 'DD/MM/YYYY'
  const dateCalendar = settings?.dateCalendar || 'buddhist'
  const locale = dateCalendar === 'buddhist' ? 'th-TH-u-ca-buddhist' : 'th-TH'
  const options: Intl.DateTimeFormatOptions =
    dateDisplayFormat === 'D MMMM YYYY'
      ? { year: 'numeric', month: 'long', day: 'numeric' }
      : { year: 'numeric', month: '2-digit', day: '2-digit' }

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
  const dateCalendar = settings?.dateCalendar || 'buddhist'
  const locale = dateCalendar === 'buddhist' ? 'th-TH-u-ca-buddhist' : 'th-TH'
  const options: Intl.DateTimeFormatOptions =
    dateDisplayFormat === 'D MMMM YYYY'
      ? { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }
      : { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }

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

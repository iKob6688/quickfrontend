import type { Branding } from '@/app/core/types/branding'
import type { AnyDocumentDTO } from '@/app/core/types/dto'
import type { TemplateTheme } from '@/app/core/types/template'
import { useSettingsStore } from '@/app/core/storage/settingsStore'
import { formatAppDate } from '@/lib/dateFormat'

export type BlockViewContext = {
  branding: Branding
  dto: AnyDocumentDTO
  theme: TemplateTheme
}

export function formatTHB(n: number, currency: string = 'THB') {
  try {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n)
  } catch {
    return `${n.toFixed(2)} ${currency}`
  }
}

export function formatReportDate(value?: string | Date | null, fallback = '—') {
  const settings = useSettingsStore.getState().settings
  return formatAppDate(
    value,
    {
      dateDisplayFormat: 'DD-MM-YYYY',
      dateCalendar: settings.dateCalendar,
    },
    fallback,
  )
}


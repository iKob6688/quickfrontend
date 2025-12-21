import type { Branding } from '@/app/core/types/branding'
import type { AnyDocumentDTO } from '@/app/core/types/dto'
import type { TemplateTheme } from '@/app/core/types/template'

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



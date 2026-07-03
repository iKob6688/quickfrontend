import type { StudioSettings } from '@/app/core/storage/settingsStore'
import type { DocType } from '@/app/core/types/dto'

type DefaultTemplateMap = StudioSettings['defaultTemplateIdByDocType']

export const CHONLATEE_DEFAULT_TEMPLATE_OVERRIDES: Partial<DefaultTemplateMap> = {
  invoice: 'invoice_chonlatee_billing_v1',
  receipt_full: 'receipt_full_chonlatee_tax_invoice_v1',
}

function normalizeCompanyName(value?: string | null) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

export function isChonlateeCompany(companyName?: string | null) {
  const normalized = normalizeCompanyName(companyName)
  return normalized.includes('chonlatee innovation') || normalized.includes('ชลธี อินโนเวชั่น')
}

export function getCompanyTemplateDefaultsKey(params: {
  instancePublicId?: string | null
  companyName?: string | null
}) {
  if (params.instancePublicId) return `instance:${params.instancePublicId}`
  const normalizedName = normalizeCompanyName(params.companyName)
  return normalizedName ? `company:${normalizedName}` : null
}

export function resolveDefaultTemplateIdMap(
  settings: StudioSettings,
  params: {
    instancePublicId?: string | null
    companyName?: string | null
  } = {},
) {
  const baseMap = settings.defaultTemplateIdByDocType
  const companyKey = getCompanyTemplateDefaultsKey(params)
  const companyMap = companyKey ? settings.companyTemplateIdByCompanyKey?.[companyKey] : undefined

  return {
    ...baseMap,
    ...(isChonlateeCompany(params.companyName) ? CHONLATEE_DEFAULT_TEMPLATE_OVERRIDES : {}),
    ...(companyMap || {}),
  }
}

export function resolveDefaultTemplateId(
  settings: StudioSettings,
  docType: Exclude<DocType, 'trf_receipt'>,
  params: {
    instancePublicId?: string | null
    companyName?: string | null
  } = {},
) {
  return resolveDefaultTemplateIdMap(settings, params)[docType]
}

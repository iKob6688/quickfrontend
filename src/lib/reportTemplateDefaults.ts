import type { StudioSettings } from '@/app/core/storage/settingsStore'
import type { DocType } from '@/app/core/types/dto'

function normalizeCompanyName(value?: string | null) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
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

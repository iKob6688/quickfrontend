import { apiClient } from '@/api/client'
import { unwrapResponse, ApiError } from '@/api/response'
import { makeRpc } from '@/api/services/rpc'

export type PartnerCompanyType = 'company' | 'person'

export interface PartnerSummary {
  id: number
  name: string // display_name
  vat?: string
  phone?: string
  email?: string
  active: boolean
  companyType: PartnerCompanyType
}

export interface PartnerListParams {
  q?: string
  company_type?: PartnerCompanyType
  active?: boolean
  offset?: number
  limit?: number
}

export interface PartnerListResponse {
  items: PartnerSummary[]
  total: number
  offset: number
  limit: number
}

// Detail response per docs/api_contract.md (+ backend legacy aliases)
export interface PartnerDetail {
  id: number
  name: string
  displayName: string
  email?: string
  phone?: string
  mobile?: string
  vat?: string
  active: boolean
  companyType: PartnerCompanyType
  // legacy aliases returned by backend
  taxId?: string
  isCompany: boolean
  street?: string
  street2?: string
  city?: string
  zip?: string
  countryId?: number | null
  countryName?: string | null
}

export interface PartnerUpsertPayload {
  company_type: PartnerCompanyType
  name: string
  vat?: string
  phone?: string
  email?: string
  mobile?: string
  street?: string
  street2?: string
  city?: string
  zip?: string
  countryId?: number | null
  tags?: string[]
  payment_term_id?: number
  active?: boolean
}

// Per docs/api_contract.md: backend exposes partners under /api/th/v1/partners/*
const basePath = '/th/v1/partners'

/**
 * Backend response format (from Odoo) - List item
 * Backend may use different field names (isCompany, taxId, display_name, etc.)
 */
interface BackendPartnerSummary {
  id: number
  name?: string
  display_name?: string
  vat?: string
  taxId?: string // Backend alias
  phone?: string
  email?: string
  active?: boolean
  isCompany?: boolean // Backend field
  companyType?: PartnerCompanyType // Frontend field (may or may not exist)
  company_type?: PartnerCompanyType | 'company' | 'person' | boolean // Backend variant
  [key: string]: unknown // Allow additional fields
}

/**
 * Backend response format (from Odoo) - Full partner detail
 */
interface BackendPartnerDetail {
  id: number
  name?: string
  displayName?: string
  display_name?: string // Backend alias
  vat?: string
  taxId?: string // Backend alias
  phone?: string
  mobile?: string
  email?: string
  active?: boolean
  isCompany?: boolean // Backend field
  companyType?: PartnerCompanyType // Frontend field (may or may not exist)
  company_type?: PartnerCompanyType | 'company' | 'person' | boolean // Backend variant
  street?: string
  street2?: string
  city?: string
  zip?: string
  countryId?: number | null
  countryName?: string | null
  [key: string]: unknown // Allow additional fields
}

/**
 * Maps backend partner summary to frontend format
 */
function mapBackendPartnerSummaryToFrontend(backend: BackendPartnerSummary): PartnerSummary {
  // Map company type: backend may use isCompany (boolean) or company_type/companyType
  let companyType: PartnerCompanyType = 'person'
  if (backend.companyType) {
    companyType = backend.companyType
  } else if (backend.company_type === 'company' || backend.company_type === 'person') {
    companyType = backend.company_type
  } else if (backend.isCompany === true) {
    companyType = 'company'
  } else if (backend.isCompany === false) {
    companyType = 'person'
  }

  return {
    id: backend.id,
    name: backend.name || backend.display_name || '',
    vat: backend.vat || backend.taxId,
    phone: backend.phone,
    email: backend.email,
    active: backend.active ?? true,
    companyType,
  }
}

/**
 * Maps backend partner detail to frontend format
 */
function mapBackendPartnerDetailToFrontend(backend: BackendPartnerDetail): PartnerDetail {
  // Map company type
  let companyType: PartnerCompanyType = 'person'
  if (backend.companyType) {
    companyType = backend.companyType
  } else if (backend.company_type === 'company' || backend.company_type === 'person') {
    companyType = backend.company_type
  } else if (backend.isCompany === true) {
    companyType = 'company'
  } else if (backend.isCompany === false) {
    companyType = 'person'
  }

  const name = backend.name || backend.displayName || backend.display_name || ''
  const displayName = backend.displayName || backend.display_name || name

  return {
    id: backend.id,
    name,
    displayName,
    email: backend.email,
    phone: backend.phone,
    mobile: backend.mobile,
    vat: backend.vat || backend.taxId,
    active: backend.active ?? true,
    companyType,
    // Legacy aliases
    taxId: backend.taxId || backend.vat,
    isCompany: backend.isCompany ?? (companyType === 'company'),
    street: backend.street,
    street2: backend.street2,
    city: backend.city,
    zip: backend.zip,
    countryId: backend.countryId,
    countryName: backend.countryName,
  }
}

export async function listPartners(params: PartnerListParams) {
  try {
    const response = await apiClient.post(
      `${basePath}/list`,
      makeRpc({
        ...(params.q && { q: params.q }),
        ...(params.q && { search: params.q }), // alias support
        ...(params.active !== undefined && { active: params.active }),
        ...(params.company_type && { company_type: params.company_type }),
        ...(params.offset !== undefined && { offset: params.offset }),
        ...(params.limit !== undefined && { limit: params.limit }),
      }),
    )
    
    // Debug: Log raw response in development
    if (import.meta.env.DEV) {
      console.debug('[listPartners] Raw API response:', {
        url: response.config?.url,
        status: response.status,
        hasData: !!response.data,
        dataType: typeof response.data,
        rawData: response.data,
      })
    }

    // Backend might return array directly or PartnerListResponse
    const data = unwrapResponse<PartnerListResponse | BackendPartnerSummary[]>(response)
  
  // Debug: Log unwrapped data
  if (import.meta.env.DEV) {
    console.debug('[listPartners] Unwrapped data:', {
      isArray: Array.isArray(data),
      hasItems: !Array.isArray(data) && 'items' in data,
      arrayLength: Array.isArray(data) ? data.length : 'N/A',
      firstItem: Array.isArray(data) && data.length > 0 ? data[0] : (!Array.isArray(data) && 'items' in data && Array.isArray(data.items) && data.items.length > 0 ? data.items[0] : null),
    })
  }

    // If it's an array, convert to PartnerListResponse format with mapping
    if (Array.isArray(data)) {
      const mappedItems = data
        .filter((item): item is BackendPartnerSummary => 
          item != null && typeof item === 'object' && 'id' in item
        )
        .map(mapBackendPartnerSummaryToFrontend)
        .filter((item): item is PartnerSummary => 
          item != null && typeof item === 'object' && 'id' in item && 'name' in item
        )

      // Debug: Log mapped items
      if (import.meta.env.DEV) {
        console.debug('[listPartners] Mapped items:', {
          originalCount: data.length,
          mappedCount: mappedItems.length,
          requestedLimit: params.limit,
          sampleItem: mappedItems[0] || null,
        })
      }

      // If we got fewer items than requested limit, this is the last page
      // Otherwise, we don't know the total, so we'll set total to at least offset + items.length + 1
      // to allow pagination to continue (will be updated when we reach the last page)
      const requestedLimit = params.limit || 50
      const isLastPage = mappedItems.length < requestedLimit
      const currentOffset = params.offset || 0
      const loadedCount = currentOffset + mappedItems.length
      
      return {
        items: mappedItems,
        // If this is the last page, total = offset + items.length (actual total)
        // Otherwise, set total to loadedCount + 1 to allow pagination to continue
        total: isLastPage ? loadedCount : loadedCount + 1,
        offset: currentOffset,
        limit: requestedLimit,
      }
    }
  
  // If it's PartnerListResponse, map the items
  if (data && typeof data === 'object' && 'items' in data && Array.isArray(data.items)) {
    const mappedItems = data.items
      .filter((item): item is BackendPartnerSummary => 
        item != null && typeof item === 'object' && 'id' in item
      )
      .map(mapBackendPartnerSummaryToFrontend)

    // Debug: Log mapped items
    if (import.meta.env.DEV) {
      console.debug('[listPartners] Mapped PartnerListResponse items:', {
        originalCount: data.items.length,
        mappedCount: mappedItems.length,
        sampleItem: mappedItems[0] || null,
      })
    }

    return {
      items: mappedItems,
      total: data.total ?? mappedItems.length,
      offset: data.offset ?? (params.offset || 0),
      limit: data.limit ?? (params.limit || mappedItems.length),
    }
  }
  
    // Fallback: return as-is (should not happen)
    console.warn('[listPartners] Unexpected response format:', data)
    return {
      items: [],
      total: 0,
      offset: params.offset || 0,
      limit: params.limit || 0,
    }
  } catch (error) {
    // Log error for debugging
    console.error('[listPartners] API error:', error)
    
    // Enhance error message with more context
    if (error instanceof Error) {
      const enhancedError = new Error(
        `ไม่สามารถโหลดรายชื่อติดต่อได้: ${error.message}. ` +
        `ตรวจสอบว่า API endpoint /api/th/v1/partners/list มีอยู่และทำงานได้`
      )
      enhancedError.name = error.name
      enhancedError.stack = error.stack
      throw enhancedError
    }
    
    // Re-throw to let react-query handle it
    throw error
  }
}

export async function getPartner(id: number) {
  try {
    const response = await apiClient.post(`${basePath}/${id}`, makeRpc({}))

    // Debug: Log raw response in development
    if (import.meta.env.DEV) {
      console.debug('[getPartner] Raw API response:', {
        id,
        url: response.config?.url,
        status: response.status,
        hasData: !!response.data,
        dataType: typeof response.data,
        rawData: response.data,
      })
    }

    const data = unwrapResponse<BackendPartnerDetail>(response)

    // Debug: Log unwrapped data
    if (import.meta.env.DEV) {
      console.debug('[getPartner] Unwrapped data:', {
        id,
        hasId: 'id' in data,
        hasName: 'name' in data || 'display_name' in data || 'displayName' in data,
        hasIsCompany: 'isCompany' in data,
        hasCompanyType: 'companyType' in data || 'company_type' in data,
        rawData: data,
      })
    }

    const mapped = mapBackendPartnerDetailToFrontend(data)

    // Debug: Log mapped data
    if (import.meta.env.DEV) {
      console.debug('[getPartner] Mapped partner:', {
        id,
        mapped,
      })
    }

    return mapped
  } catch (error) {
    // Log error for debugging
    console.error('[getPartner] API error:', error)
    
    // Re-throw to let react-query handle it
    throw error
  }
}

export async function createPartner(payload: PartnerUpsertPayload) {
  const response = await apiClient.post(
    `${basePath}/create`,
    makeRpc({
      company_type: payload.company_type,
      name: payload.name,
      vat: payload.vat,
      phone: payload.phone,
      mobile: payload.mobile,
      email: payload.email,
      street: payload.street,
      street2: payload.street2,
      city: payload.city,
      zip: payload.zip,
      countryId: payload.countryId,
      tags: payload.tags,
      payment_term_id: payload.payment_term_id,
      ...(payload.active !== undefined ? { active: payload.active } : {}),
    }),
  )
  return unwrapResponse<PartnerDetail>(response)
}

export async function updatePartner(id: number, payload: PartnerUpsertPayload) {
  const response = await apiClient.post(
    `${basePath}/${id}/update`,
    makeRpc({
      company_type: payload.company_type,
      name: payload.name,
      vat: payload.vat,
      phone: payload.phone,
      mobile: payload.mobile,
      email: payload.email,
      street: payload.street,
      street2: payload.street2,
      city: payload.city,
      zip: payload.zip,
      countryId: payload.countryId,
      tags: payload.tags,
      payment_term_id: payload.payment_term_id,
      ...(payload.active !== undefined ? { active: payload.active } : {}),
    }),
  )
  return unwrapResponse<PartnerDetail>(response)
}

export async function archivePartner(id: number) {
  const response = await apiClient.post(
    `${basePath}/${id}/update`,
    makeRpc({ active: false }),
  )
  return unwrapResponse<PartnerDetail>(response)
}

export async function unarchivePartner(id: number) {
  const response = await apiClient.post(
    `${basePath}/${id}/update`,
    makeRpc({ active: true }),
  )
  return unwrapResponse<PartnerDetail>(response)
}

export async function setPartnerActive(id: number, active: boolean) {
  const response = await apiClient.post(
    `${basePath}/${id}/update`,
    makeRpc({ active }),
  )
  return unwrapResponse<PartnerDetail>(response)
}

export async function setPartnersActive(ids: number[], active: boolean) {
  // Avoid firing unbounded concurrent requests.
  const pageSize = 25
  const ok: number[] = []
  const failed: Array<{ id: number; message: string }> = []

  for (let i = 0; i < ids.length; i += pageSize) {
    const chunk = ids.slice(i, i + pageSize)
    const settled = await Promise.allSettled(chunk.map((id) => setPartnerActive(id, active)))
    settled.forEach((r, idx) => {
      const id = chunk[idx]
      if (r.status === 'fulfilled') ok.push(id)
      else failed.push({ id, message: r.reason instanceof Error ? r.reason.message : 'Unknown error' })
    })
  }

  return { ok, failed }
}

export interface PartnerQuery {
  q?: string
  active?: boolean
  company_type?: PartnerCompanyType
}

/**
 * Bulk update "all matching results" by paging through /partners/list.
 * This is v1-safe even without a backend bulk endpoint.
 */
export async function setPartnersActiveByQuery(
  query: PartnerQuery,
  active: boolean,
  options?: { excludeIds?: number[]; pageSize?: number; maxItems?: number },
) {
  const exclude = new Set(options?.excludeIds ?? [])
  const pageSize = options?.pageSize ?? 200
  const maxItems = options?.maxItems ?? 5000

  const ids: number[] = []
  let offset = 0
  let total = 0

  while (true) {
    const res = await listPartners({
      ...query,
      limit: pageSize,
      offset,
    })
    total = res.total
    const pageIds = res.items.map((p) => p.id).filter((id) => !exclude.has(id))
    ids.push(...pageIds)

    offset += res.items.length
    if (res.items.length === 0) break
    if (offset >= res.total) break
    if (ids.length >= maxItems) break
  }

  const processedIds = ids.slice(0, maxItems)
  const { ok, failed } = await setPartnersActive(processedIds, active)
  return {
    totalMatched: total,
    processed: processedIds.length,
    ok,
    failed,
    truncated: total > maxItems,
  }
}



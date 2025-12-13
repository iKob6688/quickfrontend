import { apiClient } from '@/api/client'
import { unwrapResponse } from '@/api/response'
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

export async function listPartners(params: PartnerListParams) {
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
  return unwrapResponse<PartnerListResponse>(response)
}

export async function getPartner(id: number) {
  const response = await apiClient.post(`${basePath}/${id}`, makeRpc({}))
  return unwrapResponse<PartnerDetail>(response)
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



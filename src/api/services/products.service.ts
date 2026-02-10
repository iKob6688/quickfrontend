import { apiClient } from '@/api/client'
import { unwrapResponse } from '@/api/response'
import { makeRpc } from '@/api/services/rpc'

export interface ProductSummary {
  id: number
  name: string
  defaultCode?: string
  uomId?: number | null
  uomName?: string | null
  listPrice?: number | null
  price?: number | null
  active?: boolean
}

export interface ProductDetail extends ProductSummary {
  description?: string | null
}

export interface ProductListParams {
  q?: string
  search?: string
  sale_ok?: boolean
  active?: boolean
  limit?: number
  offset?: number
}

export interface ProductListResponse {
  items: ProductSummary[]
  total: number
  offset: number
  limit: number
}

const basePath = '/th/v1/products'

interface BackendProductSummary {
  id: number
  name?: string
  display_name?: string
  defaultCode?: string
  default_code?: string
  uomId?: number | null
  uomName?: string | null
  price?: number | string | null
  listPrice?: number | string | null
  list_price?: number | string | null
  active?: boolean
}

function toNumberOrNull(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function mapProductSummary(raw: BackendProductSummary): ProductSummary {
  const listPrice = toNumberOrNull(raw.listPrice ?? raw.list_price ?? raw.price)
  return {
    id: raw.id,
    name: raw.name || raw.display_name || '',
    defaultCode: raw.defaultCode || raw.default_code,
    uomId: raw.uomId ?? null,
    uomName: raw.uomName ?? null,
    listPrice,
    price: toNumberOrNull(raw.price),
    active: raw.active,
  }
}

export async function listProducts(params?: ProductListParams) {
  const q = params?.q ?? params?.search
  const response = await apiClient.post(
    `${basePath}/list`,
    makeRpc({
      ...(q ? { q, search: q } : {}),
      ...(params?.sale_ok !== undefined ? { sale_ok: params.sale_ok } : {}),
      ...(params?.active !== undefined ? { active: params.active } : {}),
      ...(params?.limit !== undefined ? { limit: params.limit } : {}),
      ...(params?.offset !== undefined ? { offset: params.offset } : {}),
    }),
  )
  const data = unwrapResponse<{ items?: BackendProductSummary[]; total?: number; offset?: number; limit?: number }>(response)
  const items = Array.isArray(data?.items) ? data.items.map(mapProductSummary) : []
  return {
    items,
    total: typeof data?.total === 'number' ? data.total : items.length,
    offset: typeof data?.offset === 'number' ? data.offset : params?.offset || 0,
    limit: typeof data?.limit === 'number' ? data.limit : params?.limit || items.length,
  }
}

export async function getProduct(id: number) {
  const response = await apiClient.post(`${basePath}/${id}`, makeRpc({}))
  const data = unwrapResponse<BackendProductSummary & { description?: string | null }>(response)
  const mapped = mapProductSummary(data)
  return {
    ...mapped,
    description: data?.description ?? null,
  }
}

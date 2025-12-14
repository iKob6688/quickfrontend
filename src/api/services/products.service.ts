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
  active?: boolean
}

export interface ProductDetail extends ProductSummary {
  description?: string | null
}

export interface ProductListParams {
  q?: string
  search?: string
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

export async function listProducts(params?: ProductListParams) {
  const q = params?.q ?? params?.search
  const response = await apiClient.post(
    `${basePath}/list`,
    makeRpc({
      ...(q ? { q, search: q } : {}),
      ...(params?.active !== undefined ? { active: params.active } : {}),
      ...(params?.limit !== undefined ? { limit: params.limit } : {}),
      ...(params?.offset !== undefined ? { offset: params.offset } : {}),
    }),
  )
  return unwrapResponse<ProductListResponse>(response)
}

export async function getProduct(id: number) {
  const response = await apiClient.post(`${basePath}/${id}`, makeRpc({}))
  return unwrapResponse<ProductDetail>(response)
}



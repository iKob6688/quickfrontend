import { apiClient } from '@/api/client'
import { unwrapResponse } from '@/api/response'
import { makeRpc } from '@/api/services/rpc'

export interface ProductSummary {
  id: number
  name: string
  defaultCode?: string
  barcode?: string
  image128?: string | null
  imageUrl?: string | null
  qtyAvailable?: number | null
  virtualAvailable?: number | null
  uomId?: number | null
  uomName?: string | null
  listPrice?: number | null
  price?: number | null
  active?: boolean
}

export interface ProductDetail extends ProductSummary {
  description?: string | null
  saleOk?: boolean
  purchaseOk?: boolean
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

export interface ProductUpsertPayload {
  name: string
  defaultCode?: string
  barcode?: string
  listPrice?: number | null
  saleOk?: boolean
  purchaseOk?: boolean
  active?: boolean
  description?: string | null
}

const basePath = '/th/v1/products'

interface BackendProductSummary {
  id: number
  name?: string
  display_name?: string
  defaultCode?: string
  default_code?: string
  barcode?: string
  image128?: string | null
  image_128?: string | null
  imageUrl?: string | null
  image_url?: string | null
  qty_available?: number | string | null
  qtyAvailable?: number | string | null
  virtual_available?: number | string | null
  virtualAvailable?: number | string | null
  uomId?: number | null
  uomName?: string | null
  price?: number | string | null
  listPrice?: number | string | null
  list_price?: number | string | null
  active?: boolean
  saleOk?: boolean
  sale_ok?: boolean
  purchaseOk?: boolean
  purchase_ok?: boolean
  description?: string | null
  description_sale?: string | null
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
    barcode: raw.barcode || undefined,
    image128: raw.image128 ?? raw.image_128 ?? null,
    imageUrl: raw.imageUrl ?? raw.image_url ?? null,
    qtyAvailable: toNumberOrNull(raw.qtyAvailable ?? raw.qty_available),
    virtualAvailable: toNumberOrNull(raw.virtualAvailable ?? raw.virtual_available),
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
    saleOk: Boolean(data?.saleOk ?? data?.sale_ok ?? true),
    purchaseOk: Boolean(data?.purchaseOk ?? data?.purchase_ok ?? false),
  }
}

export async function createProduct(payload: ProductUpsertPayload) {
  const response = await apiClient.post(
    `${basePath}`,
    makeRpc({
      name: payload.name,
      defaultCode: payload.defaultCode,
      barcode: payload.barcode,
      listPrice: payload.listPrice,
      saleOk: payload.saleOk,
      purchaseOk: payload.purchaseOk,
      active: payload.active,
      description: payload.description,
    }),
  )
  const data = unwrapResponse<BackendProductSummary>(response)
  return mapProductSummary(data)
}

export async function updateProduct(id: number, payload: Partial<ProductUpsertPayload>) {
  const response = await apiClient.put(
    `${basePath}/${id}`,
    makeRpc({
      name: payload.name,
      defaultCode: payload.defaultCode,
      barcode: payload.barcode,
      listPrice: payload.listPrice,
      saleOk: payload.saleOk,
      purchaseOk: payload.purchaseOk,
      active: payload.active,
      description: payload.description,
    }),
  )
  const data = unwrapResponse<BackendProductSummary>(response)
  return mapProductSummary(data)
}

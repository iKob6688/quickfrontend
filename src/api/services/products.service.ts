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
  productType?: 'consu' | 'service' | 'product' | string
  categoryId?: number | null
  categoryName?: string | null
  incomeAccountId?: number | null
  incomeAccountCode?: string | null
  incomeAccountName?: string | null
  expenseAccountId?: number | null
  expenseAccountCode?: string | null
  expenseAccountName?: string | null
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
  productType?: 'consu' | 'service' | 'product' | string
  categoryId?: number | null
  incomeAccountId?: number | null
  expenseAccountId?: number | null
}

export interface ProductAdminMetaResponse {
  permissions: { canManageAdminFields: boolean }
  productTypes: Array<{ id: string; name: string }>
  categories: Array<{ id: number; name: string }>
  accounts: Array<{ id: number; code: string; name: string; displayName?: string; accountType?: string | null }>
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
    productType: String((data as any)?.productType ?? (data as any)?.product_type ?? 'consu'),
    categoryId: toNumberOrNull((data as any)?.categoryId ?? (data as any)?.category_id),
    categoryName: ((data as any)?.categoryName ?? (data as any)?.category_name ?? null) as string | null,
    incomeAccountId: toNumberOrNull((data as any)?.incomeAccountId ?? (data as any)?.income_account_id),
    incomeAccountCode: ((data as any)?.incomeAccountCode ?? (data as any)?.income_account_code ?? null) as string | null,
    incomeAccountName: ((data as any)?.incomeAccountName ?? (data as any)?.income_account_name ?? null) as string | null,
    expenseAccountId: toNumberOrNull((data as any)?.expenseAccountId ?? (data as any)?.expense_account_id),
    expenseAccountCode: ((data as any)?.expenseAccountCode ?? (data as any)?.expense_account_code ?? null) as string | null,
    expenseAccountName: ((data as any)?.expenseAccountName ?? (data as any)?.expense_account_name ?? null) as string | null,
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
      productType: payload.productType,
      categoryId: payload.categoryId,
      incomeAccountId: payload.incomeAccountId,
      expenseAccountId: payload.expenseAccountId,
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
      productType: payload.productType,
      categoryId: payload.categoryId,
      incomeAccountId: payload.incomeAccountId,
      expenseAccountId: payload.expenseAccountId,
    }),
  )
  const data = unwrapResponse<BackendProductSummary>(response)
  return mapProductSummary(data)
}

export async function getProductAdminMeta() {
  const response = await apiClient.post(`${basePath}/admin/meta`, makeRpc({}))
  return unwrapResponse<ProductAdminMetaResponse>(response)
}

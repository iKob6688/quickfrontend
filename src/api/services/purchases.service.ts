import { apiClient } from '@/api/client'
import { unwrapResponse } from '@/api/response'
import { makeRpc } from '@/api/services/rpc'

export interface PurchaseOrderLine {
  productId: number | null
  description: string
  quantity: number
  unitPrice: number
  taxIds: number[] // Array of tax IDs
  subtotal: number // Calculated by Odoo
  totalTax: number // Calculated by Odoo
  total: number // Calculated by Odoo
}

export interface PurchaseOrderPayload {
  id?: number
  vendorId: number
  orderDate: string // ISO 8601
  expectedDate?: string // ISO 8601
  currency: string
  lines: PurchaseOrderLine[]
  notes?: string
}

export interface PurchaseOrder extends PurchaseOrderPayload {
  id: number
  number?: string
  vendorName?: string
  status: 'draft' | 'sent' | 'to_approve' | 'purchase' | 'done' | 'cancel'
  amountUntaxed: number
  totalTax: number
  total: number
  createdAt: string // ISO 8601
  updatedAt: string // ISO 8601
}

export interface PurchaseOrderListItem {
  id: number
  number: string
  vendorName: string
  vendorId: number
  orderDate: string // ISO 8601
  expectedDate?: string // ISO 8601
  total: number
  status: 'draft' | 'sent' | 'to_approve' | 'purchase' | 'done' | 'cancel'
  currency: string
}

export interface ListPurchaseOrdersParams {
  status?: 'draft' | 'sent' | 'to_approve' | 'purchase' | 'done' | 'cancel'
  vendorId?: number
  search?: string
  dateFrom?: string // ISO 8601
  dateTo?: string // ISO 8601
  limit?: number
  offset?: number
}

// NOTE: backend reality (adt_th_api): purchase orders are exposed under /api/th/v1/purchases/orders/*
const basePath = '/th/v1/purchases/orders'

/**
 * Backend response format (from Odoo) - List item
 */
interface BackendPurchaseOrderListItem {
  id: number
  name?: string
  documentNumber?: string
  vendor?: {
    id: number
    name: string
    vat?: string
  }
  date_order?: string
  date_planned?: string
  state?: string
  amount_total?: number
  amount_untaxed?: number
  amount_tax?: number
  currency?: string
  [key: string]: unknown // Allow additional fields
}

/**
 * Backend response format (from Odoo) - Full order detail
 */
interface BackendPurchaseOrder {
  id: number
  name?: string
  documentNumber?: string
  vendor?: {
    id: number
    name: string
    vat?: string
  } | number // Can be ID or object
  vendorId?: number
  date_order?: string
  date_planned?: string
  state?: string
  amount_total?: number
  amount_untaxed?: number
  amount_tax?: number
  currency?: string
  notes?: string | null
  lines?: Array<{
    id?: number
    product_id?: number | null
    productId?: number | null
    description?: string
    name?: string
    quantity?: number
    price_unit?: number
    unitPrice?: number
    tax_ids?: number[]
    taxIds?: number[]
    price_subtotal?: number
    subtotal?: number
    price_tax?: number
    totalTax?: number
    price_total?: number
    total?: number
    [key: string]: unknown
  }>
  [key: string]: unknown // Allow additional fields
}

/**
 * Maps backend response format to frontend format
 */
function mapBackendToFrontend(backend: BackendPurchaseOrderListItem): PurchaseOrderListItem {
  // Map state to status (Odoo state → frontend status)
  const stateMap: Record<string, PurchaseOrderListItem['status']> = {
    draft: 'draft',
    sent: 'sent',
    'to approve': 'to_approve',
    'to_approve': 'to_approve',
    purchase: 'purchase',
    done: 'done',
    cancel: 'cancel',
    cancelled: 'cancel',
  }

  const state = (backend.state || '').toLowerCase().trim()
  const status = stateMap[state] || 'draft'

  // Extract vendor info (handle both object and direct field cases)
  let vendorName = ''
  let vendorId = 0

  if (backend.vendor) {
    if (typeof backend.vendor === 'object' && 'name' in backend.vendor) {
      vendorName = backend.vendor.name || ''
      vendorId = typeof backend.vendor.id === 'number' ? backend.vendor.id : 0
    } else if (typeof backend.vendor === 'string') {
      vendorName = backend.vendor
    }
  }

  // Fallback: if vendor info not found, try other fields
  if (!vendorName) {
    vendorName = backend.name || ''
  }

  // Extract document number (prefer documentNumber, fallback to name if it looks like a PO number)
  let number = ''
  if (backend.documentNumber) {
    number = String(backend.documentNumber)
  } else if (backend.name) {
    // If name looks like a document number (starts with P or PO), use it
    const nameStr = String(backend.name)
    if (nameStr.match(/^(P|PO)\d+/i)) {
      number = nameStr
    } else {
      // Name might be vendor name, don't use it as document number
      number = ''
    }
  }

  // Extract dates (ensure ISO 8601 format)
  const orderDate = backend.date_order ? String(backend.date_order) : ''
  const expectedDate = backend.date_planned ? String(backend.date_planned) : undefined

  // Extract amounts (default to 0 if missing)
  const total =
    typeof backend.amount_total === 'number'
      ? backend.amount_total
      : typeof backend.amount_total === 'string'
        ? parseFloat(backend.amount_total) || 0
        : 0

  // Extract currency (default to THB)
  const currency = backend.currency ? String(backend.currency) : 'THB'

  return {
    id: backend.id,
    number,
    vendorName: vendorName || '—',
    vendorId,
    orderDate,
    expectedDate,
    total,
    status,
    currency,
  }
}

export async function listPurchaseOrders(params?: ListPurchaseOrdersParams) {
  const body = makeRpc({
    ...(params?.status && { status: params.status }),
    ...(params?.vendorId && { vendor_id: params.vendorId }),
    ...(params?.search && { search: params.search }),
    ...(params?.limit && { limit: params.limit }),
    ...(params?.offset && { offset: params.offset }),
    ...(params?.dateFrom && { date_from: params.dateFrom }),
    ...(params?.dateTo && { date_to: params.dateTo }),
  })
  
  try {
    const response = await apiClient.post(`${basePath}/list`, body)
    
    // Debug: Log raw response for troubleshooting
    if (import.meta.env.DEV) {
      console.debug('[purchases.service] Raw API response:', {
        status: response.status,
        data: response.data,
        dataType: typeof response.data,
        hasJsonrpc: response.data && typeof response.data === 'object' && 'jsonrpc' in response.data,
        hasResult: response.data && typeof response.data === 'object' && 'result' in response.data,
      })
    }
    
    // Unwrap response - backend returns BackendPurchaseOrderListItem[]
    const backendData = unwrapResponse<BackendPurchaseOrderListItem[]>(response)
    
    // Debug: Log unwrapped backend data
    if (import.meta.env.DEV) {
      console.debug('[purchases.service] Unwrapped backend data:', {
        isArray: Array.isArray(backendData),
        length: Array.isArray(backendData) ? backendData.length : 'N/A',
        firstItem: Array.isArray(backendData) && backendData.length > 0 ? backendData[0] : null,
      })
    }
    
    // Ensure we always return an array, even if backend returns null/undefined
    if (!Array.isArray(backendData)) {
      console.warn('[purchases.service] API returned non-array response:', backendData)
      return []
    }
    
    // Map backend format to frontend format
    const mappedData = backendData.map((item) => {
      try {
        return mapBackendToFrontend(item)
      } catch (error) {
        console.error('[purchases.service] Error mapping item:', item, error)
        // Return a minimal valid item to prevent crashes
        return {
          id: item?.id || 0,
          number: item?.documentNumber || item?.name || '',
          vendorName: item?.vendor?.name || item?.name || '—',
          vendorId: item?.vendor?.id || 0,
          orderDate: item?.date_order || '',
          expectedDate: item?.date_planned,
          total: typeof item?.amount_total === 'number' ? item.amount_total : 0,
          status: 'draft',
          currency: item?.currency || 'THB',
        }
      }
    })
    
    // Debug: Log mapped data
    if (import.meta.env.DEV) {
      console.debug('[purchases.service] Mapped frontend data:', {
        length: mappedData.length,
        firstItem: mappedData.length > 0 ? mappedData[0] : null,
      })
    }
    
    // Validate mapped data
    const invalidItems = mappedData.filter(
      (item) => !item || typeof item.id !== 'number'
    )
    if (invalidItems.length > 0) {
      console.warn('[purchases.service] Found invalid mapped items:', invalidItems)
    }
    
    return mappedData
  } catch (error) {
    console.error('[purchases.service] Error fetching purchase orders:', error)
    throw error
  }
}

/**
 * Maps backend full order format to frontend format
 */
function mapBackendOrderToFrontend(backend: BackendPurchaseOrder): PurchaseOrder {
  // Map state to status
  const stateMap: Record<string, PurchaseOrder['status']> = {
    draft: 'draft',
    sent: 'sent',
    'to approve': 'to_approve',
    'to_approve': 'to_approve',
    purchase: 'purchase',
    done: 'done',
    cancel: 'cancel',
    cancelled: 'cancel',
  }

  const state = (backend.state || '').toLowerCase().trim()
  const status = stateMap[state] || 'draft'

  // Extract vendor info
  let vendorName = ''
  let vendorId = 0

  if (backend.vendor) {
    if (typeof backend.vendor === 'object' && 'name' in backend.vendor) {
      vendorName = backend.vendor.name || ''
      vendorId = typeof backend.vendor.id === 'number' ? backend.vendor.id : 0
    } else if (typeof backend.vendor === 'number') {
      vendorId = backend.vendor
    }
  }

  if (backend.vendorId) {
    vendorId = backend.vendorId
  }

  // Extract document number
  const number = backend.documentNumber || backend.name || ''

  // Extract dates
  const orderDate = backend.date_order ? String(backend.date_order) : ''
  const expectedDate = backend.date_planned ? String(backend.date_planned) : undefined

  // Extract amounts
  const amountUntaxed = typeof backend.amount_untaxed === 'number' ? backend.amount_untaxed : 0
  const totalTax = typeof backend.amount_tax === 'number' ? backend.amount_tax : 0
  const total = typeof backend.amount_total === 'number' ? backend.amount_total : 0

  // Extract currency
  const currency = backend.currency ? String(backend.currency) : 'THB'

  // Map lines
  const lines: PurchaseOrderLine[] = (backend.lines || []).map((line) => ({
    productId: line.productId ?? line.product_id ?? null,
    description: line.description ?? line.name ?? '',
    quantity: line.quantity ?? 0,
    unitPrice: line.unitPrice ?? line.price_unit ?? 0,
    taxIds: line.taxIds ?? line.tax_ids ?? [],
    subtotal: line.subtotal ?? line.price_subtotal ?? 0,
    totalTax: line.totalTax ?? line.price_tax ?? 0,
    total: line.total ?? line.price_total ?? 0,
  }))

  return {
    id: backend.id,
    number,
    vendorName: vendorName || '—',
    vendorId,
    orderDate,
    expectedDate,
    currency,
    status,
    amountUntaxed,
    totalTax,
    total,
    lines,
    notes: backend.notes || undefined,
    createdAt: orderDate, // Use orderDate as fallback
    updatedAt: orderDate, // Use orderDate as fallback
  }
}

export async function getPurchaseOrder(id: number) {
  const body = makeRpc({ id })
  const response = await apiClient.post(`${basePath}/${id}`, body)
  
  // Backend might return { order: {...} } or direct object or JSON-RPC wrapped
  // Handle different response formats
  let backendData: BackendPurchaseOrder

  try {
    // Try unwrapResponse first (for JSON-RPC format)
    const unwrapped = unwrapResponse<BackendPurchaseOrder | { order: BackendPurchaseOrder }>(response)
    
    // Check if response is wrapped in { order: {...} }
    if (unwrapped && typeof unwrapped === 'object' && 'order' in unwrapped) {
      backendData = unwrapped.order as BackendPurchaseOrder
    } else {
      backendData = unwrapped as BackendPurchaseOrder
    }
  } catch (error) {
    // If unwrapResponse fails (not JSON-RPC format), try direct access
    const rawData = response.data as any
    
    // Check if it's wrapped in { order: {...} }
    if (rawData && typeof rawData === 'object' && 'order' in rawData) {
      backendData = rawData.order as BackendPurchaseOrder
    } else if (rawData && typeof rawData === 'object' && 'jsonrpc' in rawData && rawData.result) {
      // Handle JSON-RPC but unwrapResponse failed
      const result = rawData.result
      if (result && typeof result === 'object' && 'order' in result) {
        backendData = result.order as BackendPurchaseOrder
      } else if (result && typeof result === 'object' && 'data' in result && result.data) {
        const data = result.data
        backendData = (data.order || data) as BackendPurchaseOrder
      } else {
        backendData = result as BackendPurchaseOrder
      }
    } else {
      backendData = rawData as BackendPurchaseOrder
    }
  }

  if (!backendData || typeof backendData !== 'object' || !backendData.id) {
    throw new Error('Invalid purchase order response format')
  }

  // Map backend format to frontend format
  return mapBackendOrderToFrontend(backendData)
}

export async function createPurchaseOrder(payload: PurchaseOrderPayload) {
  const body = makeRpc(payload)
  const response = await apiClient.post(basePath, body)
  return unwrapResponse<PurchaseOrder>(response)
}

export async function updatePurchaseOrder(id: number, payload: PurchaseOrderPayload) {
  const body = makeRpc({ id, ...payload })
  const response = await apiClient.put(`${basePath}/${id}`, body)
  return unwrapResponse<PurchaseOrder>(response)
}

export async function confirmPurchaseOrder(id: number) {
  const body = makeRpc({ id })
  const response = await apiClient.post(`${basePath}/${id}/confirm`, body)
  return unwrapResponse<PurchaseOrder>(response)
}

export async function cancelPurchaseOrder(id: number, reason?: string) {
  const body = makeRpc({ id, ...(reason && { reason }) })
  const response = await apiClient.post(`${basePath}/${id}/cancel`, body)
  return unwrapResponse<PurchaseOrder>(response)
}


import { apiClient } from '@/api/client'
import { unwrapResponse } from '@/api/response'

export interface InvoiceLine {
  productId: number
  description: string
  quantity: number
  unitPrice: number
  taxRate: number
  subtotal: number // Calculated by Odoo (quantity * unitPrice, after discount, before tax)
}

export interface InvoicePayload {
  id?: number
  customerId: number
  invoiceDate: string
  dueDate: string
  currency: string
  lines: InvoiceLine[]
  notes?: string
}

export interface Invoice extends InvoicePayload {
  id: number
  status: 'draft' | 'posted' | 'paid' | 'cancelled'
  amountUntaxed: number // Total before tax (calculated by Odoo)
  total: number // Total including tax (calculated by Odoo)
  totalTax: number // Total tax amount (calculated by Odoo)
  createdAt: string
  updatedAt: string
  number?: string // Invoice number/name from Odoo
  customerName?: string // Customer display name
}

export interface InvoiceListItem {
  id: number
  number: string
  customerName: string
  customerId: number
  invoiceDate: string
  dueDate: string
  total: number
  status: 'draft' | 'posted' | 'paid' | 'cancelled'
  currency: string
}

export interface ListInvoicesParams {
  status?: 'draft' | 'posted' | 'paid' | 'cancelled'
  search?: string
  limit?: number
  offset?: number
  dateFrom?: string
  dateTo?: string
}

// NOTE: axios baseURL is VITE_API_BASE_URL (= '/api'), so endpoint paths here must NOT start with '/api'
const basePath = '/th/v1/sales/invoices'

/**
 * Gets Odoo database name from environment variable
 */
function getOdooDb(): string | undefined {
  const db = import.meta.env.VITE_ODOO_DB
  return db && typeof db === 'string' && db.trim() ? db.trim() : undefined
}

/**
 * Creates a JSON-RPC 2.0 request body for Odoo endpoints
 * Automatically includes db from VITE_ODOO_DB if available
 */
function makeRpc(params: Record<string, unknown>) {
  const db = getOdooDb()
  return {
    jsonrpc: '2.0' as const,
    method: 'call' as const,
    params: {
      ...params,
      ...(db ? { db } : {}),
    },
  }
}

/**
 * List invoices with optional filters
 */
export async function listInvoices(params?: ListInvoicesParams) {
  const body = makeRpc({
    ...(params?.status && { status: params.status }),
    ...(params?.search && { search: params.search }),
    ...(params?.limit && { limit: params.limit }),
    ...(params?.offset && { offset: params.offset }),
    ...(params?.dateFrom && { date_from: params.dateFrom }),
    ...(params?.dateTo && { dateTo: params.dateTo }),
  })
  const response = await apiClient.post(`${basePath}/list`, body)
  return unwrapResponse<InvoiceListItem[]>(response)
}

/**
 * Get invoice detail by ID
 */
export async function getInvoice(id: number) {
  const body = makeRpc({ id })
  const response = await apiClient.post(`${basePath}/${id}`, body)
  return unwrapResponse<Invoice>(response)
}

/**
 * Create a new invoice
 */
export async function createInvoice(payload: InvoicePayload) {
  const body = makeRpc(payload)
  const response = await apiClient.post(basePath, body)
  return unwrapResponse<Invoice>(response)
}

export async function updateInvoice(id: number, payload: InvoicePayload) {
  const body = makeRpc({ id, ...payload })
  const response = await apiClient.put(`${basePath}/${id}`, body)
  return unwrapResponse<Invoice>(response)
}

export async function postInvoice(id: number) {
  const body = makeRpc({ id })
  const response = await apiClient.post(`${basePath}/${id}/post`, body)
  return unwrapResponse<Invoice>(response)
}

export interface RegisterPaymentPayload {
  amount: number
  date: string
  method: string
  reference?: string
}

export async function registerPayment(
  id: number,
  payload: RegisterPaymentPayload,
) {
  const body = makeRpc({ id, ...payload })
  const response = await apiClient.post(`${basePath}/${id}/register-payment`, body)
  return unwrapResponse<Invoice>(response)
}



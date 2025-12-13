import { apiClient } from '@/api/client'
import { unwrapResponse } from '@/api/response'
import { makeRpc } from '@/api/services/rpc'

export interface InvoiceLine {
  // v1 backend supports null product
  productId: number | null
  description: string
  quantity: number
  unitPrice: number
  taxRate: number
  subtotal: number // Calculated by Odoo
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
  amountUntaxed: number // Calculated by Odoo
  total: number // Calculated by Odoo
  totalTax: number // Calculated by Odoo
  createdAt: string
  updatedAt: string
  number?: string
  customerName?: string
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

export interface RegisterPaymentPayload {
  amount: number
  date: string
  method: string
  reference?: string
}

// NOTE: backend reality (adt_th_api): invoices are exposed under /api/th/v1/sales/invoices/*
const basePath = '/th/v1/sales/invoices'

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

export async function getInvoice(id: number) {
  const body = makeRpc({ id })
  const response = await apiClient.post(`${basePath}/${id}`, body)
  return unwrapResponse<Invoice>(response)
}

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

export async function registerPayment(id: number, payload: RegisterPaymentPayload) {
  const body = makeRpc({ id, ...payload })
  const response = await apiClient.post(`${basePath}/${id}/register-payment`, body)
  return unwrapResponse<Invoice>(response)
}

export async function fetchInvoicePdf(id: number) {
  const response = await apiClient.get(`${basePath}/${id}/pdf`, {
    responseType: 'blob',
  })
  return response.data as Blob
}

export async function openInvoicePdf(id: number) {
  const blob = await fetchInvoicePdf(id)
  const url = URL.createObjectURL(blob)
  // Open in a new tab; if blocked, user can still right-click/open from browser's download
  window.open(url, '_blank', 'noopener,noreferrer')
  // Best-effort cleanup
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}



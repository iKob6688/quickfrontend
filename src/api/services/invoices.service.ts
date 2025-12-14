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

export interface PaymentRecord {
  id: number
  amount: number
  date: string
  method?: string  // Combined: "Manual Payment (Cash)" or "Check (Bank)"
  journal?: string  // Payment channel: "Cash", "Bank", etc.
  reference?: string
}

export interface Invoice extends InvoicePayload {
  id: number
  status: 'draft' | 'posted' | 'paid' | 'cancelled'
  amountUntaxed: number // Calculated by Odoo
  total: number // Calculated by Odoo
  totalTax: number // Calculated by Odoo
  amountPaid?: number // Sum of all payments (if available from backend)
  amountDue?: number // Remaining amount to pay (if available from backend)
  payments?: PaymentRecord[] // Payment history (if available from backend)
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
  paymentState?: 'not_paid' | 'partial' | 'paid' | 'in_payment'  // Payment status from Odoo
  amountPaid?: number  // Amount already paid
  amountDue?: number   // Remaining amount to pay
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

export interface InvoiceAmendResponse {
  originalInvoiceId: number
  creditNoteId: number | null
  newInvoiceId?: number | null
}

export async function amendInvoice(
  id: number,
  input: { reason: string; newInvoice?: InvoicePayload; mode?: 'replace' | 'delta' },
) {
  const body = makeRpc({
    mode: input.mode ?? 'replace',
    reason: input.reason,
    ...(input.newInvoice ? { newInvoice: input.newInvoice } : {}),
  })
  const response = await apiClient.post(`${basePath}/${id}/amend`, body)
  return unwrapResponse<InvoiceAmendResponse>(response)
}

export async function fetchInvoicePdf(id: number) {
  try {
    // Use arraybuffer to allow decoding JSON error payloads on 4xx/5xx.
    const response = await apiClient.get(`${basePath}/${id}/pdf`, {
      responseType: 'arraybuffer',
      headers: { Accept: 'application/pdf,application/json' },
    })

    const contentType = String(response.headers?.['content-type'] ?? '')
    if (contentType.includes('application/pdf')) {
      return new Blob([response.data], { type: 'application/pdf' })
    }

    // Sometimes backend returns JSON with 200; decode it as error
    const text = new TextDecoder('utf-8').decode(new Uint8Array(response.data))
    const parsed = JSON.parse(text)
    const msg =
      parsed?.result?.error?.message ||
      parsed?.error?.message ||
      parsed?.error ||
      parsed?.message ||
      'PDF error'
    throw new Error(String(msg))
  } catch (err: any) {
    // Axios error path: attempt to decode JSON envelope from arraybuffer
    const resp = err?.response
    if (resp?.data && (resp.data instanceof ArrayBuffer || ArrayBuffer.isView(resp.data))) {
      try {
        const buf = resp.data instanceof ArrayBuffer ? resp.data : resp.data.buffer
        const text = new TextDecoder('utf-8').decode(new Uint8Array(buf))
        const parsed = JSON.parse(text)
        const msg =
          parsed?.result?.error?.message ||
          parsed?.error?.message ||
          parsed?.error ||
          parsed?.message ||
          'PDF error'
        throw new Error(String(msg))
      } catch {
        // fall through
      }
    }
    throw err instanceof Error ? err : new Error('PDF error')
  }
}

export async function openInvoicePdf(id: number) {
  const blob = await fetchInvoicePdf(id)
  const url = URL.createObjectURL(blob)
  // Open in a new tab; if blocked, user can still right-click/open from browser's download
  window.open(url, '_blank', 'noopener,noreferrer')
  // Best-effort cleanup
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}



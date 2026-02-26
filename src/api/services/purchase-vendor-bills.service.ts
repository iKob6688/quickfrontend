import { apiClient } from '@/api/client'
import { unwrapResponse } from '@/api/response'
import { makeRpc } from '@/api/services/rpc'
import type { RegisterPaymentPayload } from '@/api/services/invoices.service'

export interface PurchaseVendorBillLine {
  productId: number | null
  description: string
  quantity: number
  unitPrice: number
  subtotal: number
}

export interface PurchaseVendorBillPayment {
  id: number
  amount: number
  date: string | null
  method?: string
  journal?: string
  reference?: string | null
}

export interface PurchaseVendorBill {
  id: number
  number?: string
  vendorId: number
  vendorName: string
  invoiceDate?: string | null
  dueDate?: string | null
  currency: string
  status: 'draft' | 'posted' | 'paid' | 'cancelled'
  amountUntaxed: number
  totalTax: number
  total: number
  amountPaid?: number
  amountDue?: number
  notes?: string | null
  lines: PurchaseVendorBillLine[]
  payments?: PurchaseVendorBillPayment[]
  purchaseOrders?: Array<{ id: number; number?: string }>
}

const basePath = '/th/v1/purchases/bills'

export async function getPurchaseVendorBill(id: number) {
  const response = await apiClient.post(`${basePath}/${id}`, makeRpc({ id }))
  return unwrapResponse<PurchaseVendorBill>(response)
}

export async function postPurchaseVendorBill(id: number) {
  const response = await apiClient.post(`${basePath}/${id}/post`, makeRpc({ id }))
  return unwrapResponse<PurchaseVendorBill>(response)
}

export async function registerPurchaseVendorBillPayment(id: number, payload: RegisterPaymentPayload) {
  const response = await apiClient.post(`${basePath}/${id}/register-payment`, makeRpc({ id, ...payload }))
  return unwrapResponse<{ payment_id: number; payment_name?: string; bill_id: number; new_payment_state?: string }>(response)
}

export async function fetchPurchaseVendorBillPdf(id: number) {
  const response = await apiClient.get(`${basePath}/${id}/pdf`, {
    responseType: 'arraybuffer',
    headers: { Accept: 'application/pdf,application/json' },
  })
  const contentType = String(response.headers?.['content-type'] ?? '')
  if (contentType.includes('application/pdf')) {
    return new Blob([response.data], { type: 'application/pdf' })
  }
  throw new Error('PDF response is not a PDF document')
}

export async function openPurchaseVendorBillPdf(id: number) {
  const blob = await fetchPurchaseVendorBillPdf(id)
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener,noreferrer')
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

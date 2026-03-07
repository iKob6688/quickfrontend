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

type Raw = Record<string, unknown>

function n(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const parsed = Number(v.replace(/,/g, ''))
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function pickId(v: unknown): number {
  if (!v || typeof v !== 'object') return n(v)
  const r = v as Raw
  return n(r.id ?? r._id ?? (r.record && typeof r.record === 'object' ? (r.record as Raw).id : 0))
}

function normalizeBill(raw: unknown): PurchaseVendorBill {
  const wrapped = (raw || {}) as Raw
  const item = (wrapped.bill && typeof wrapped.bill === 'object'
    ? (wrapped.bill as Raw)
    : wrapped) as Raw
  const linesRaw = Array.isArray(item.lines) ? item.lines : []
  const paymentsRaw = Array.isArray(item.payments) ? item.payments : []
  const paymentState = String(item.payment_state ?? item.paymentState ?? '').toLowerCase()
  const amountPaid = n(item.amountPaid ?? item.amount_paid)
  const total = n(item.total ?? item.amount_total)
  const amountDue = n(item.amountDue ?? item.amount_due)
  return {
    id: pickId(item),
    number: item.number ? String(item.number) : undefined,
    vendorId: n(item.vendorId ?? item.vendor_id),
    vendorName: String(item.vendorName ?? item.vendor_name ?? ''),
    invoiceDate: item.invoiceDate ? String(item.invoiceDate) : (item.invoice_date ? String(item.invoice_date) : null),
    dueDate: item.dueDate ? String(item.dueDate) : (item.due_date ? String(item.due_date) : null),
    currency: String(item.currency ?? 'THB'),
    status: paymentState === 'paid'
      ? 'paid'
      : String(item.status ?? item.state ?? '').toLowerCase() === 'draft'
        ? 'draft'
        : String(item.status ?? item.state ?? '').toLowerCase() === 'cancelled'
          ? 'cancelled'
          : 'posted',
    amountUntaxed: n(item.amountUntaxed ?? item.amount_untaxed),
    totalTax: n(item.totalTax ?? item.amount_tax),
    total,
    amountPaid,
    amountDue: amountDue > 0 ? amountDue : Math.max(0, total - amountPaid),
    notes: (item.notes ?? null) as string | null,
    lines: linesRaw.map((lRaw) => {
      const l = (lRaw || {}) as Raw
      return {
        productId: n(l.productId ?? l.product_id) || null,
        description: String(l.description ?? l.name ?? ''),
        quantity: n(l.quantity),
        unitPrice: n(l.unitPrice ?? l.price_unit),
        subtotal: n(l.subtotal ?? l.price_subtotal),
      }
    }),
    payments: paymentsRaw
      .map((pRaw) => {
        const p = (pRaw || {}) as Raw
        return {
          id: pickId(p),
          amount: n(p.amount),
          date: p.date ? String(p.date) : null,
          method: p.method ? String(p.method) : undefined,
          journal: p.journal ? String(p.journal) : undefined,
          reference: p.reference ? String(p.reference) : null,
        }
      })
      .filter((p) => p.id > 0),
    purchaseOrders: Array.isArray(item.purchaseOrders)
      ? item.purchaseOrders
          .map((poRaw) => {
            const po = (poRaw || {}) as Raw
            return { id: pickId(po), number: po.number ? String(po.number) : undefined }
          })
          .filter((po) => po.id > 0)
      : [],
  }
}

export async function getPurchaseVendorBill(id: number) {
  const response = await apiClient.post(`${basePath}/${id}`, makeRpc({ id }))
  return normalizeBill(unwrapResponse<unknown>(response))
}

export async function postPurchaseVendorBill(id: number) {
  const response = await apiClient.post(`${basePath}/${id}/post`, makeRpc({ id }))
  return normalizeBill(unwrapResponse<unknown>(response))
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

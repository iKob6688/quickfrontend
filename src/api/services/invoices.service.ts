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
  appliedAmount?: number
  grossAmount?: number
  netAmount?: number
  date: string
  method?: string
  journal?: string
  reference?: string
  whtCode?: string
  whtRate?: number
  whtAmount?: number
  default_account_id?: number | null // Backend field name
  bankAccount?: string | null // Mapped from default_account_id or account name
  bankAccountNumber?: string
}

export interface PaymentWorkflow {
  allowed: boolean
  reasonCode?: string | null
  reasonMessage?: string | null
  queueState?: string | null
  nextActions?: string[]
  relatedPaymentId?: number | null
  relatedPaymentName?: string | null
  approvalRequestId?: number | null
  approvalRequestState?: string | null
  approvalTeamId?: number | null
  approvalTeamName?: string | null
}

export interface Invoice extends InvoicePayload {
  id: number
  status: 'draft' | 'posted' | 'paid' | 'cancelled'
  amountUntaxed: number // Calculated by Odoo
  total: number // Calculated by Odoo
  totalTax: number // Calculated by Odoo
  amountPaid?: number // Sum of all payments (if available from backend)
  amountDue?: number // Remaining amount to pay (if available from backend)
  paymentState?: 'not_paid' | 'partial' | 'paid' | 'in_payment'
  hasReceipt?: boolean
  hasPaymentReceipt?: boolean
  hasFinalReceipt?: boolean
  lastPaymentDate?: string | null
  payments?: PaymentRecord[] // Payment history (if available from backend)
  paymentWorkflow?: PaymentWorkflow
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
  hasReceipt?: boolean
  hasPaymentReceipt?: boolean
  hasFinalReceipt?: boolean
  lastPaymentDate?: string | null
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
  whtCode?: string
  whtRate?: number
  whtAmount?: number
  grossAmount?: number
  netAmount?: number
}

export interface UpdatePaymentPayload {
  date: string
  method: string
  reference?: string
}

export interface WhtOption {
  code: string
  label: string
  rate: number
  description?: string
}

export interface InvoicePaymentMeta {
  whtOptions: WhtOption[]
  defaultWht?: string | null
  currencyPrecision: number
}

// NOTE: backend reality (adt_th_api): invoices are exposed under /api/th/v1/sales/invoices/*
const basePath = '/th/v1/sales/invoices'

type RawRecord = Record<string, unknown>

function parseNumber(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v.replace(/,/g, ''))
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

function parsePaymentState(v: unknown): Invoice['paymentState'] {
  const raw = String(v || '').toLowerCase().trim()
  if (raw === 'paid') return 'paid'
  if (raw === 'partial') return 'partial'
  if (raw === 'in_payment' || raw === 'in payment') return 'in_payment'
  return 'not_paid'
}

function normalizeListItem(raw: unknown): InvoiceListItem {
  const item = (raw || {}) as RawRecord
  const id = parseNumber(item.id)
  const number = String(item.number ?? item.name ?? item.move_name ?? '')
  const customerName = String(
    item.customerName ??
      item.customer_name ??
      (item.partner && typeof item.partner === 'object' ? (item.partner as RawRecord).name : '') ??
      '',
  )
  const customerId = parseNumber(
    item.customerId ??
      item.customer_id ??
      (item.partner && typeof item.partner === 'object' ? (item.partner as RawRecord).id : 0),
  )
  const statusRaw = String(item.status ?? item.state ?? '').toLowerCase()
  const status: InvoiceListItem['status'] =
    statusRaw === 'draft' || statusRaw === 'cancelled' || statusRaw === 'paid'
      ? (statusRaw as InvoiceListItem['status'])
      : 'posted'
  const paymentState = parsePaymentState(item.paymentState ?? item.payment_state)
  const amountPaidRaw = parseNumber(item.amountPaid ?? item.amount_paid)
  const total = parseNumber(item.total ?? item.amount_total)
  const inferredPaid = (paymentState === 'paid' || status === 'paid') && total > 0
  const amountPaid = amountPaidRaw > 0 ? amountPaidRaw : inferredPaid ? total : 0
  const amountDueRaw = parseNumber(item.amountDue ?? item.amount_due)
  const amountDue = amountDueRaw > 0 || paymentState === 'not_paid' || paymentState === 'partial'
    ? amountDueRaw
    : inferredPaid
      ? 0
      : Math.max(0, total - amountPaid)
  const hasPaymentReceipt = Boolean(
    item.hasPaymentReceipt ?? item.has_payment_receipt ?? amountPaid > 0,
  )
  const hasFinalReceipt = Boolean(
    item.hasFinalReceipt ?? item.has_final_receipt ?? item.hasReceipt ?? item.has_receipt ?? amountDue <= 0,
  )
  return {
    id,
    number,
    customerName,
    customerId,
    invoiceDate: String(item.invoiceDate ?? item.invoice_date ?? item.date ?? ''),
    dueDate: String(item.dueDate ?? item.due_date ?? item.date_due ?? ''),
    total,
    status,
    currency: String(item.currency ?? item.currency_name ?? 'THB'),
    paymentState,
    amountPaid,
    amountDue,
    hasReceipt: hasFinalReceipt,
    hasPaymentReceipt,
    hasFinalReceipt,
    lastPaymentDate: (item.lastPaymentDate ?? item.last_payment_date ?? null) as string | null,
  }
}

function normalizeInvoice(raw: unknown): Invoice {
  const wrapped = (raw || {}) as RawRecord
  const item = (wrapped.invoice && typeof wrapped.invoice === 'object'
    ? (wrapped.invoice as RawRecord)
    : wrapped) as RawRecord
  const id = parseNumber(item.id)
  const linesRaw = Array.isArray(item.lines) ? item.lines : []
  const lines: InvoiceLine[] = linesRaw.map((lineRaw) => {
    const line = (lineRaw || {}) as RawRecord
    return {
      productId: parseNumber(line.productId ?? line.product_id) || null,
      description: String(line.description ?? line.name ?? ''),
      quantity: parseNumber(line.quantity),
      unitPrice: parseNumber(line.unitPrice ?? line.price_unit),
      taxRate: parseNumber(line.taxRate ?? line.tax_rate),
      subtotal: parseNumber(line.subtotal ?? line.price_subtotal),
    }
  })
  const paymentsRaw = Array.isArray(item.payments) ? item.payments : []
  const paymentWorkflowRaw = item.paymentWorkflow && typeof item.paymentWorkflow === 'object'
    ? (item.paymentWorkflow as RawRecord)
    : item.payment_workflow && typeof item.payment_workflow === 'object'
      ? (item.payment_workflow as RawRecord)
      : null
  const payments: PaymentRecord[] = paymentsRaw
    .map((pRaw) => {
      const p = (pRaw || {}) as RawRecord
      return {
        id: parseNumber(p.id),
        amount: parseNumber(p.amount),
        appliedAmount: parseNumber(p.appliedAmount ?? p.applied_amount) || undefined,
        grossAmount: parseNumber(p.grossAmount ?? p.gross_amount) || undefined,
        netAmount: parseNumber(p.netAmount ?? p.net_amount) || undefined,
        date: String(p.date ?? ''),
        method: p.method ? String(p.method) : undefined,
        journal: p.journal ? String(p.journal) : undefined,
        reference: p.reference ? String(p.reference) : undefined,
        whtCode: p.whtCode ? String(p.whtCode) : p.wht_code ? String(p.wht_code) : undefined,
        whtRate: parseNumber(p.whtRate ?? p.wht_rate) || undefined,
        whtAmount: parseNumber(p.whtAmount ?? p.wht_amount) || undefined,
        default_account_id: parseNumber(p.default_account_id) || null,
        bankAccount: p.bankAccount ? String(p.bankAccount) : null,
        bankAccountNumber: p.bankAccountNumber ? String(p.bankAccountNumber) : undefined,
      }
    })
    .filter((p) => p.id > 0)
  const amountPaidFromPayments = payments.reduce((sum, p) => sum + parseNumber(p.appliedAmount ?? p.amount), 0)
  const amountPaidRaw = parseNumber(item.amountPaid ?? item.amount_paid)
  const total = parseNumber(item.total ?? item.amount_total)
  const statusRaw = String(item.status ?? item.state ?? '').toLowerCase()
  const status: Invoice['status'] =
    statusRaw === 'draft' || statusRaw === 'cancelled' || statusRaw === 'paid'
      ? (statusRaw as Invoice['status'])
      : 'posted'
  const paymentState = parsePaymentState(item.paymentState ?? item.payment_state)
  const inferredPaid = (paymentState === 'paid' || status === 'paid') && total > 0
  const amountPaid =
    amountPaidRaw > 0 ? amountPaidRaw : amountPaidFromPayments > 0 ? amountPaidFromPayments : inferredPaid ? total : 0
  const amountDueRaw = parseNumber(item.amountDue ?? item.amount_due)
  const amountDue = amountDueRaw > 0 || paymentState === 'not_paid' || paymentState === 'partial'
    ? amountDueRaw
    : inferredPaid
      ? 0
      : Math.max(0, total - amountPaid)
  const hasPaymentReceipt = Boolean(
    item.hasPaymentReceipt ?? item.has_payment_receipt ?? ((payments.length > 0) || (amountPaid > 0)),
  )
  const hasFinalReceipt = Boolean(
    item.hasFinalReceipt ?? item.has_final_receipt ?? item.hasReceipt ?? item.has_receipt ?? amountDue <= 0,
  )

  return {
    id,
    customerId: parseNumber(item.customerId ?? item.customer_id ?? item.partner_id),
    invoiceDate: String(item.invoiceDate ?? item.invoice_date ?? item.date ?? ''),
    dueDate: String(item.dueDate ?? item.due_date ?? item.date_due ?? ''),
    currency: String(item.currency ?? 'THB'),
    lines,
    notes: item.notes ? String(item.notes) : undefined,
    status,
    amountUntaxed: parseNumber(item.amountUntaxed ?? item.amount_untaxed),
    total,
    totalTax: parseNumber(item.totalTax ?? item.amount_tax),
    amountPaid,
    amountDue,
    paymentState,
    hasReceipt: hasFinalReceipt,
    hasPaymentReceipt,
    hasFinalReceipt,
    lastPaymentDate: (item.lastPaymentDate ?? item.last_payment_date ?? null) as string | null,
    payments,
    paymentWorkflow: paymentWorkflowRaw
      ? {
          allowed: Boolean(paymentWorkflowRaw.allowed),
          reasonCode: paymentWorkflowRaw.reasonCode ? String(paymentWorkflowRaw.reasonCode) : paymentWorkflowRaw.reason_code ? String(paymentWorkflowRaw.reason_code) : null,
          reasonMessage: paymentWorkflowRaw.reasonMessage ? String(paymentWorkflowRaw.reasonMessage) : paymentWorkflowRaw.reason_message ? String(paymentWorkflowRaw.reason_message) : null,
          queueState: paymentWorkflowRaw.queueState ? String(paymentWorkflowRaw.queueState) : paymentWorkflowRaw.queue_state ? String(paymentWorkflowRaw.queue_state) : null,
          nextActions: Array.isArray(paymentWorkflowRaw.nextActions)
            ? paymentWorkflowRaw.nextActions.map((value) => String(value))
            : Array.isArray(paymentWorkflowRaw.next_actions)
              ? (paymentWorkflowRaw.next_actions as unknown[]).map((value) => String(value))
              : [],
          relatedPaymentId: parseNumber(paymentWorkflowRaw.relatedPaymentId ?? paymentWorkflowRaw.related_payment_id) || null,
          relatedPaymentName: paymentWorkflowRaw.relatedPaymentName ? String(paymentWorkflowRaw.relatedPaymentName) : paymentWorkflowRaw.related_payment_name ? String(paymentWorkflowRaw.related_payment_name) : null,
          approvalRequestId: parseNumber(paymentWorkflowRaw.approvalRequestId ?? paymentWorkflowRaw.approval_request_id) || null,
          approvalRequestState: paymentWorkflowRaw.approvalRequestState ? String(paymentWorkflowRaw.approvalRequestState) : paymentWorkflowRaw.approval_request_state ? String(paymentWorkflowRaw.approval_request_state) : null,
          approvalTeamId: parseNumber(paymentWorkflowRaw.approvalTeamId ?? paymentWorkflowRaw.approval_team_id) || null,
          approvalTeamName: paymentWorkflowRaw.approvalTeamName ? String(paymentWorkflowRaw.approvalTeamName) : paymentWorkflowRaw.approval_team_name ? String(paymentWorkflowRaw.approval_team_name) : null,
        }
      : undefined,
    createdAt: String(item.createdAt ?? item.created_at ?? item.create_date ?? ''),
    updatedAt: String(item.updatedAt ?? item.updated_at ?? item.write_date ?? ''),
    number: item.number ? String(item.number) : undefined,
    customerName: item.customerName ? String(item.customerName) : undefined,
  }
}

export async function listInvoices(params?: ListInvoicesParams) {
  const body = makeRpc({
    ...(params?.status && { status: params.status }),
    ...(params?.search && { search: params.search }),
    ...(params?.limit && { limit: params.limit }),
    ...(params?.offset && { offset: params.offset }),
    ...(params?.dateFrom && { date_from: params.dateFrom }),
    ...(params?.dateTo && { date_to: params.dateTo }),
  })
  const response = await apiClient.post(`${basePath}/list`, body)
  const data = unwrapResponse<unknown>(response)
  const rows = Array.isArray(data)
    ? data
    : (data && typeof data === 'object' && Array.isArray((data as RawRecord).items))
      ? ((data as RawRecord).items as unknown[])
      : []
  return rows.map(normalizeListItem).filter((r) => r.id > 0)
}

export async function getInvoice(id: number) {
  const body = makeRpc({ id })
  const response = await apiClient.post(`${basePath}/${id}`, body)
  const data = unwrapResponse<unknown>(response)
  return normalizeInvoice(data)
}

export async function createInvoice(payload: InvoicePayload) {
  const body = makeRpc(payload)
  const response = await apiClient.post(basePath, body)
  const data = unwrapResponse<unknown>(response)
  return normalizeInvoice(data)
}

export async function updateInvoice(id: number, payload: InvoicePayload) {
  const body = makeRpc({ id, ...payload })
  const response = await apiClient.put(`${basePath}/${id}`, body)
  const data = unwrapResponse<unknown>(response)
  return normalizeInvoice(data)
}

export async function postInvoice(id: number) {
  const body = makeRpc({ id })
  const response = await apiClient.post(`${basePath}/${id}/post`, body)
  const data = unwrapResponse<unknown>(response)
  return normalizeInvoice(data)
}

export async function registerPayment(id: number, payload: RegisterPaymentPayload) {
  const amount = payload.grossAmount ?? payload.amount
  const body = makeRpc({
    id,
    ...payload,
    amount,
    grossAmount: payload.grossAmount ?? amount,
    netAmount: payload.netAmount ?? amount,
    whtCode: payload.whtCode,
    whtRate: payload.whtRate,
    whtAmount: payload.whtAmount,
    // snake_case compatibility for Odoo controllers
    gross_amount: payload.grossAmount ?? amount,
    net_amount: payload.netAmount ?? amount,
    wht_code: payload.whtCode,
    wht_rate: payload.whtRate,
    wht_amount: payload.whtAmount,
  })
  const response = await apiClient.post(`${basePath}/${id}/register-payment`, body)
  const data = unwrapResponse<unknown>(response)
  return normalizeInvoice(data)
}

export async function getInvoicePaymentMeta(id?: number): Promise<InvoicePaymentMeta> {
  const fallback: InvoicePaymentMeta = {
    whtOptions: [
      { code: 'none', label: 'ไม่หัก ณ ที่จ่าย', rate: 0 },
      { code: 'WHT_1', label: 'หัก ณ ที่จ่าย 1%', rate: 1 },
      { code: 'WHT_3', label: 'หัก ณ ที่จ่าย 3%', rate: 3 },
      { code: 'WHT_5', label: 'หัก ณ ที่จ่าย 5%', rate: 5 },
    ],
    defaultWht: 'none',
    currencyPrecision: 2,
  }

  try {
    const response = await apiClient.post(`${basePath}/payment-meta`, makeRpc({ ...(id ? { id } : {}) }))
    const raw = unwrapResponse<unknown>(response) as RawRecord
    const rawOptions = Array.isArray(raw.whtOptions)
      ? raw.whtOptions
      : Array.isArray(raw.wht_options)
        ? raw.wht_options
        : []
    const whtOptions: WhtOption[] = rawOptions
      .map((optionRaw) => {
        const option = (optionRaw || {}) as RawRecord
        const code = String(option.code ?? option.whtCode ?? option.wht_code ?? '').trim()
        const label = String(option.label ?? option.name ?? code).trim()
        const rate = parseNumber(option.rate ?? option.whtRate ?? option.wht_rate)
        if (!code) return null
        return {
          code,
          label: label || code,
          rate,
          description: option.description ? String(option.description) : undefined,
        } as WhtOption
      })
      .filter((row): row is WhtOption => Boolean(row))

    return {
      whtOptions: whtOptions.length > 0 ? whtOptions : fallback.whtOptions,
      defaultWht: String(raw.defaultWht ?? raw.default_wht ?? fallback.defaultWht),
      currencyPrecision: Math.max(0, Math.min(4, Math.trunc(parseNumber(raw.currencyPrecision ?? raw.currency_precision) || fallback.currencyPrecision))),
    }
  } catch {
    return fallback
  }
}

export async function updatePayment(id: number, paymentId: number, payload: UpdatePaymentPayload) {
  const body = makeRpc({ id, paymentId, ...payload })
  const response = await apiClient.post(`${basePath}/${id}/payments/${paymentId}/update`, body)
  const data = unwrapResponse<unknown>(response)
  return normalizeInvoice(data)
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
  } catch (err: unknown) {
    // Axios error path: attempt to decode JSON envelope from arraybuffer
    const resp = (err as { response?: { data?: ArrayBuffer | ArrayBufferView } })?.response
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

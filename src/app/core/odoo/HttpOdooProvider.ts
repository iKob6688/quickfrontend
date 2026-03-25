import type { AnyDocumentDTO, DocType } from '../types/dto'
import type { GetDocumentParams, OdooProvider } from './OdooProvider'
import { getAccessToken } from '@/lib/authToken'
import { getInstanceId } from '@/lib/instanceId'

export type HttpOdooProviderOptions = {
  baseUrl: string
  token?: string
  timeoutMs?: number
}

function withTimeout(signal: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort)
  return {
    signal: controller.signal,
    cleanup: () => {
      window.clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    },
  }
}

function endpointFor(docType: DocType, recordId: string): string {
  if (docType === 'receipt_full' || docType === 'receipt_short') {
    const receiptPath = docType === 'receipt_full' ? 'receipt/full' : 'receipt/short'
    if (recordId.startsWith('invoice:')) {
      const invoiceId = recordId.slice('invoice:'.length).trim()
      return `/api/th/v1/erpth/docs/invoice/${encodeURIComponent(invoiceId)}/${receiptPath}`
    }
    if (recordId.startsWith('payment:')) {
      const paymentId = recordId.slice('payment:'.length).trim()
      return `/api/th/v1/erpth/docs/${receiptPath}/${encodeURIComponent(paymentId)}`
    }
  }
  switch (docType) {
    case 'quotation':
      return `/api/th/v1/erpth/docs/quotation/${encodeURIComponent(recordId)}`
    case 'invoice':
      return `/api/th/v1/erpth/docs/invoice/${encodeURIComponent(recordId)}`
    case 'sales_credit_note':
      return `/api/th/v1/erpth/docs/sales-credit-note/${encodeURIComponent(recordId)}`
    case 'sales_debit_note':
      return `/api/th/v1/erpth/docs/sales-debit-note/${encodeURIComponent(recordId)}`
    case 'purchase_credit_note':
      return `/api/th/v1/erpth/docs/purchase-credit-note/${encodeURIComponent(recordId)}`
    case 'purchase_debit_note':
      return `/api/th/v1/erpth/docs/purchase-debit-note/${encodeURIComponent(recordId)}`
    case 'receipt_full':
      return `/api/th/v1/erpth/docs/receipt/full/${encodeURIComponent(recordId)}`
    case 'receipt_short':
      return `/api/th/v1/erpth/docs/receipt/short/${encodeURIComponent(recordId)}`
    case 'trf_receipt':
      return `/api/th/v1/erpth/docs/trf-receipt/${encodeURIComponent(recordId)}`
    default:
      throw new Error(`Unsupported docType: ${docType}`)
  }
}

function makeRpc() {
  return JSON.stringify({ jsonrpc: '2.0', method: 'call', params: {}, id: 1 })
}

function unwrapRpcEnvelope(raw: any): AnyDocumentDTO {
  let payload = raw
  if (payload && typeof payload === 'object' && payload.jsonrpc === '2.0' && 'result' in payload) {
    payload = payload.result
  }
  if (payload && typeof payload === 'object' && 'success' in payload) {
    if (payload.success === false) {
      const msg =
        payload?.error?.message ||
        payload?.error?.code ||
        payload?.error ||
        'DTO fetch failed'
      throw new Error(String(msg))
    }
    payload = payload.data
  }
  return normalizeErpthDto(payload)
}

function n(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (typeof v === 'string') {
    const x = Number(v)
    return Number.isFinite(x) ? x : 0
  }
  return 0
}

function s(v: unknown): string {
  if (typeof v === 'string') {
    const cleaned = v
      .replace(/\b(false|none|null|undefined)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (!cleaned) return ''
    if (/^[-–—]+$/.test(cleaned)) return ''
    return cleaned
  }
  if (typeof v === 'boolean') return ''
  return v == null ? '' : String(v)
}

function normalizeAddressLines(value: unknown): string[] {
  const rows = Array.isArray(value) ? value : []
  return rows
    .map((x) => s(x).trim())
    .filter((x) => x.length > 0)
}

function normalizeErpthDto(raw: any): AnyDocumentDTO {
  const docType = (raw?.docType ?? raw?.doc_type) as DocType
  const companyRaw = raw?.company ?? {}
  const partnerRaw = raw?.partner ?? {}
  const documentRaw = raw?.document ?? {}
  const totalsRaw = raw?.totals ?? {}
  const paymentRaw = raw?.payment ?? {}

  const normalized: any = {
    docType,
    company: {
      name: s(companyRaw.name),
      addressLines: normalizeAddressLines(
        Array.isArray(companyRaw.addressLines) ? companyRaw.addressLines : companyRaw.address_lines,
      ),
      taxId: s(companyRaw.taxId ?? companyRaw.tax_id) || undefined,
      tel: s(companyRaw.tel) || undefined,
      fax: s(companyRaw.fax) || undefined,
      email: s(companyRaw.email) || undefined,
      website: s(companyRaw.website) || undefined,
      // URL is acceptable as img src; field name in frontend is logoBase64 for legacy reasons.
      logoBase64: s(companyRaw.logoBase64 ?? companyRaw.logo_url) || undefined,
    },
    partner: {
      name: s(partnerRaw.name),
      addressLines: normalizeAddressLines(
        Array.isArray(partnerRaw.addressLines) ? partnerRaw.addressLines : partnerRaw.address_lines,
      ),
      taxId: s(partnerRaw.taxId ?? partnerRaw.tax_id) || undefined,
      branch: s(partnerRaw.branch) || undefined,
      tel: s(partnerRaw.tel ?? partnerRaw.phone) || undefined,
    },
    document: {
      number: s(documentRaw.number ?? documentRaw.receipt_no),
      date: s(documentRaw.date ?? documentRaw.issue_date),
      dueDate: s(documentRaw.dueDate ?? documentRaw.due_date) || undefined,
      reference: s(documentRaw.reference) || undefined,
      salesperson: s(documentRaw.salesperson) || undefined,
      creditTerm: s(documentRaw.creditTerm ?? documentRaw.credit_term) || undefined,
      contact: s(documentRaw.contact ?? documentRaw.contact_name) || undefined,
      project: s(documentRaw.project ?? documentRaw.project_name) || undefined,
      journal: s(documentRaw.journal) || undefined,
      paymentMethod: s(documentRaw.paymentMethod ?? documentRaw.payment_method) || undefined,
      bankReference: s(documentRaw.bankReference ?? documentRaw.bank_reference) || undefined,
      chequeNo: s(documentRaw.chequeNo ?? documentRaw.cheque_no) || undefined,
      notes: s(documentRaw.notes ?? documentRaw.note) || undefined,
      linkedInvoices: Array.isArray(documentRaw.linkedInvoices)
        ? documentRaw.linkedInvoices.map((x: any) => ({
            number: s(x?.number),
            reference: s(x?.reference) || undefined,
            date: s(x?.date) || undefined,
            total: n(x?.total),
          }))
        : Array.isArray(documentRaw.linked_invoices)
          ? documentRaw.linked_invoices.map((x: any) => ({
              number: s(x?.number),
              reference: s(x?.reference) || undefined,
              date: s(x?.date) || undefined,
              total: n(x?.total),
            }))
          : undefined,
    },
    items: Array.isArray(raw?.items)
      ? raw.items.map((it: any, idx: number) => ({
          no: n(it?.no) || idx + 1,
          description: s(it?.description),
          qty: n(it?.qty),
          unit: s(it?.unit ?? it?.uom) || undefined,
          unitPrice: n(it?.unitPrice ?? it?.unit_price),
          discount: n(it?.discount),
          amount: n(it?.amount),
        }))
      : [],
    totals: {
      subtotal: n(totalsRaw.subtotal),
      discount: n(totalsRaw.discount ?? totalsRaw.discount_total),
      afterDiscount: n(totalsRaw.afterDiscount ?? totalsRaw.after_discount),
      vat: totalsRaw.vat == null ? undefined : n(totalsRaw.vat),
      total: n(totalsRaw.total),
      amountText: s(totalsRaw.amountText ?? totalsRaw.amount_text),
      currency: s(totalsRaw.currency) || 'THB',
    },
  }

  if (!normalized.totals.afterDiscount && normalized.totals.subtotal >= 0) {
    normalized.totals.afterDiscount = Math.max(0, normalized.totals.subtotal - normalized.totals.discount)
  }

  if (docType === 'receipt_full' || docType === 'receipt_short') {
    normalized.payment = {
      method: (s(paymentRaw.method) || 'other') as 'cash' | 'transfer' | 'cheque' | 'other',
      bank: s(paymentRaw.bank) || undefined,
      chequeNo: s(paymentRaw.chequeNo ?? paymentRaw.cheque_no) || undefined,
      transferAmount: paymentRaw.transferAmount == null ? undefined : n(paymentRaw.transferAmount ?? paymentRaw.transfer_amount),
      date: s(paymentRaw.date) || undefined,
    }
    if (!normalized.document.paymentMethod && normalized.payment.method) {
      normalized.document.paymentMethod = normalized.payment.method
    }
    if (!normalized.document.chequeNo && normalized.payment.chequeNo) {
      normalized.document.chequeNo = normalized.payment.chequeNo
    }
  }

  if (docType === 'trf_receipt') {
    const trf = raw?.fixedRows ?? raw?.trf_rows ?? {}
    normalized.fixedRows = {
      transportation: n(trf.transportation),
      gateChargeAdvanced: n(trf.gateChargeAdvanced ?? trf.gate_charge_advanced),
      returnContainerAdvanced: n(trf.returnContainerAdvanced ?? trf.return_container_advanced),
    }
    normalized.journalItems = Array.isArray(raw?.journalItems)
      ? raw.journalItems
      : Array.isArray(raw?.journal_items)
        ? raw.journal_items.map((j: any) => ({
            accountCode: s(j.accountCode ?? j.account_code),
            accountName: s(j.accountName ?? j.account_name),
            partnerName: s(j.partnerName ?? j.partner_name) || undefined,
            label: s(j.label),
            debit: n(j.debit),
            credit: n(j.credit),
          }))
        : []
    normalized.payment = {
      method: (s(paymentRaw.method) || 'other') as 'cash' | 'transfer' | 'cheque' | 'other',
      bank: s(paymentRaw.bank) || undefined,
      chequeNo: s(paymentRaw.chequeNo ?? paymentRaw.cheque_no) || undefined,
      transferAmount: paymentRaw.transferAmount == null ? undefined : n(paymentRaw.transferAmount ?? paymentRaw.transfer_amount),
      date: s(paymentRaw.date) || undefined,
    }
    if (!normalized.document.paymentMethod && normalized.payment.method) {
      normalized.document.paymentMethod = normalized.payment.method
    }
    if (!normalized.document.chequeNo && normalized.payment.chequeNo) {
      normalized.document.chequeNo = normalized.payment.chequeNo
    }
  }

  if (docType === 'invoice') {
    // Invoice uses the same shape as quotation in current blocks.
    // Keep normalized payload compatible with quotation-oriented blocks.
  }

  return normalized as AnyDocumentDTO
}

export class HttpOdooProvider implements OdooProvider {
  private opts: HttpOdooProviderOptions
  constructor(opts: HttpOdooProviderOptions) {
    this.opts = opts
  }

  async getDocumentDTO(params: GetDocumentParams): Promise<AnyDocumentDTO> {
    const timeoutMs = this.opts.timeoutMs ?? 12_000
    const baseUrl = (this.opts.baseUrl || '').replace(/\/$/, '')

    const path = endpointFor(params.docType, params.recordId)
    let url = `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`
    const apiKey = String(import.meta.env.VITE_API_KEY || '').trim()
    const odooDb = String(import.meta.env.VITE_ODOO_DB || '').trim()
    const token = this.opts.token?.trim() || getAccessToken() || ''
    const instanceId = getInstanceId() || ''
    if (odooDb) {
      const sep = url.includes('?') ? '&' : '?'
      url = `${url}${sep}db=${encodeURIComponent(odooDb)}`
    }

    const { signal, cleanup } = withTimeout(undefined, timeoutMs)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(apiKey ? { 'X-ADT-API-Key': apiKey } : {}),
          ...(instanceId ? { 'X-Instance-ID': instanceId } : {}),
        },
        body: makeRpc(),
        signal,
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`Odoo DTO fetch failed (${res.status}): ${text || res.statusText}`)
      }
      const json = await res.json()
      return unwrapRpcEnvelope(json)
    } finally {
      cleanup()
    }
  }
}

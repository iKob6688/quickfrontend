import { saveDraft, loadDraft, clearDraft } from '@/lib/formDrafts'
import type { SalesOrderAttachment, SalesOrderPayload } from '@/api/services/sales-orders.service'

export interface SalesOrderDraftPreferences {
  currency?: string
  paymentTermText?: string
  vatEnabled?: boolean
  vatRate?: number
  withholdingTaxEnabled?: boolean
  withholdingTaxRate?: number
  customerNameText?: string
  customerAddressText?: string
  customerPhoneText?: string
  customerEmailText?: string
  customerTaxIdText?: string
  customerBranchText?: string
}

export interface SalesOrderDraftPayload extends Omit<SalesOrderPayload, 'attachments'> {
  attachments?: Array<Pick<SalesOrderAttachment, 'name' | 'url' | 'size' | 'type'>>
}

export interface SalesOrderAttachmentDraft extends SalesOrderAttachment {
  file?: File
}

export function sanitizeSalesOrderAttachments(
  attachments: Array<Partial<SalesOrderAttachmentDraft> | null | undefined>,
): Array<Pick<SalesOrderAttachment, 'name' | 'url' | 'size' | 'type'>> {
  return (attachments || [])
    .filter((attachment): attachment is Partial<SalesOrderAttachmentDraft> => Boolean(attachment && attachment.name))
    .map((attachment) => ({
      name: String(attachment.name || '').trim(),
      url: attachment.url ? String(attachment.url) : undefined,
      size: typeof attachment.size === 'number' ? attachment.size : undefined,
      type: attachment.type ? String(attachment.type) : undefined,
    }))
    .filter((attachment) => Boolean(attachment.name))
}

export function sanitizeSalesOrderDraft(payload: SalesOrderPayload): SalesOrderDraftPayload {
  return {
    ...payload,
    partnerId: typeof payload.partnerId === 'number' ? payload.partnerId : payload.partnerId ?? null,
    lines: (payload.lines || []).map((line) => ({
      ...line,
      productId: line.productId ?? null,
      description: line.description || '',
      quantity: Number.isFinite(line.quantity) ? line.quantity : 0,
      unitPrice: Number.isFinite(line.unitPrice) ? line.unitPrice : 0,
      discount: Number.isFinite(line.discount ?? 0) ? Number(line.discount ?? 0) : 0,
      taxIds: Array.isArray(line.taxIds) ? line.taxIds.filter((taxId) => Number.isFinite(Number(taxId)) && Number(taxId) > 0) : [],
      subtotal: Number.isFinite(line.subtotal) ? line.subtotal : 0,
      totalTax: Number.isFinite(line.totalTax) ? line.totalTax : 0,
      total: Number.isFinite(line.total) ? line.total : 0,
    })),
    attachments: sanitizeSalesOrderAttachments(payload.attachments || []),
  }
}

export function loadSalesOrderDraft(key: string) {
  return loadDraft<SalesOrderDraftPayload>(key)
}

export function saveSalesOrderDraft(key: string, payload: SalesOrderPayload) {
  saveDraft<SalesOrderDraftPayload>(key, sanitizeSalesOrderDraft(payload))
}

export function clearSalesOrderDraft(key: string) {
  clearDraft(key)
}

export function loadSalesOrderPreferences(key: string): SalesOrderDraftPreferences {
  const draft = loadDraft<SalesOrderDraftPreferences>(key)
  return draft?.data || {}
}

export function saveSalesOrderPreferences(key: string, payload: SalesOrderDraftPreferences) {
  saveDraft<SalesOrderDraftPreferences>(key, payload)
}

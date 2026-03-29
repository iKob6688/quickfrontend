import { apiClient } from '@/api/client'
import { unwrapResponse } from '@/api/response'
import { makeRpc } from '@/api/services/rpc'

export type EtaxDocumentState =
  | 'draft'
  | 'queued'
  | 'submitted'
  | 'processing'
  | 'done'
  | 'error'
  | 'cancelled'

export type EtaxInetStatus = 'OK' | 'ER' | 'PC' | null

export interface EtaxUsageSummary {
  totalDocuments: number
  queueDepth: number
  queuedCount: number
  submittedCount: number
  processingCount: number
  doneCount: number
  errorCount: number
  cancelledCount: number
  apiLogCount: number
  successRate: number
  errorRate: number
  averageSubmitMs: number
  averagePollMs: number
  lastSubmitDate?: string | null
  lastPollDate?: string | null
}

export interface EtaxAddressProfile {
  reviewNeeded: boolean
  missingFields: string[]
  addressLines: string[]
  addressText?: string | null
}

export interface EtaxConfigSummary {
  id: number
  name: string
  active: boolean
  companyId: number | null
  companyName: string | null
  environment: 'uat' | 'prod'
  serviceCode: 'S03' | 'S06'
  autoSubmitEnabled: boolean
  requestTimeout: number
  maxPollAttempts: number
  sellerTaxId: string
  sellerBranchId: string
  authCodeTaxId: string
  authCodeMatchesCompany: boolean
  credentialsConfigured: boolean
  authorizedCompanyIds?: number[]
  emailDeliveryEnabled: boolean
  emailSenderName?: string | null
  emailSenderAddress?: string | null
  emailReplyTo?: string | null
  sellerAddressReviewNeeded: boolean
  sellerAddressMissingFields: string[]
  sellerAddressLines: string[]
  sellerAddressText: string
  usage: EtaxUsageSummary
}

export interface EtaxSummaryResponse {
  company: { id: number; name: string }
  config: EtaxConfigSummary
  actions: {
    canSubmit: boolean
    canPoll: boolean
    canRetry: boolean
    canCancel: boolean
    canSendEmail: boolean
  }
}

export interface EtaxApiLogRecord {
  id: number
  endpoint: 'sign' | 'status' | 'params' | string
  sellerTaxId?: string | null
  transactionCode?: string | null
  requestStatus?: EtaxInetStatus
  errorCode?: string | null
  errorMessage?: string | null
  httpStatus?: number | null
  durationMs?: number | null
  createDate?: string | null
}

export interface EtaxDocumentRecord {
  id: number
  name: string
  companyId?: number | null
  moveId?: number | null
  moveName?: string | null
  invoiceNumber?: string | null
  invoiceDate?: string | null
  partnerName?: string | null
  documentType?: string | null
  serviceCode?: string | null
  state: EtaxDocumentState
  transactionCode?: string | null
  inetStatus?: EtaxInetStatus
  errorCode?: string | null
  errorMessage?: string | null
  xmlUrl?: string | null
  pdfUrl?: string | null
  hasXmlAttachment?: boolean
  hasPdfAttachment?: boolean
  submitCount?: number
  pollCount?: number
  lastSubmitDate?: string | null
  lastPollDate?: string | null
  amountTotal?: number | null
  currency?: string | null
  note?: string | null
  logCount?: number
  logs?: EtaxApiLogRecord[]
  addressReviewNeeded?: boolean
  addressMissingFields?: string[]
  addressValidationMessage?: string | null
  sellerAddressReviewNeeded?: boolean
  buyerAddressReviewNeeded?: boolean
  emailDeliveryEnabled?: boolean
  emailState?: 'not_applicable' | 'pending' | 'sent' | 'failed' | null
  emailRecipient?: string | null
  emailSentAt?: string | null
  emailLastError?: string | null
  emailRetryCount?: number
  canSendEmail?: boolean
  canResendEmail?: boolean
}

export interface EtaxInvoiceRecord {
  id: number
  name: string
  moveType: string
  state: string
  partnerName?: string | null
  companyId?: number | null
  companyName?: string | null
}

export interface EtaxInvoiceSummary {
  invoice: EtaxInvoiceRecord
  eligible: boolean
  hasDocument: boolean
  canSubmit: boolean
  document?: EtaxDocumentRecord | null
}

export interface EtaxListParams {
  state?: EtaxDocumentState | 'all'
  q?: string
  limit?: number
  offset?: number
}

export interface EtaxListResponse {
  items: EtaxDocumentRecord[]
  total: number
  limit: number
  offset: number
}

export interface EtaxConfigUpdatePayload {
  name?: string
  environment?: 'uat' | 'prod'
  serviceCode?: 'S03' | 'S06'
  autoSubmitEnabled?: boolean
  requestTimeout?: number
  maxPollAttempts?: number
  active?: boolean
  companyId?: number
  emailDeliveryEnabled?: boolean
  emailSenderName?: string
  emailSenderAddress?: string
  emailReplyTo?: string
}

const basePath = '/th/v1/etax'

function parseNumber(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

function parseBoolean(v: unknown): boolean {
  return Boolean(v)
}

function parseText(v: unknown): string | null {
  if (typeof v === 'string') return v
  if (v == null) return null
  return String(v)
}

function parseStringArray(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v.map((item) => parseText(item) || '').filter((item) => item.length > 0)
  }
  if (typeof v === 'string') {
    return v
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
  }
  return []
}

function parseNumberArray(v: unknown): number[] {
  if (!Array.isArray(v)) return []
  return v
    .map((item) => parseNumber(item))
    .filter((item) => Number.isFinite(item) && item > 0)
}

function normalizeUsage(raw: any): EtaxUsageSummary {
  return {
    totalDocuments: parseNumber(raw?.totalDocuments),
    queueDepth: parseNumber(raw?.queueDepth),
    queuedCount: parseNumber(raw?.queuedCount),
    submittedCount: parseNumber(raw?.submittedCount),
    processingCount: parseNumber(raw?.processingCount),
    doneCount: parseNumber(raw?.doneCount),
    errorCount: parseNumber(raw?.errorCount),
    cancelledCount: parseNumber(raw?.cancelledCount),
    apiLogCount: parseNumber(raw?.apiLogCount),
    successRate: parseNumber(raw?.successRate),
    errorRate: parseNumber(raw?.errorRate),
    averageSubmitMs: parseNumber(raw?.averageSubmitMs),
    averagePollMs: parseNumber(raw?.averagePollMs),
    lastSubmitDate: parseText(raw?.lastSubmitDate),
    lastPollDate: parseText(raw?.lastPollDate),
  }
}

function normalizeConfig(raw: any): EtaxConfigSummary {
  return {
    id: parseNumber(raw?.id),
    name: parseText(raw?.name) || '',
    active: parseBoolean(raw?.active),
    companyId: raw?.companyId != null ? parseNumber(raw.companyId) : null,
    companyName: raw?.companyName != null ? parseText(raw.companyName) : null,
    environment: raw?.environment === 'prod' ? 'prod' : 'uat',
    serviceCode: raw?.serviceCode === 'S06' ? 'S06' : 'S03',
    autoSubmitEnabled: parseBoolean(raw?.autoSubmitEnabled),
    requestTimeout: parseNumber(raw?.requestTimeout) || 60,
    maxPollAttempts: parseNumber(raw?.maxPollAttempts) || 20,
    sellerTaxId: parseText(raw?.sellerTaxId) || '',
    sellerBranchId: parseText(raw?.sellerBranchId) || '',
    authCodeTaxId: parseText(raw?.authCodeTaxId) || '',
    authCodeMatchesCompany: parseBoolean(raw?.authCodeMatchesCompany),
    credentialsConfigured: parseBoolean(raw?.credentialsConfigured),
    authorizedCompanyIds: parseNumberArray(raw?.authorizedCompanyIds),
    emailDeliveryEnabled: parseBoolean(raw?.emailDeliveryEnabled),
    emailSenderName: parseText(raw?.emailSenderName),
    emailSenderAddress: parseText(raw?.emailSenderAddress),
    emailReplyTo: parseText(raw?.emailReplyTo),
    sellerAddressReviewNeeded: parseBoolean(raw?.sellerAddressReviewNeeded),
    sellerAddressMissingFields: parseStringArray(raw?.sellerAddressMissingFields),
    sellerAddressLines: parseStringArray(raw?.sellerAddressLines),
    sellerAddressText: parseText(raw?.sellerAddressText) || '',
    usage: normalizeUsage(raw?.usage),
  }
}

function normalizeLog(raw: any): EtaxApiLogRecord {
  return {
    id: parseNumber(raw?.id),
    endpoint: String(raw?.endpoint || ''),
    sellerTaxId: parseText(raw?.sellerTaxId),
    transactionCode: parseText(raw?.transactionCode),
    requestStatus: raw?.requestStatus === 'OK' || raw?.requestStatus === 'ER' || raw?.requestStatus === 'PC'
      ? raw.requestStatus
      : null,
    errorCode: parseText(raw?.errorCode),
    errorMessage: parseText(raw?.errorMessage),
    httpStatus: raw?.httpStatus != null ? parseNumber(raw.httpStatus) : null,
    durationMs: raw?.durationMs != null ? parseNumber(raw.durationMs) : null,
    createDate: parseText(raw?.createDate),
  }
}

function normalizeDocument(raw: any): EtaxDocumentRecord {
  const logs = Array.isArray(raw?.logs) ? raw.logs.map(normalizeLog) : undefined
  return {
    id: parseNumber(raw?.id),
    name: parseText(raw?.name) || '',
    companyId: raw?.companyId != null ? parseNumber(raw.companyId) : null,
    moveId: raw?.moveId != null ? parseNumber(raw.moveId) : null,
    moveName: parseText(raw?.moveName),
    invoiceNumber: parseText(raw?.invoiceNumber),
    invoiceDate: parseText(raw?.invoiceDate),
    partnerName: parseText(raw?.partnerName),
    documentType: parseText(raw?.documentType),
    serviceCode: parseText(raw?.serviceCode),
    state: (raw?.state as EtaxDocumentState) || 'draft',
    transactionCode: parseText(raw?.transactionCode),
    inetStatus: raw?.inetStatus === 'OK' || raw?.inetStatus === 'ER' || raw?.inetStatus === 'PC'
      ? raw.inetStatus
      : null,
    errorCode: parseText(raw?.errorCode),
    errorMessage: parseText(raw?.errorMessage),
    xmlUrl: parseText(raw?.xmlUrl),
    pdfUrl: parseText(raw?.pdfUrl),
    hasXmlAttachment: parseBoolean(raw?.hasXmlAttachment),
    hasPdfAttachment: parseBoolean(raw?.hasPdfAttachment),
    submitCount: raw?.submitCount != null ? parseNumber(raw.submitCount) : undefined,
    pollCount: raw?.pollCount != null ? parseNumber(raw.pollCount) : undefined,
    lastSubmitDate: parseText(raw?.lastSubmitDate),
    lastPollDate: parseText(raw?.lastPollDate),
    amountTotal: raw?.amountTotal != null ? parseNumber(raw.amountTotal) : null,
    currency: parseText(raw?.currency),
    note: parseText(raw?.note),
    logCount: raw?.logCount != null ? parseNumber(raw.logCount) : undefined,
    logs,
    addressReviewNeeded: parseBoolean(raw?.addressReviewNeeded),
    addressMissingFields: parseStringArray(raw?.addressMissingFields),
    addressValidationMessage: parseText(raw?.addressValidationMessage),
    sellerAddressReviewNeeded: parseBoolean(raw?.sellerAddressReviewNeeded),
    buyerAddressReviewNeeded: parseBoolean(raw?.buyerAddressReviewNeeded),
    emailDeliveryEnabled: parseBoolean(raw?.emailDeliveryEnabled),
    emailState: parseText(raw?.emailState) as EtaxDocumentRecord['emailState'],
    emailRecipient: parseText(raw?.emailRecipient),
    emailSentAt: parseText(raw?.emailSentAt),
    emailLastError: parseText(raw?.emailLastError),
    emailRetryCount: raw?.emailRetryCount != null ? parseNumber(raw.emailRetryCount) : undefined,
    canSendEmail: parseBoolean(raw?.canSendEmail),
    canResendEmail: parseBoolean(raw?.canResendEmail),
  }
}

function normalizeInvoiceRecord(raw: any): EtaxInvoiceRecord {
  return {
    id: parseNumber(raw?.id),
    name: parseText(raw?.name) || '',
    moveType: parseText(raw?.moveType) || '',
    state: parseText(raw?.state) || '',
    partnerName: parseText(raw?.partnerName),
    companyId: raw?.companyId != null ? parseNumber(raw.companyId) : null,
    companyName: parseText(raw?.companyName),
  }
}

async function post<T>(path: string, payload: Record<string, unknown>) {
  const response = await apiClient.post(path, makeRpc(payload))
  return unwrapResponse<T>(response)
}

export async function getEtaxSummary() {
  const data = await post<any>(`${basePath}/summary`, {})
  return {
    company: data.company,
    config: normalizeConfig(data.config),
    actions: data.actions,
  } as EtaxSummaryResponse
}

export async function getEtaxConfig() {
  const data = await post<any>(`${basePath}/config`, {})
  return normalizeConfig(data)
}

export async function updateEtaxConfig(payload: EtaxConfigUpdatePayload) {
  const data = await post<any>(`${basePath}/config/update`, payload as Record<string, unknown>)
  return normalizeConfig(data)
}

export async function listEtaxDocuments(params?: EtaxListParams) {
  const data = await post<any>(`${basePath}/documents/list`, {
    ...(params?.state ? { state: params.state } : {}),
    ...(params?.q ? { q: params.q } : {}),
    ...(params?.limit != null ? { limit: params.limit } : {}),
    ...(params?.offset != null ? { offset: params.offset } : {}),
  })
  const items = Array.isArray(data?.items) ? data.items.map(normalizeDocument) : []
  return {
    items,
    total: parseNumber(data?.total) || items.length,
    limit: parseNumber(data?.limit) || (params?.limit ?? items.length),
    offset: parseNumber(data?.offset) || (params?.offset ?? 0),
  } as EtaxListResponse
}

export async function getEtaxDocument(documentId: number) {
  const data = await post<any>(`${basePath}/documents/${documentId}`, {})
  return normalizeDocument(data)
}

export async function getInvoiceEtax(invoiceId: number) {
  const data = await post<any>(`${basePath}/invoices/${invoiceId}`, {})
  return {
    invoice: normalizeInvoiceRecord(data?.invoice),
    eligible: parseBoolean(data?.eligible),
    hasDocument: parseBoolean(data?.hasDocument),
    canSubmit: parseBoolean(data?.canSubmit),
    document: data?.document ? normalizeDocument(data.document) : null,
  } as EtaxInvoiceSummary
}

export async function submitInvoiceEtax(invoiceId: number) {
  const data = await post<any>(`${basePath}/invoices/${invoiceId}/submit`, {})
  return {
    invoice: normalizeInvoiceRecord(data?.etax?.invoice ?? data?.invoice),
    eligible: parseBoolean(data?.etax?.eligible ?? data?.eligible),
    hasDocument: parseBoolean(data?.etax?.hasDocument ?? data?.hasDocument),
    canSubmit: parseBoolean(data?.etax?.canSubmit ?? data?.canSubmit),
    document: data?.etax?.document ? normalizeDocument(data.etax.document) : data?.document ? normalizeDocument(data.document) : null,
  } as EtaxInvoiceSummary
}

export async function submitEtaxDocument(documentId: number) {
  const data = await post<any>(`${basePath}/documents/${documentId}/submit`, {})
  return normalizeDocument(data)
}

export async function pollEtaxDocument(documentId: number) {
  const data = await post<any>(`${basePath}/documents/${documentId}/poll`, {})
  return normalizeDocument(data)
}

export async function retryEtaxDocument(documentId: number) {
  const data = await post<any>(`${basePath}/documents/${documentId}/retry`, {})
  return normalizeDocument(data)
}

export async function cancelEtaxDocument(documentId: number) {
  const data = await post<any>(`${basePath}/documents/${documentId}/cancel`, {})
  return normalizeDocument(data)
}

export async function sendEtaxDocumentEmail(documentId: number) {
  const data = await post<any>(`${basePath}/documents/${documentId}/send-email`, {})
  return normalizeDocument(data)
}

export async function resendEtaxDocumentEmail(documentId: number) {
  const data = await post<any>(`${basePath}/documents/${documentId}/resend-email`, {})
  return normalizeDocument(data)
}

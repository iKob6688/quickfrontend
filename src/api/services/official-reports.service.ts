import { apiClient } from '@/api/client'
import { unwrapResponse } from '@/api/response'
import { makeRpc } from '@/api/services/rpc'

async function postWithProdFallback<T>(path: string, payload: Record<string, unknown>) {
  const rpcPayload = makeRpc(payload)
  const candidates: Array<{ url: string; baseURL?: string }> = [
    { url: path },
    { url: `/api${path}`, baseURL: '' },
    { url: `/web/adt${path}`, baseURL: '' },
    { url: path, baseURL: '' },
  ]
  let lastError: unknown = null
  for (const candidate of candidates) {
    try {
      const response = await apiClient.post(
        candidate.url,
        rpcPayload,
        candidate.baseURL ? { baseURL: candidate.baseURL } : undefined,
      )
      return unwrapResponse<T>(response)
    } catch (err) {
      lastError = err
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Official report request failed')
}

export type OfficialStatus = 'official_form' | 'accounting_review' | 'need_verification' | 'internal'
export type ExportState = 'draft' | 'validated' | 'generated' | 'failed' | 'accepted'

export interface OfficialTemplate {
  id: number
  name: string
  formCode: string
  versionLabel?: string | null
  renderMode?: string | null
  templateStatus?: string | null
  hasPdf: boolean
  pdfPageCount?: number | null
  pdfFieldCount?: number | null
  masterPdfAvailable?: boolean
  fieldMapCount?: number
  requiresSourceDocument?: boolean
}

export interface OfficialFormListItem {
  template: OfficialTemplate
  companyErrors: string[]
  templateErrors: string[]
  resolvedOfficialStatus: OfficialStatus
  requirement?: number | null
  canGenerate: boolean
}

export interface OfficialExportLog {
  id: number
  name: string
  companyId: number
  reportType: string
  periodFrom?: string | null
  periodTo?: string | null
  state: ExportState
  officialStatus: OfficialStatus
  noData: boolean
  hasErrors: boolean
  outputType?: string | null
  validationErrors?: string | null
  attachmentId?: number | null
  attachmentUrl?: string | null
  sourceModel?: string | null
  sourceResId?: number | null
  templateId?: number | null
  templateChecksum?: string | null
}

export interface OfficialPackSummary {
  total: number
  generated: number
  validated: number
  failed: number
  accepted: number
  withAttachment: number
  noData: number
  officialFormReady: number
  accountingReviewReady: number
  needVerification: number
}

export interface MonthlyPackResponse {
  packType: 'monthly'
  period: {
    year: number
    month: number
    dateFrom: string
    dateTo: string
    includeDraft: boolean
    includeEtax: boolean
  }
  logs: OfficialExportLog[]
  summary: OfficialPackSummary
}

export interface WhtCertificateListItem {
  id: number
  name: string
  number?: string | null
  state?: string | null
  date?: string | null
  companyId?: number | null
  companyName?: string | null
  partnerId?: number | null
  partnerName?: string | null
  partnerTaxId?: string | null
  paymentId?: number | null
  paymentName?: string | null
  moveId?: number | null
  moveName?: string | null
  incomeTaxForm?: string | null
  lineCount: number
  totalBase: number
  totalWht: number
}

export async function listOfficialForms(params: { companyId?: number; formCode?: string } = {}) {
  return postWithProdFallback<{ forms: OfficialFormListItem[] }>(
    '/th/v1/official-reports/forms',
    {
      ...(params.companyId !== undefined ? { company_id: params.companyId } : {}),
      ...(params.formCode ? { form_code: params.formCode } : {}),
    },
  )
}

export async function generateOfficialForm(params: {
  templateId: number
  companyId?: number
  dateFrom: string
  dateTo: string
  requestedStatus?: OfficialStatus
  sourceModel?: string
  sourceId?: number
}) {
  return postWithProdFallback<{ exportLog: OfficialExportLog }>(
    '/th/v1/official-reports/generate',
    {
      template_id: params.templateId,
      ...(params.companyId !== undefined ? { company_id: params.companyId } : {}),
      date_from: params.dateFrom,
      date_to: params.dateTo,
      ...(params.requestedStatus ? { requested_status: params.requestedStatus } : {}),
      ...(params.sourceModel ? { source_model: params.sourceModel } : {}),
      ...(params.sourceId !== undefined ? { source_id: params.sourceId } : {}),
    },
  )
}

export async function listOfficialExportLogs(params: {
  companyId?: number
  reportType?: string
  limit?: number
} = {}) {
  return postWithProdFallback<{ logs: OfficialExportLog[]; pagination?: Record<string, unknown> }>(
    '/th/v1/official-reports/export-logs',
    {
      ...(params.companyId !== undefined ? { company_id: params.companyId } : {}),
      ...(params.reportType ? { report_type: params.reportType } : {}),
      limit: params.limit ?? 50,
    },
  )
}

export async function generateMonthlyOfficialPack(params: {
  companyId?: number
  year: number
  month: number
  includeDraft?: boolean
  includeEtax?: boolean
}) {
  return postWithProdFallback<MonthlyPackResponse>(
    '/th/v1/official-reports/packs/monthly',
    {
      ...(params.companyId !== undefined ? { company_id: params.companyId } : {}),
      year: params.year,
      month: params.month,
      include_draft: Boolean(params.includeDraft),
      include_etax: params.includeEtax !== false,
    },
  )
}

export async function listWhtCertificates(params: {
  companyId?: number
  dateFrom?: string
  dateTo?: string
  incomeTaxForm?: string
  state?: string
  sourceModel?: string
  sourceId?: number
  limit?: number
}) {
  return postWithProdFallback<{
    certificates: WhtCertificateListItem[]
    pagination?: Record<string, unknown>
  }>(
    '/th/v1/official-reports/wht/certificates',
    {
      ...(params.companyId !== undefined ? { company_id: params.companyId } : {}),
      ...(params.dateFrom ? { date_from: params.dateFrom } : {}),
      ...(params.dateTo ? { date_to: params.dateTo } : {}),
      ...(params.incomeTaxForm ? { income_tax_form: params.incomeTaxForm } : {}),
      ...(params.state ? { state: params.state } : {}),
      ...(params.sourceModel ? { source_model: params.sourceModel } : {}),
      ...(params.sourceId !== undefined ? { source_id: params.sourceId } : {}),
      limit: params.limit ?? 100,
    },
  )
}

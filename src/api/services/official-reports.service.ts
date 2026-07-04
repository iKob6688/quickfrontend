import { apiClient } from '@/api/client'
import { unwrapResponse } from '@/api/response'
import { makeRpc } from '@/api/services/rpc'
import { getAccessToken } from '@/lib/authToken'

const WEB_SESSION_TOKEN = '__odoo_web_session__'

async function postWithProdFallback<T>(path: string, payload: Record<string, unknown>) {
  const rpcPayload = makeRpc(payload)
  const prefersWebSession = getAccessToken() === WEB_SESSION_TOKEN
  const webCandidate = { url: `/web/adt${path}`, baseURL: '' }
  const apiCandidates: Array<{ url: string; baseURL?: string }> = [
    { url: path },
    { url: `/api${path}`, baseURL: '' },
    { url: path, baseURL: '' },
  ]
  const candidates: Array<{ url: string; baseURL?: string }> = prefersWebSession
    ? [webCandidate, ...apiCandidates]
    : [...apiCandidates, webCandidate]
  let lastError: unknown = null
  const attempted: string[] = []
  for (const candidate of candidates) {
    try {
      attempted.push(`${candidate.baseURL ?? apiClient.defaults.baseURL ?? ''}${candidate.url}`)
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
  const reason = lastError instanceof Error ? lastError.message : 'unknown error'
  throw new Error(`Official report request failed: ${reason}. Tried ${attempted.join(', ')}`)
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

type RawRecord = Record<string, unknown>

function num(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/g, '').trim())
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function str(value: unknown) {
  return typeof value === 'string' ? value : value == null ? null : String(value)
}

function bool(value: unknown) {
  return Boolean(value)
}

function normalizeOfficialTemplate(raw: unknown): OfficialTemplate {
  const item = (raw && typeof raw === 'object' ? raw : {}) as RawRecord
  return {
    id: num(item.id),
    name: str(item.name) || `Template #${num(item.id)}`,
    formCode: str(item.formCode ?? item.form_code) || '',
    versionLabel: str(item.versionLabel ?? item.version_label),
    renderMode: str(item.renderMode ?? item.render_mode),
    templateStatus: str(item.templateStatus ?? item.template_status),
    hasPdf: bool(item.hasPdf ?? item.has_pdf),
    pdfPageCount: num(item.pdfPageCount ?? item.pdf_page_count) || null,
    pdfFieldCount: num(item.pdfFieldCount ?? item.pdf_field_count) || null,
    masterPdfAvailable: bool(item.masterPdfAvailable ?? item.master_pdf_available),
    fieldMapCount: num(item.fieldMapCount ?? item.field_map_count),
    requiresSourceDocument: bool(item.requiresSourceDocument ?? item.requires_source_document),
  }
}

function normalizeOfficialExportLog(raw: unknown): OfficialExportLog {
  const item = (raw && typeof raw === 'object' ? raw : {}) as RawRecord
  return {
    id: num(item.id),
    name: str(item.name) || `Export #${num(item.id)}`,
    companyId: num(item.companyId ?? item.company_id),
    reportType: str(item.reportType ?? item.report_type) || '',
    periodFrom: str(item.periodFrom ?? item.period_from),
    periodTo: str(item.periodTo ?? item.period_to),
    state: (str(item.state) || 'draft') as ExportState,
    officialStatus: (str(item.officialStatus ?? item.official_status) || 'internal') as OfficialStatus,
    noData: bool(item.noData ?? item.no_data),
    hasErrors: bool(item.hasErrors ?? item.has_errors),
    outputType: str(item.outputType ?? item.output_type),
    validationErrors: str(item.validationErrors ?? item.validation_errors),
    attachmentId: num(item.attachmentId ?? item.attachment_id) || null,
    attachmentUrl: str(item.attachmentUrl ?? item.attachment_url),
    sourceModel: str(item.sourceModel ?? item.source_model),
    sourceResId: num(item.sourceResId ?? item.source_res_id) || null,
    templateId: num(item.templateId ?? item.template_id) || null,
    templateChecksum: str(item.templateChecksum ?? item.template_checksum),
  }
}

function normalizeOfficialFormListItem(raw: unknown): OfficialFormListItem {
  const item = (raw && typeof raw === 'object' ? raw : {}) as RawRecord
  return {
    template: normalizeOfficialTemplate(item.template),
    companyErrors: Array.isArray(item.companyErrors ?? item.company_errors)
      ? ((item.companyErrors ?? item.company_errors) as unknown[]).map((value) => String(value))
      : [],
    templateErrors: Array.isArray(item.templateErrors ?? item.template_errors)
      ? ((item.templateErrors ?? item.template_errors) as unknown[]).map((value) => String(value))
      : [],
    resolvedOfficialStatus: (str(item.resolvedOfficialStatus ?? item.resolved_official_status) || 'internal') as OfficialStatus,
    requirement: num(item.requirement) || null,
    canGenerate: bool(item.canGenerate ?? item.can_generate),
  }
}

function normalizeWhtCertificate(raw: unknown): WhtCertificateListItem {
  const item = (raw && typeof raw === 'object' ? raw : {}) as RawRecord
  return {
    id: num(item.id),
    name: str(item.name) || `WHT #${num(item.id)}`,
    number: str(item.number),
    state: str(item.state),
    date: str(item.date),
    companyId: num(item.companyId ?? item.company_id) || null,
    companyName: str(item.companyName ?? item.company_name),
    partnerId: num(item.partnerId ?? item.partner_id) || null,
    partnerName: str(item.partnerName ?? item.partner_name),
    partnerTaxId: str(item.partnerTaxId ?? item.partner_tax_id),
    paymentId: num(item.paymentId ?? item.payment_id) || null,
    paymentName: str(item.paymentName ?? item.payment_name),
    moveId: num(item.moveId ?? item.move_id) || null,
    moveName: str(item.moveName ?? item.move_name),
    incomeTaxForm: str(item.incomeTaxForm ?? item.income_tax_form),
    lineCount: num(item.lineCount ?? item.line_count),
    totalBase: num(item.totalBase ?? item.total_base),
    totalWht: num(item.totalWht ?? item.total_wht),
  }
}

export async function listOfficialForms(params: { companyId?: number; formCode?: string } = {}) {
  const raw = await postWithProdFallback<{ forms?: unknown[]; items?: unknown[] }>(
    '/th/v1/official-reports/forms',
    {
      ...(params.companyId !== undefined ? { company_id: params.companyId } : {}),
      ...(params.formCode ? { form_code: params.formCode } : {}),
    },
  )
  const forms = Array.isArray(raw.forms) ? raw.forms : Array.isArray(raw.items) ? raw.items : []
  return { forms: forms.map(normalizeOfficialFormListItem) }
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
  const raw = await postWithProdFallback<{ exportLog?: unknown; export_log?: unknown }>(
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
  const exportLog = normalizeOfficialExportLog(raw.exportLog ?? raw.export_log)
  if (!exportLog.id) {
    throw new Error('Official report generate completed without export log payload')
  }
  return {
    exportLog,
  }
}

export async function listOfficialExportLogs(params: {
  companyId?: number
  reportType?: string
  limit?: number
} = {}) {
  const raw = await postWithProdFallback<{ logs?: unknown[]; export_logs?: unknown[]; pagination?: Record<string, unknown> }>(
    '/th/v1/official-reports/export-logs',
    {
      ...(params.companyId !== undefined ? { company_id: params.companyId } : {}),
      ...(params.reportType ? { report_type: params.reportType } : {}),
      limit: params.limit ?? 50,
    },
  )
  const logs = Array.isArray(raw.logs) ? raw.logs : Array.isArray(raw.export_logs) ? raw.export_logs : []
  return { logs: logs.map(normalizeOfficialExportLog), pagination: raw.pagination }
}

export async function generateMonthlyOfficialPack(params: {
  companyId?: number
  year: number
  month: number
  includeDraft?: boolean
  includeEtax?: boolean
}) {
  const raw = await postWithProdFallback<Record<string, unknown>>(
    '/th/v1/official-reports/packs/monthly',
    {
      ...(params.companyId !== undefined ? { company_id: params.companyId } : {}),
      year: params.year,
      month: params.month,
      include_draft: Boolean(params.includeDraft),
      include_etax: params.includeEtax !== false,
    },
  )
  const periodRaw = (raw.period && typeof raw.period === 'object' ? raw.period : {}) as RawRecord
  const summaryRaw = (raw.summary && typeof raw.summary === 'object' ? raw.summary : {}) as RawRecord
  const logsRaw = Array.isArray(raw.logs) ? raw.logs : []
  return {
    packType: 'monthly',
    period: {
      year: num(periodRaw.year),
      month: num(periodRaw.month),
      dateFrom: str(periodRaw.dateFrom ?? periodRaw.date_from) || '',
      dateTo: str(periodRaw.dateTo ?? periodRaw.date_to) || '',
      includeDraft: bool(periodRaw.includeDraft ?? periodRaw.include_draft),
      includeEtax: bool(periodRaw.includeEtax ?? periodRaw.include_etax),
    },
    logs: logsRaw.map(normalizeOfficialExportLog),
    summary: {
      total: num(summaryRaw.total),
      generated: num(summaryRaw.generated),
      validated: num(summaryRaw.validated),
      failed: num(summaryRaw.failed),
      accepted: num(summaryRaw.accepted),
      withAttachment: num(summaryRaw.withAttachment ?? summaryRaw.with_attachment),
      noData: num(summaryRaw.noData ?? summaryRaw.no_data),
      officialFormReady: num(summaryRaw.officialFormReady ?? summaryRaw.official_form_ready),
      accountingReviewReady: num(summaryRaw.accountingReviewReady ?? summaryRaw.accounting_review_ready),
      needVerification: num(summaryRaw.needVerification ?? summaryRaw.need_verification),
    },
  }
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
  const raw = await postWithProdFallback<{
    certificates?: unknown[]
    items?: unknown[]
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
  const certificates = Array.isArray(raw.certificates) ? raw.certificates : Array.isArray(raw.items) ? raw.items : []
  return {
    certificates: certificates.map(normalizeWhtCertificate),
    pagination: raw.pagination,
  }
}

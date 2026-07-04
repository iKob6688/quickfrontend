import { apiClient } from '@/api/client'
import { unwrapResponse } from '@/api/response'
import { makeRpc } from '@/api/services/rpc'
import { getAccessToken } from '@/lib/authToken'
import type { OfficialExportLog } from '@/api/services/official-reports.service'

const WEB_SESSION_TOKEN = '__odoo_web_session__'

type RawRecord = Record<string, unknown>

async function postWorkspace<T>(path: string, payload: Record<string, unknown>) {
  const rpcPayload = makeRpc(payload)
  const prefersWebSession = getAccessToken() === WEB_SESSION_TOKEN
  const webCandidate = { url: `/web/adt${path}`, baseURL: '' }
  const apiCandidates: Array<{ url: string; baseURL?: string }> = [
    { url: path },
    { url: `/api${path}`, baseURL: '' },
    { url: path, baseURL: '' },
  ]
  const candidates = prefersWebSession ? [webCandidate, ...apiCandidates] : [...apiCandidates, webCandidate]
  let lastError: unknown = null
  for (const candidate of candidates) {
    try {
      const response = await apiClient.post(
        candidate.url,
        rpcPayload,
        candidate.baseURL ? { baseURL: candidate.baseURL } : undefined,
      )
      return unwrapResponse<T>(response)
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Official workspace request failed')
}

function num(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
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

export type WorkspaceStatusCode =
  | 'blocked_setup'
  | 'blocked_template'
  | 'blocked_source_document'
  | 'ready_to_generate'
  | 'generated'
  | 'generated_needs_review'
  | 'ready_for_rd_prep'

export interface OfficialReadinessIssue {
  code: string
  message: string
  level: 'error' | 'warning' | 'info'
  source: string
  reportType?: string | null
}

export interface OfficialActionHint {
  code: string
  label: string
  kind: string
  description?: string | null
}

export interface OfficialWorkItem {
  code: string
  title: string
  subtitle?: string | null
  kind: string
  belongsToSmeCore: boolean
  reportTypes: string[]
  outputKind?: string | null
  templateId?: number | null
  templateName?: string | null
  templateStatus?: string | null
  formCode?: string | null
  resolvedOfficialStatus?: string | null
  sourceRequired: boolean
  sourceModels: string[]
  sourceSummary: {
    certificateCount: number
    latestCertificateId?: number | null
  }
  status: {
    code: WorkspaceStatusCode
    label: string
    canGenerate: boolean
  }
  issues: OfficialReadinessIssue[]
  lastExportLogId?: number | null
  lastSubmissionId?: number | null
  nextActions: OfficialActionHint[]
}

export interface OfficialReportsWorkspace {
  authMode: string
  officialReportAccess: boolean
  allowedCompanyIds: number[]
  company: {
    id: number
    name: string
  }
  period: {
    year: number
    month: number
    dateFrom: string
    dateTo: string
    includeDraft: boolean
  }
  companyErrors: string[]
  missingDataItems: string[]
  actionHints: OfficialActionHint[]
  workItems: OfficialWorkItem[]
  recentLogs: OfficialExportLog[]
  summary: {
    itemCount: number
    readyToGenerate: number
    blockedSetup: number
    blockedTemplate: number
    blockedSourceDocument: number
    generated: number
    generatedNeedsReview: number
    readyForRdPrep: number
  }
  wht: {
    certificateCount: number
    partnerIssueCount: number
    reconciliationIssueCount: number
    latestCertificateIds: number[]
  }
  rdEfiling: {
    submissionCount: number
    states: Record<string, number>
    latestSubmissionIds: number[]
    submissions: Array<{
      id: number
      name: string
      reportType?: string | null
      periodFrom?: string | null
      periodTo?: string | null
      state?: string | null
      sourceChannel?: string | null
      efilingMode?: string | null
      rdReference?: string | null
      submittedAt?: string | null
      exportLogId?: number | null
      attachmentId?: number | null
    }>
  }
}

function normalizeLog(raw: unknown): OfficialExportLog {
  const item = (raw && typeof raw === 'object' ? raw : {}) as RawRecord
  return {
    id: num(item.id),
    name: str(item.name) || `Export #${num(item.id)}`,
    companyId: num(item.companyId ?? item.company_id),
    reportType: str(item.reportType ?? item.report_type) || '',
    periodFrom: str(item.periodFrom ?? item.period_from),
    periodTo: str(item.periodTo ?? item.period_to),
    state: (str(item.state) || 'draft') as OfficialExportLog['state'],
    officialStatus: (str(item.officialStatus ?? item.official_status) || 'internal') as OfficialExportLog['officialStatus'],
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

function normalizeIssue(raw: unknown): OfficialReadinessIssue {
  const item = (raw && typeof raw === 'object' ? raw : {}) as RawRecord
  return {
    code: str(item.code) || 'issue',
    message: str(item.message) || 'Unknown issue',
    level: ((str(item.level) || 'error') as OfficialReadinessIssue['level']),
    source: str(item.source) || 'validation',
    reportType: str(item.reportType ?? item.report_type),
  }
}

function normalizeActionHint(raw: unknown): OfficialActionHint {
  const item = (raw && typeof raw === 'object' ? raw : {}) as RawRecord
  return {
    code: str(item.code) || 'action',
    label: str(item.label) || 'Action',
    kind: str(item.kind) || 'general',
    description: str(item.description),
  }
}

function normalizeWorkItem(raw: unknown): OfficialWorkItem {
  const item = (raw && typeof raw === 'object' ? raw : {}) as RawRecord
  const status = (item.status && typeof item.status === 'object' ? item.status : {}) as RawRecord
  const sourceSummary = (item.sourceSummary && typeof item.sourceSummary === 'object' ? item.sourceSummary : {}) as RawRecord
  const reportTypes = Array.isArray(item.reportTypes ?? item.report_types)
    ? ((item.reportTypes ?? item.report_types) as unknown[])
    : []
  const sourceModels = Array.isArray(item.sourceModels ?? item.source_models)
    ? ((item.sourceModels ?? item.source_models) as unknown[])
    : []
  const nextActions = Array.isArray(item.nextActions ?? item.next_actions)
    ? ((item.nextActions ?? item.next_actions) as unknown[])
    : []
  return {
    code: str(item.code) || 'work_item',
    title: str(item.title) || 'Official work item',
    subtitle: str(item.subtitle),
    kind: str(item.kind) || 'official_form',
    belongsToSmeCore: bool(item.belongsToSmeCore ?? item.belongs_to_sme_core),
    reportTypes: reportTypes.map((value: unknown) => String(value)),
    outputKind: str(item.outputKind ?? item.output_kind),
    templateId: num(item.templateId ?? item.template_id) || null,
    templateName: str(item.templateName ?? item.template_name),
    templateStatus: str(item.templateStatus ?? item.template_status),
    formCode: str(item.formCode ?? item.form_code),
    resolvedOfficialStatus: str(item.resolvedOfficialStatus ?? item.resolved_official_status),
    sourceRequired: bool(item.sourceRequired ?? item.source_required),
    sourceModels: sourceModels.map((value: unknown) => String(value)),
    sourceSummary: {
      certificateCount: num(sourceSummary.certificateCount ?? sourceSummary.certificate_count),
      latestCertificateId: num(sourceSummary.latestCertificateId ?? sourceSummary.latest_certificate_id) || null,
    },
    status: {
      code: (str(status.code) || 'blocked_template') as WorkspaceStatusCode,
      label: str(status.label) || 'Unknown status',
      canGenerate: bool(status.canGenerate ?? status.can_generate),
    },
    issues: Array.isArray(item.issues) ? item.issues.map(normalizeIssue) : [],
    lastExportLogId: num(item.lastExportLogId ?? item.last_export_log_id) || null,
    lastSubmissionId: num(item.lastSubmissionId ?? item.last_submission_id) || null,
    nextActions: nextActions.map(normalizeActionHint),
  }
}

export async function getMonthlyOfficialWorkspace(params: {
  companyId?: number
  year: number
  month: number
  includeDraft?: boolean
}) {
  const raw = await postWorkspace<RawRecord>('/th/v1/official-reports/workspace/monthly', {
    ...(params.companyId !== undefined ? { company_id: params.companyId } : {}),
    year: params.year,
    month: params.month,
    include_draft: Boolean(params.includeDraft),
  })
  const company = (raw.company && typeof raw.company === 'object' ? raw.company : {}) as RawRecord
  const period = (raw.period && typeof raw.period === 'object' ? raw.period : {}) as RawRecord
  const summary = (raw.summary && typeof raw.summary === 'object' ? raw.summary : {}) as RawRecord
  const wht = (raw.wht && typeof raw.wht === 'object' ? raw.wht : {}) as RawRecord
  const rd = (raw.rdEfiling && typeof raw.rdEfiling === 'object' ? raw.rdEfiling : {}) as RawRecord
  const allowedCompanyIds = Array.isArray(raw.allowedCompanyIds ?? raw.allowed_company_ids)
    ? ((raw.allowedCompanyIds ?? raw.allowed_company_ids) as unknown[])
    : []
  const companyErrors = Array.isArray(raw.companyErrors ?? raw.company_errors)
    ? ((raw.companyErrors ?? raw.company_errors) as unknown[])
    : []
  const missingDataItems = Array.isArray(raw.missingDataItems ?? raw.missing_data_items)
    ? ((raw.missingDataItems ?? raw.missing_data_items) as unknown[])
    : []
  const actionHints = Array.isArray(raw.actionHints ?? raw.action_hints)
    ? ((raw.actionHints ?? raw.action_hints) as unknown[])
    : []
  const workItems = Array.isArray(raw.workItems ?? raw.work_items) ? ((raw.workItems ?? raw.work_items) as unknown[]) : []
  const recentLogs = Array.isArray(raw.recentLogs ?? raw.recent_logs)
    ? ((raw.recentLogs ?? raw.recent_logs) as unknown[])
    : []
  const latestCertificateIds = Array.isArray(wht.latestCertificateIds ?? wht.latest_certificate_ids)
    ? ((wht.latestCertificateIds ?? wht.latest_certificate_ids) as unknown[])
    : []
  const latestSubmissionIds = Array.isArray(rd.latestSubmissionIds ?? rd.latest_submission_ids)
    ? ((rd.latestSubmissionIds ?? rd.latest_submission_ids) as unknown[])
    : []
  const submissions = Array.isArray(rd.submissions) ? (rd.submissions as unknown[]) : []
  return {
    authMode: str(raw.authMode ?? raw.auth_mode) || 'unknown',
    officialReportAccess: bool(raw.officialReportAccess ?? raw.official_report_access),
    allowedCompanyIds: allowedCompanyIds.map((value: unknown) => Number(value)),
    company: {
      id: num(company.id),
      name: str(company.name) || '-',
    },
    period: {
      year: num(period.year),
      month: num(period.month),
      dateFrom: str(period.dateFrom ?? period.date_from) || '',
      dateTo: str(period.dateTo ?? period.date_to) || '',
      includeDraft: bool(period.includeDraft ?? period.include_draft),
    },
    companyErrors: companyErrors.map((value: unknown) => String(value)),
    missingDataItems: missingDataItems.map((value: unknown) => String(value)),
    actionHints: actionHints.map(normalizeActionHint),
    workItems: workItems.map(normalizeWorkItem),
    recentLogs: recentLogs.map(normalizeLog),
    summary: {
      itemCount: num(summary.itemCount ?? summary.item_count),
      readyToGenerate: num(summary.readyToGenerate ?? summary.ready_to_generate),
      blockedSetup: num(summary.blockedSetup ?? summary.blocked_setup),
      blockedTemplate: num(summary.blockedTemplate ?? summary.blocked_template),
      blockedSourceDocument: num(summary.blockedSourceDocument ?? summary.blocked_source_document),
      generated: num(summary.generated),
      generatedNeedsReview: num(summary.generatedNeedsReview ?? summary.generated_needs_review),
      readyForRdPrep: num(summary.readyForRdPrep ?? summary.ready_for_rd_prep),
    },
    wht: {
      certificateCount: num(wht.certificateCount ?? wht.certificate_count),
      partnerIssueCount: num(wht.partnerIssueCount ?? wht.partner_issue_count),
      reconciliationIssueCount: num(wht.reconciliationIssueCount ?? wht.reconciliation_issue_count),
      latestCertificateIds: latestCertificateIds.map((value: unknown) => Number(value)),
    },
    rdEfiling: {
      submissionCount: num(rd.submissionCount ?? rd.submission_count),
      states: (rd.states && typeof rd.states === 'object' ? rd.states : {}) as Record<string, number>,
      latestSubmissionIds: latestSubmissionIds.map((value: unknown) => Number(value)),
      submissions: submissions.map((rawSubmission: unknown) => {
            const item = (rawSubmission && typeof rawSubmission === 'object' ? rawSubmission : {}) as RawRecord
            return {
              id: num(item.id),
              name: str(item.name) || `Submission #${num(item.id)}`,
              reportType: str(item.reportType ?? item.report_type),
              periodFrom: str(item.periodFrom ?? item.period_from),
              periodTo: str(item.periodTo ?? item.period_to),
              state: str(item.state),
              sourceChannel: str(item.sourceChannel ?? item.source_channel),
              efilingMode: str(item.efilingMode ?? item.efiling_mode),
              rdReference: str(item.rdReference ?? item.rd_reference),
              submittedAt: str(item.submittedAt ?? item.submitted_at),
              exportLogId: num(item.exportLogId ?? item.export_log_id) || null,
              attachmentId: num(item.attachmentId ?? item.attachment_id) || null,
            }
          }),
    },
  } satisfies OfficialReportsWorkspace
}

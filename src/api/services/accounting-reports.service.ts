import { apiClient } from '@/api/client'
import { unwrapResponse } from '@/api/response'
import { makeRpc } from '@/api/services/rpc'

export type TargetMove = 'posted' | 'draft'

export interface ReportBaseParams {
  companyId?: number
  dateFrom?: string
  dateTo?: string
  comparison?: number
  comparisonType?: 'month' | 'year'
  journalIds?: number[]
  analyticIds?: number[]
  targetMove?: TargetMove
}

export interface ProfitLossEntry {
  name: string
  code?: string
  amount: string | number
  // Phase 2 รายละเอียด(optional; provided by backend)
  accountId?: number
  accountCode?: string
  accountName?: string
  drilldownUrl?: string
}

export interface ProfitLossReportData {
  totalIncome?: string | number
  totalExpense?: string | number
  totalEarnings?: string | number
  income?: { entries?: ProfitLossEntry[]; total?: string | number }
  expense?: { entries?: ProfitLossEntry[]; total?: string | number }
  // backend may include many extra keys; keep open-ended
  [key: string]: unknown
}

export interface ProfitLossResponse {
  reportName: string
  dateFrom?: string
  dateTo?: string
  company?: { id: number; name: string }
  reportData: ProfitLossReportData
  reportPeriods?: unknown[]
  reportFilters?: unknown
  filters?: unknown
}

function toBackendParams(params: ReportBaseParams) {
  return {
    ...(params.companyId !== undefined ? { company_id: params.companyId } : {}),
    ...(params.dateFrom ? { date_from: params.dateFrom } : {}),
    ...(params.dateTo ? { date_to: params.dateTo } : {}),
    ...(params.comparison !== undefined ? { comparison: params.comparison } : {}),
    ...(params.comparisonType ? { comparison_type: params.comparisonType } : {}),
    ...(params.journalIds?.length ? { journal_ids: params.journalIds } : {}),
    ...(params.analyticIds?.length ? { analytic_ids: params.analyticIds } : {}),
    ...(params.targetMove ? { target_move: params.targetMove } : {}),
  }
}

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
      const response = await apiClient.post(candidate.url, rpcPayload, candidate.baseURL ? { baseURL: candidate.baseURL } : undefined)
      return unwrapResponse<T>(response)
    } catch (err) {
      lastError = err
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Accounting report request failed')
}

// NOTE: backend reality (adt_th_api): accounting reports are exposed under /api/th/v1/accounting/reports/*
export async function getProfitLoss(params: ReportBaseParams) {
  return postWithProdFallback<ProfitLossResponse>(
    '/th/v1/accounting/reports/profit-loss',
    toBackendParams(params),
  )
}

export interface BalanceSheetResponse {
  reportName: string
  dateFrom?: string
  dateTo?: string
  company?: { id: number; name: string }
  reportData: Record<string, unknown>
  reportPeriods?: unknown[]
  reportFilters?: unknown
  filters?: unknown
}

export async function getBalanceSheet(params: ReportBaseParams) {
  return postWithProdFallback<BalanceSheetResponse>(
    '/th/v1/accounting/reports/balance-sheet',
    toBackendParams(params),
  )
}

// ===== Phase 2: Drilldowns =====

export interface GeneralLedgerAccountDrilldownParams extends ReportBaseParams {
  partnerIds?: number[]
  accountIds?: number[]
}

export interface GeneralLedgerAccountMoveLine {
  id: number
  date?: string
  name?: string
  moveName?: string
  debit?: number
  credit?: number
  ref?: string
  partnerId?: { id: number; name: string } | null
  accountId?: { id: number; name: string } | null
  journalId?: { id: number; name: string } | null
  moveId?: { id: number; name: string } | null
  [key: string]: unknown
}

export interface GeneralLedgerAccountDrilldownResponse {
  reportName: string
  account: { id: number; code?: string; name?: string; displayName?: string }
  company?: { id: number; name: string }
  dateFrom?: string
  dateTo?: string
  moveLines: GeneralLedgerAccountMoveLine[]
  totals?: {
    totalDebit?: number
    totalCredit?: number
    balance?: number
    recordCount?: number
    currency?: string
  }
  filters?: unknown
}

export async function getGeneralLedgerAccountDrilldown(accountId: number, params: ReportBaseParams) {
  return postWithProdFallback<GeneralLedgerAccountDrilldownResponse>(
    `/th/v1/accounting/reports/general-ledger/account/${accountId}`,
    toBackendParams(params),
  )
}

export interface PartnerLedgerPartnerMoveLine extends GeneralLedgerAccountMoveLine {
  reconciled?: boolean
  accountType?: string
}

export interface PartnerLedgerPartnerDrilldownResponse {
  reportName: string
  partner: { id: number; name?: string; displayName?: string; vat?: string | null }
  company?: { id: number; name: string }
  dateFrom?: string
  dateTo?: string
  moveLines: PartnerLedgerPartnerMoveLine[]
  totals?: {
    totalDebit?: number
    totalCredit?: number
    balance?: number
    recordCount?: number
    currency?: string
  }
  filters?: unknown
}

export async function getPartnerLedgerPartnerDrilldown(partnerId: number, params: ReportBaseParams) {
  return postWithProdFallback<PartnerLedgerPartnerDrilldownResponse>(
    `/th/v1/accounting/reports/partner-ledger/partner/${partnerId}`,
    toBackendParams(params),
  )
}

export interface MoveLineDetailResponse {
  moveLine: Record<string, unknown>
}

export async function getMoveLineDetail(moveLineId: number) {
  return postWithProdFallback<MoveLineDetailResponse>(
    `/th/v1/accounting/reports/move-lines/${moveLineId}`,
    {},
  )
}

export interface AccountByCodeResponse {
  id: number
  code?: string
  name?: string
  displayName?: string
}

export async function getAccountByCode(code: string) {
  return postWithProdFallback<AccountByCodeResponse>(
    '/th/v1/accounting/reports/accounts/by-code',
    { code },
  )
}

// ===== Phase 2: Base reports for the Accounting Reports hub =====

export interface GenericReportResponse {
  reportName: string
  company?: { id: number; name: string }
  dateFrom?: string
  dateTo?: string
  reportData: unknown
  filters?: unknown
}

export async function getGeneralLedger(params: Record<string, unknown> = {}) {
  return postWithProdFallback<GenericReportResponse>(
    '/th/v1/accounting/reports/general-ledger',
    params,
  )
}

export async function getPartnerLedger(params: Record<string, unknown> = {}) {
  return postWithProdFallback<GenericReportResponse>(
    '/th/v1/accounting/reports/partner-ledger',
    params,
  )
}

export async function getTrialBalance(params: ReportBaseParams) {
  return postWithProdFallback<GenericReportResponse>(
    '/th/v1/accounting/reports/trial-balance',
    toBackendParams(params),
  )
}

export async function getAgedReceivables(params: { companyId?: number; date?: string; partnerIds?: number[]; accountIds?: number[] }) {
  return postWithProdFallback<GenericReportResponse>(
    '/th/v1/accounting/reports/aged-receivables',
    {
      ...(params.companyId !== undefined ? { company_id: params.companyId } : {}),
      ...(params.date ? { date: params.date } : {}),
      ...(params.partnerIds?.length ? { partner_ids: params.partnerIds } : {}),
      ...(params.accountIds?.length ? { account_ids: params.accountIds } : {}),
    },
  )
}

export async function getAgedPayables(params: { companyId?: number; date?: string; partnerIds?: number[]; accountIds?: number[] }) {
  return postWithProdFallback<GenericReportResponse>(
    '/th/v1/accounting/reports/aged-payables',
    {
      ...(params.companyId !== undefined ? { company_id: params.companyId } : {}),
      ...(params.date ? { date: params.date } : {}),
      ...(params.partnerIds?.length ? { partner_ids: params.partnerIds } : {}),
      ...(params.accountIds?.length ? { account_ids: params.accountIds } : {}),
    },
  )
}

export async function getCashBook(params: Record<string, unknown> = {}) {
  return postWithProdFallback<GenericReportResponse>(
    '/th/v1/accounting/reports/cash-book',
    params,
  )
}

export async function getBankBook(params: Record<string, unknown> = {}) {
  return postWithProdFallback<GenericReportResponse>(
    '/th/v1/accounting/reports/bank-book',
    params,
  )
}

// ===== Phase 2: Tax Reports (VAT/WHT) =====

export interface VatReportParams {
  companyId?: number
  taxId: number
  taxType: 'sale' | 'purchase'
  dateFrom: string
  dateTo: string
  showCancel?: boolean
  format?: 'json' | 'pdf' | 'xlsx'
}

export interface WhtReportParams {
  companyId?: number
  whtType: 'pnd1' | 'pnd1a' | 'pnd2' | 'pnd3' | 'pnd53'
  dateFrom: string
  dateTo: string
  showCancel?: boolean
  format?: 'json' | 'pdf' | 'xlsx' | 'text'
}

export async function getVatReport(params: VatReportParams) {
  return postWithProdFallback<GenericReportResponse>(
    '/th/v1/tax-reports/vat',
    {
      ...(params.companyId !== undefined ? { company_id: params.companyId } : {}),
      tax_id: params.taxId,
      tax_type: params.taxType,
      date_from: params.dateFrom,
      date_to: params.dateTo,
      ...(params.showCancel !== undefined ? { show_cancel: params.showCancel } : {}),
      ...(params.format ? { format: params.format } : {}),
    },
  )
}

export async function getWhtReport(params: WhtReportParams) {
  return postWithProdFallback<GenericReportResponse>(
    '/th/v1/tax-reports/wht',
    {
      ...(params.companyId !== undefined ? { company_id: params.companyId } : {}),
      wht_type: params.whtType,
      date_from: params.dateFrom,
      date_to: params.dateTo,
      ...(params.showCancel !== undefined ? { show_cancel: params.showCancel } : {}),
      ...(params.format ? { format: params.format } : {}),
    },
  )
}

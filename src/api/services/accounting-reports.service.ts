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

// NOTE: backend reality (adt_th_api): accounting reports are exposed under /api/th/v1/accounting/reports/*
export async function getProfitLoss(params: ReportBaseParams) {
  const response = await apiClient.post(
    '/th/v1/accounting/reports/profit-loss',
    makeRpc(toBackendParams(params)),
  )
  return unwrapResponse<ProfitLossResponse>(response)
}



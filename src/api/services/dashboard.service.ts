import { apiClient } from '@/api/client'
import { unwrapResponse } from '@/api/response'
import { makeRpc } from '@/api/services/rpc'

export interface DashboardKpisResponse {
  companyId: number
  companyName: string
  period: { from: string; to: string }
  salesInvoices: { postedCount: number; postedTotal: number }
  receivables: {
    openCount: number
    openTotal: number
    overdueCount: number
    overdueTotal: number
  }
}

export interface DashboardKpisParams {
  date_from?: string
  date_to?: string
}

export async function getDashboardKpis(params?: DashboardKpisParams) {
  const response = await apiClient.post('/th/v1/dashboard/kpis', makeRpc(params ?? {}))
  return unwrapResponse<DashboardKpisResponse>(response)
}



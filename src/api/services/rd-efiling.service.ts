import { apiClient } from '@/api/client'
import { unwrapResponse } from '@/api/response'
import { makeRpc } from '@/api/services/rpc'

export type RdEfilingState = 'draft' | 'ready' | 'submitted' | 'accepted' | 'rejected' | 'paid' | 'cancelled'

export interface RdEfilingSubmission {
  id: number
  name: string
  uid?: string
  reportType: string
  periodFrom?: string
  periodTo?: string
  state: RdEfilingState
  sourceChannel?: 'qacc' | 'assistant' | 'line'
  efilingMode?: string
  exportLogId?: number
  attachmentUrl?: string
  rdReference?: string
  paymentUrl?: string
  receiptUrl?: string
  errorMessage?: string
  submittedAt?: string
}

async function post<T>(path: string, payload: Record<string, unknown> = {}) {
  const candidates = [
    { url: path },
    { url: `/api${path}`, baseURL: '' },
    { url: `/web/adt${path}`, baseURL: '' },
  ]
  let lastError: unknown
  for (const candidate of candidates) {
    try {
      const response = await apiClient.post(candidate.url, makeRpc(payload), candidate.baseURL ? { baseURL: candidate.baseURL } : undefined)
      return unwrapResponse<T>(response)
    } catch (err) {
      lastError = err
    }
  }
  throw lastError instanceof Error ? lastError : new Error('RD e-Filing request failed')
}

export async function listReportPrintouts(params: { state?: string; reportType?: string; limit?: number } = {}) {
  return post<{ items: Array<{ id: number; name: string; reportType: string; state: string; attachmentUrl?: string }>; total: number }>(
    '/th/v1/report-printouts/list',
    {
      state: params.state,
      report_type: params.reportType,
      limit: params.limit ?? 50,
    },
  )
}

export async function prepareRdEfilingSubmission(exportLogId: number) {
  return post<{ submission: RdEfilingSubmission }>('/th/v1/rd-efiling/submissions/prepare', {
    export_log_id: exportLogId,
    source_channel: 'qacc',
  })
}

export async function listRdEfilingSubmissions(params: { state?: string; reportType?: string; limit?: number } = {}) {
  return post<{ items: RdEfilingSubmission[]; total: number }>('/th/v1/rd-efiling/submissions/list', {
    state: params.state,
    report_type: params.reportType,
    limit: params.limit ?? 50,
  })
}

export async function submitRdEfilingSubmission(id: number) {
  return post<{ submission: RdEfilingSubmission }>('/th/v1/rd-efiling/submissions/submit', { id })
}

export async function checkRdEfilingStatus(id: number) {
  return post<{ submission: RdEfilingSubmission; status: Record<string, unknown> }>('/th/v1/rd-efiling/submissions/status', { id })
}

export async function cancelRdEfilingSubmission(id: number) {
  return post<{ submission: RdEfilingSubmission }>('/th/v1/rd-efiling/submissions/cancel', { id })
}

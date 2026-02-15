import { apiClient } from '@/api/client'
import { unwrapResponse } from '@/api/response'
import { makeRpc } from '@/api/services/rpc'

export type AssistantMode = 'approve_required' | 'auto_safe' | 'plan_only'

export interface AssistantToolCapability {
  name: string
  allowed: boolean
  requires_approval: boolean
}

export interface AssistantReportRoute {
  key: string
  title: string
  route: string
}

export interface AssistantCapabilities {
  enabled: boolean
  show_bot: boolean
  mode: AssistantMode
  features: Record<string, boolean>
  permissions?: Record<string, { read: boolean; create: boolean; write: boolean }>
  tools: AssistantToolCapability[]
  reports: AssistantReportRoute[]
  session?: {
    company_id?: number
    lang?: string
    user_id?: number
  }
}

export interface AssistantPlanStep {
  id: string
  tool: string
  requires_approval: boolean
  args: Record<string, unknown>
}

export interface AssistantUiAction {
  type: 'OPEN_ROUTE' | 'OPEN_RECORD' | 'SHOW_TOAST' | 'ASK_APPROVAL'
  payload: Record<string, unknown>
}

export interface AssistantRecordRef {
  model: string
  id: number
  name?: string
}

export interface AssistantChatResponse {
  session_id: string
  nonce?: string
  reply: string
  permission_explanations?: string[]
  confirmation_request?: {
    doc_type: 'quotation' | 'invoice' | string
    contact_name: string
    product_name: string
    contact_id?: number
    product_id?: number
    contact_candidates?: Array<{ id: number; name: string; vat?: string }>
    product_candidates?: Array<{ id: number; name: string; code?: string; barcode?: string }>
    qty: number
    summary: string
  } | false
  plan: AssistantPlanStep[]
  ui_actions: AssistantUiAction[]
  records: AssistantRecordRef[]
}

export interface AssistantExecuteResponse {
  session_id: string
  reply?: string
  confirmed?: boolean
  permission_explanations?: string[]
  results: Array<{
    plan_id: string
    tool: string
    status: 'success' | 'error' | 'skipped' | 'denied'
    record?: AssistantRecordRef
    error?: string
  }>
  ui_actions: AssistantUiAction[]
  records: AssistantRecordRef[]
}

export interface AssistantTaskItem {
  session_id: string
  title: string
  tool: string
  status: 'draft' | 'planned' | 'executed' | 'failed' | string
  created_at?: string | null
  source: {
    label: string
    route: string
    model?: string | null
    id?: number | null
  }
}

async function postWithFallback<T>(apiPath: string, webPath: string, payload: Record<string, unknown>) {
  try {
    const response = await apiClient.post(apiPath, makeRpc(payload))
    return unwrapResponse<T>(response)
  } catch {
    // IMPORTANT:
    // webPath must bypass apiClient baseURL (/api), otherwise it becomes
    // /api/web/adt/... and fails on production proxies.
    const response = await apiClient.post(webPath, makeRpc(payload), { baseURL: '' })
    return unwrapResponse<T>(response)
  }
}

export async function getAssistantCapabilities(lang?: string) {
  return postWithFallback<AssistantCapabilities>(
    '/th/v1/ai/capabilities',
    '/web/adt/th/v1/ai/capabilities',
    {
      ...(lang ? { lang } : {}),
    },
  )
}

export async function sendAssistantChat(message: string, context?: Record<string, unknown>) {
  return postWithFallback<AssistantChatResponse>(
    '/th/v1/ai/chat',
    '/web/adt/th/v1/ai/chat',
    {
      message,
      context: context || {},
    },
  )
}

export async function executeAssistantPlan(
  sessionId: string,
  approvedPlanIds: string[],
  nonce?: string,
) {
  return postWithFallback<AssistantExecuteResponse>(
    '/th/v1/ai/execute',
    '/web/adt/th/v1/ai/execute',
    {
      session_id: sessionId,
      approved_plan_ids: approvedPlanIds,
      nonce: nonce || '',
    },
  )
}

export async function getAssistantTasks(limit = 5) {
  return postWithFallback<AssistantTaskItem[]>(
    '/th/v1/ai/tasks',
    '/web/adt/th/v1/ai/tasks',
    { limit },
  )
}

export async function confirmAssistantDocument(payload: {
  session_id: string
  nonce?: string
  confirmed: boolean
  contact_name?: string
  product_name?: string
  contact_id?: number
  product_id?: number
  qty?: number
}) {
  return postWithFallback<AssistantExecuteResponse>(
    '/th/v1/ai/confirm',
    '/web/adt/th/v1/ai/confirm',
    payload,
  )
}

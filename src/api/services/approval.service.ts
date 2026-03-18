import { apiClient } from '@/api/client'
import { unwrapResponse } from '@/api/response'
import { makeRpc } from '@/api/services/rpc'

export interface ApprovalTask {
  model: string
  id: number
  type: string
  typeLabel?: string | null
  name: string
  description?: string | null
  company?: string | null
  requestedByName?: string | null
  assignedToName?: string | null
  approvalTeamName?: string | null
  state?: string | null
  requestedDate?: string | null
  amountTotal?: number
  currency?: string | null
  route?: string | null
  actions?: string[]
}

export interface ApprovalTaskList {
  items: ApprovalTask[]
  total: number
  pendingCount: number
}

const approvalTaskPaths = ['/th/v1/approval/tasks', '/web/adt/th/v1/approval/tasks'] as const

function approvalActionPaths(model: string, id: number) {
  const encodedModel = encodeURIComponent(model)
  return [
    `/th/v1/approval/${encodedModel}/${id}/action`,
    `/web/adt/th/v1/approval/${encodedModel}/${id}/action`,
  ] as const
}

function num(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const parsed = Number(v.replace(/,/g, ''))
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function normalizeTask(raw: unknown): ApprovalTask {
  const item = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const type = String(item.type ?? '')
  return {
    model: String(item.model ?? ''),
    id: num(item.id),
    type,
    typeLabel: item.typeLabel ? String(item.typeLabel) : type === 'purchase_request' ? 'คำขอซื้อ' : type === 'vendor_payment' ? 'อนุมัติจ่ายเงิน' : type || null,
    name: String(item.name ?? ''),
    description: item.description ? String(item.description) : null,
    company: item.company ? String(item.company) : null,
    requestedByName: item.requestedByName ? String(item.requestedByName) : null,
    assignedToName: item.assignedToName ? String(item.assignedToName) : null,
    approvalTeamName: item.approvalTeamName ? String(item.approvalTeamName) : null,
    state: item.state ? String(item.state) : null,
    requestedDate: item.requestedDate ? String(item.requestedDate) : null,
    amountTotal: num(item.amountTotal),
    currency: item.currency ? String(item.currency) : null,
    route: item.route ? String(item.route) : null,
    actions: Array.isArray(item.actions) ? item.actions.map((value) => String(value)) : [],
  }
}

function normalizeTaskList(raw: unknown): ApprovalTaskList {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const items = Array.isArray(obj.items) ? obj.items.map(normalizeTask) : Array.isArray(raw) ? (raw as unknown[]).map(normalizeTask) : []
  return {
    items,
    total: num(obj.total ?? items.length),
    pendingCount: num(obj.pendingCount ?? obj.pending_count ?? items.length),
  }
}

export async function listApprovalTasks(limit = 10) {
  let lastError: unknown
  for (const path of approvalTaskPaths) {
    try {
      const response = await apiClient.post(path, makeRpc({ limit }))
      return normalizeTaskList(unwrapResponse<unknown>(response))
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Failed to load approval tasks')
}

export async function approvalAction(model: string, id: number, action: 'approve' | 'reject' | 'comment', comment?: string) {
  let lastError: unknown
  for (const path of approvalActionPaths(model, id)) {
    try {
      const response = await apiClient.post(
        path,
        makeRpc({
          action,
          ...(comment ? { comment } : {}),
        }),
      )
      return unwrapResponse<{ model: string; id: number; action: string }>(response)
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Failed to process approval action')
}

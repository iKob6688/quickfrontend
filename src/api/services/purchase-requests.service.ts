import { apiClient } from '@/api/client'
import { unwrapResponse } from '@/api/response'
import { makeRpc } from '@/api/services/rpc'

export interface PurchaseRequestLine {
  productId: number | null
  description: string
  quantity: number
  estimatedCost?: number // Estimated unit cost
  uomId?: number | null
  note?: string
}

export interface PurchaseRequestPayload {
  id?: number
  origin?: string // Source document reference
  requestorId?: number // Employee/User who requested (defaults to current user)
  assignedToId?: number | null
  approvalTeamId?: number | null
  requestedDate: string // ISO 8601
  requiredDate?: string // ISO 8601 (expected delivery date)
  lineIds?: PurchaseRequestLine[]
  lines?: PurchaseRequestLine[] // Alias for lineIds
  notes?: string
}

export interface PurchaseRequestApprovalTeamOption {
  id: number
  name: string
  isActive: boolean
  teamLeadId?: number | null
  teamLeadName?: string | null
  approverIds: number[]
  suggestedApproverId?: number | null
  suggestedApproverName?: string | null
}

export interface PurchaseRequestApproverOption {
  id: number
  name: string
  login?: string | null
}

export interface PurchaseRequestMeta {
  approvalTeams: PurchaseRequestApprovalTeamOption[]
  approvers: PurchaseRequestApproverOption[]
  defaultApproverId?: number | null
  defaultApproverName?: string | null
  defaultApprovalTeamId?: number | null
}

export interface PurchaseRequest extends PurchaseRequestPayload {
  id: number
  name?: string // Request number (e.g., PR001)
  requestorName?: string
  assignedToId?: number | null
  assignedToName?: string | null
  approvalTeamId?: number | null
  approvalTeamName?: string | null
  approvalRequestId?: number | null
  approvalRequestState?: string | null
  state: 'draft' | 'to_approve' | 'approved' | 'rejected' | 'done' | 'cancel'
  approverId?: number | null
  approverName?: string | null
  approvalDate?: string | null // ISO 8601
  rejectedReason?: string | null
  purchaseOrderId?: number | null // Related purchase order if converted
  purchaseOrderName?: string | null
  totalEstimatedCost?: number // Sum of estimated costs
  createdAt: string // ISO 8601
  updatedAt: string // ISO 8601
}

export interface PurchaseRequestListItem {
  id: number
  name: string
  requestorName: string
  requestorId: number
  requestedDate: string // ISO 8601
  requiredDate?: string // ISO 8601
  state: 'draft' | 'to_approve' | 'approved' | 'rejected' | 'done' | 'cancel'
  totalEstimatedCost?: number
  totalQuantity?: number
  purchaseOrderName?: string | null
}

export interface ListPurchaseRequestsParams {
  state?: 'draft' | 'to_approve' | 'approved' | 'rejected' | 'done' | 'cancel'
  requestorId?: number
  search?: string
  dateFrom?: string // ISO 8601
  dateTo?: string // ISO 8601
  limit?: number
  offset?: number
}

// NOTE: backend reality (adt_th_api): purchase requests are exposed under /api/th/v1/purchases/requests/*
const basePath = '/th/v1/purchases/requests'

type Raw = Record<string, unknown>

function num(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const parsed = Number(v.replace(/,/g, ''))
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function idOf(v: unknown): number {
  if (!v || typeof v !== 'object') return num(v)
  const obj = v as Raw
  return num(obj.id ?? obj._id ?? (obj.record && typeof obj.record === 'object' ? (obj.record as Raw).id : 0))
}

function textOf(v: unknown): string | undefined {
  if (typeof v === 'string') return v
  if (!v || typeof v !== 'object') return undefined
  const obj = v as Raw
  if (typeof obj.name === 'string') return obj.name
  if (typeof obj.display_name === 'string') return obj.display_name
  return undefined
}

function normalizePurchaseRequest(raw: unknown): PurchaseRequest {
  const wrapped = (raw || {}) as Raw
  const item = (wrapped.request && typeof wrapped.request === 'object'
    ? (wrapped.request as Raw)
    : wrapped) as Raw
  const linesRaw = Array.isArray(item.lines) ? item.lines : Array.isArray(item.lineIds) ? item.lineIds : []
  return {
    id: idOf(item),
    name: item.name ? String(item.name) : undefined,
    requestorName: item.requestorName ? String(item.requestorName) : textOf(item.requestedBy),
    requestorId: num(item.requestorId ?? item.requestor_id ?? idOf(item.requestedBy)),
    requestedDate: String(item.requestedDate ?? item.requested_date ?? item.dateStart ?? item.date_start ?? item.date ?? ''),
    requiredDate: item.requiredDate ? String(item.requiredDate) : item.required_date ? String(item.required_date) : undefined,
    state: (String(item.state || 'draft') as PurchaseRequest['state']),
    origin: item.origin ? String(item.origin) : undefined,
    lines: linesRaw.map((lRaw) => {
      const l = (lRaw || {}) as Raw
      return {
        productId: num(l.productId ?? l.product_id) || null,
        description: String(l.description ?? l.name ?? ''),
        quantity: num(l.quantity),
        estimatedCost: num(l.estimatedCost ?? l.estimated_cost),
        uomId: num(l.uomId ?? l.uom_id ?? idOf(l.uom)) || null,
        note: l.note ? String(l.note) : l.specifications ? String(l.specifications) : undefined,
      }
    }),
    notes: item.notes ? String(item.notes) : item.description ? String(item.description) : undefined,
    assignedToId: num(item.assignedToId ?? item.assigned_to_id ?? idOf(item.assignedTo)) || null,
    assignedToName: item.assignedToName ? String(item.assignedToName) : textOf(item.assignedTo) ?? null,
    approvalTeamId: num(item.approvalTeamId ?? item.approval_team_id ?? idOf(item.approvalTeam)) || null,
    approvalTeamName: item.approvalTeamName ? String(item.approvalTeamName) : textOf(item.approvalTeam) ?? null,
    approvalRequestId: num(item.approvalRequestId ?? item.approval_request_id) || null,
    approvalRequestState:
      item.approvalRequestState ? String(item.approvalRequestState) : item.approval_request_state ? String(item.approval_request_state) : null,
    approverId: num(item.approverId ?? item.approver_id) || null,
    approverName: item.approverName ? String(item.approverName) : null,
    approvalDate: item.approvalDate ? String(item.approvalDate) : null,
    rejectedReason: item.rejectedReason ? String(item.rejectedReason) : null,
    purchaseOrderId: num(item.purchaseOrderId ?? item.purchase_order_id) || null,
    purchaseOrderName: item.purchaseOrderName ? String(item.purchaseOrderName) : null,
    totalEstimatedCost: num(item.totalEstimatedCost ?? item.total_estimated_cost ?? item.estimatedCost ?? item.estimated_cost),
    createdAt: String(item.createdAt ?? item.created_at ?? item.create_date ?? ''),
    updatedAt: String(item.updatedAt ?? item.updated_at ?? item.write_date ?? ''),
  }
}

function toBackendPayload(payload: PurchaseRequestPayload) {
  const lines = (payload.lines ?? payload.lineIds ?? []).map((line) => {
    const linePayload: Record<string, unknown> = {
      name: (line.description || '').trim(),
      quantity: Number(line.quantity || 0),
      estimatedCost: Number(line.estimatedCost || 0),
      dateRequired: payload.requiredDate || undefined,
      specifications: line.note ? line.note.trim() : undefined,
    }
    if (line.productId) linePayload.productId = line.productId
    if (line.uomId) linePayload.productUomId = line.uomId
    return linePayload
  })

  return {
    origin: payload.origin?.trim() || undefined,
    description: payload.notes?.trim() || undefined,
    requestedDate: payload.requestedDate,
    requiredDate: payload.requiredDate || undefined,
    requestedById: payload.requestorId || undefined,
    assignedToId: payload.assignedToId || undefined,
    approvalTeamId: payload.approvalTeamId || undefined,
    lines,
  }
}

function normalizePurchaseRequestMeta(raw: unknown): PurchaseRequestMeta {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Raw
  const approvalTeams = Array.isArray(obj.approvalTeams)
    ? obj.approvalTeams.map((item) => {
        const team = (item && typeof item === 'object' ? item : {}) as Raw
        return {
          id: idOf(team),
          name: String(team.name ?? ''),
          isActive: Boolean(team.isActive ?? true),
          teamLeadId: num(team.teamLeadId) || null,
          teamLeadName: team.teamLeadName ? String(team.teamLeadName) : null,
          approverIds: Array.isArray(team.approverIds) ? team.approverIds.map((value) => num(value)).filter(Boolean) : [],
          suggestedApproverId: num(team.suggestedApproverId) || null,
          suggestedApproverName: team.suggestedApproverName ? String(team.suggestedApproverName) : null,
        }
      })
    : []

  const approvers = Array.isArray(obj.approvers)
    ? obj.approvers.map((item) => {
        const user = (item && typeof item === 'object' ? item : {}) as Raw
        return {
          id: idOf(user),
          name: String(user.name ?? ''),
          login: user.login ? String(user.login) : null,
        }
      })
    : []

  return {
    approvalTeams,
    approvers,
    defaultApproverId: num(obj.defaultApproverId) || null,
    defaultApproverName: obj.defaultApproverName ? String(obj.defaultApproverName) : null,
    defaultApprovalTeamId: num(obj.defaultApprovalTeamId) || null,
  }
}

function normalizePurchaseRequestList(raw: unknown): PurchaseRequestListItem[] {
  if (Array.isArray(raw)) {
    return raw
      .map((r) => normalizePurchaseRequest(r))
      .filter((r) => r.id > 0)
      .map((r) => ({
        id: r.id,
        name: r.name || '',
        requestorName: r.requestorName || '',
        requestorId: r.requestorId || 0,
        requestedDate: r.requestedDate || '',
        requiredDate: r.requiredDate,
        state: r.state,
        totalEstimatedCost: r.totalEstimatedCost,
        totalQuantity: (r.lines || []).reduce((sum, line) => sum + num(line.quantity), 0),
        purchaseOrderName: r.purchaseOrderName,
      }))
  }
  if (!raw || typeof raw !== 'object') return []

  const obj = raw as Record<string, unknown>
  const candidates = [
    obj.items,
    obj.rows,
    obj.records,
    obj.data,
    obj.results,
    obj.purchase_requests,
    obj.list,
  ]

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return normalizePurchaseRequestList(candidate)
  }

  return []
}

export async function listPurchaseRequests(params?: ListPurchaseRequestsParams) {
  const body = makeRpc({
    ...(params?.state && { state: params.state }),
    ...(params?.requestorId && { requestor_id: params.requestorId }),
    ...(params?.search && { search: params.search }),
    ...(params?.limit && { limit: params.limit }),
    ...(params?.offset && { offset: params.offset }),
    ...(params?.dateFrom && { date_from: params.dateFrom }),
    ...(params?.dateTo && { date_to: params.dateTo }),
  })
  const response = await apiClient.post(`${basePath}/list`, body)
  const data = unwrapResponse<unknown>(response)
  return normalizePurchaseRequestList(data)
}

export async function getPurchaseRequest(id: number) {
  const body = makeRpc({ id })
  const response = await apiClient.post(`${basePath}/${id}`, body)
  return normalizePurchaseRequest(unwrapResponse<unknown>(response))
}

export async function getPurchaseRequestMeta() {
  const body = makeRpc({})
  const response = await apiClient.post(`${basePath}/meta`, body)
  return normalizePurchaseRequestMeta(unwrapResponse<unknown>(response))
}

export async function createPurchaseRequest(payload: PurchaseRequestPayload) {
  const body = makeRpc(toBackendPayload(payload))
  const response = await apiClient.post(basePath, body)
  return normalizePurchaseRequest(unwrapResponse<unknown>(response))
}

export async function updatePurchaseRequest(id: number, payload: PurchaseRequestPayload) {
  const body = makeRpc({ id, ...toBackendPayload(payload) })
  const response = await apiClient.put(`${basePath}/${id}`, body)
  return normalizePurchaseRequest(unwrapResponse<unknown>(response))
}

export async function submitPurchaseRequest(id: number) {
  const body = makeRpc({ id })
  const response = await apiClient.post(`${basePath}/${id}/submit`, body)
  return normalizePurchaseRequest(unwrapResponse<unknown>(response))
}

export async function approvePurchaseRequest(id: number) {
  const body = makeRpc({ id })
  const response = await apiClient.post(`${basePath}/${id}/approve`, body)
  return normalizePurchaseRequest(unwrapResponse<unknown>(response))
}

export async function rejectPurchaseRequest(id: number, reason?: string) {
  const body = makeRpc({ id, ...(reason && { reason }) })
  const response = await apiClient.post(`${basePath}/${id}/reject`, body)
  return normalizePurchaseRequest(unwrapResponse<unknown>(response))
}

export async function cancelPurchaseRequest(id: number) {
  const body = makeRpc({ id })
  const response = await apiClient.post(`${basePath}/${id}/cancel`, body)
  return normalizePurchaseRequest(unwrapResponse<unknown>(response))
}

export interface ConvertToPurchaseOrderPayload {
  vendorId?: number
  orderDate?: string // ISO 8601 (defaults to today)
  expectedDate?: string // ISO 8601
}

export interface ConvertToPurchaseOrderResult {
  requestId: number
  purchaseOrderId: number
  purchaseOrderName?: string
}

export async function convertToPurchaseOrder(
  id: number,
  payload: ConvertToPurchaseOrderPayload,
) {
  const body = makeRpc({ id, ...payload })
  const response = await apiClient.post(`${basePath}/${id}/convert-to-po`, body)
  const raw = unwrapResponse<unknown>(response) as Raw
  const purchaseOrder = (raw.purchaseOrder && typeof raw.purchaseOrder === 'object'
    ? (raw.purchaseOrder as Raw)
    : {}) as Raw

  return {
    requestId: num(raw.requestId ?? raw.purchaseRequestId ?? raw.id),
    purchaseOrderId: num(raw.purchaseOrderId ?? idOf(purchaseOrder)),
    purchaseOrderName:
      (typeof raw.purchaseOrderName === 'string' ? raw.purchaseOrderName : undefined) ||
      (typeof purchaseOrder.name === 'string' ? purchaseOrder.name : undefined),
  } satisfies ConvertToPurchaseOrderResult
}

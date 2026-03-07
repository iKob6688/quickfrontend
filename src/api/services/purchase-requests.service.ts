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
  requestedDate: string // ISO 8601
  requiredDate?: string // ISO 8601 (expected delivery date)
  lineIds?: PurchaseRequestLine[]
  lines?: PurchaseRequestLine[] // Alias for lineIds
  notes?: string
}

export interface PurchaseRequest extends PurchaseRequestPayload {
  id: number
  name?: string // Request number (e.g., PR001)
  requestorName?: string
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

function normalizePurchaseRequest(raw: unknown): PurchaseRequest {
  const wrapped = (raw || {}) as Raw
  const item = (wrapped.request && typeof wrapped.request === 'object'
    ? (wrapped.request as Raw)
    : wrapped) as Raw
  const linesRaw = Array.isArray(item.lines) ? item.lines : Array.isArray(item.lineIds) ? item.lineIds : []
  return {
    id: idOf(item),
    name: item.name ? String(item.name) : undefined,
    requestorName: item.requestorName ? String(item.requestorName) : undefined,
    requestorId: num(item.requestorId ?? item.requestor_id),
    requestedDate: String(item.requestedDate ?? item.requested_date ?? item.date ?? ''),
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
        uomId: num(l.uomId ?? l.uom_id) || null,
        note: l.note ? String(l.note) : undefined,
      }
    }),
    notes: item.notes ? String(item.notes) : undefined,
    approverId: num(item.approverId ?? item.approver_id) || null,
    approverName: item.approverName ? String(item.approverName) : null,
    approvalDate: item.approvalDate ? String(item.approvalDate) : null,
    rejectedReason: item.rejectedReason ? String(item.rejectedReason) : null,
    purchaseOrderId: num(item.purchaseOrderId ?? item.purchase_order_id) || null,
    purchaseOrderName: item.purchaseOrderName ? String(item.purchaseOrderName) : null,
    totalEstimatedCost: num(item.totalEstimatedCost ?? item.total_estimated_cost),
    createdAt: String(item.createdAt ?? item.created_at ?? item.create_date ?? ''),
    updatedAt: String(item.updatedAt ?? item.updated_at ?? item.write_date ?? ''),
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

export async function createPurchaseRequest(payload: PurchaseRequestPayload) {
  const body = makeRpc(payload)
  const response = await apiClient.post(basePath, body)
  return normalizePurchaseRequest(unwrapResponse<unknown>(response))
}

export async function updatePurchaseRequest(id: number, payload: PurchaseRequestPayload) {
  const body = makeRpc({ id, ...payload })
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
  vendorId: number
  orderDate?: string // ISO 8601 (defaults to today)
  expectedDate?: string // ISO 8601
}

export async function convertToPurchaseOrder(
  id: number,
  payload: ConvertToPurchaseOrderPayload,
) {
  const body = makeRpc({ id, ...payload })
  const response = await apiClient.post(`${basePath}/${id}/convert-to-po`, body)
  return unwrapResponse<{ purchaseRequestId: number; purchaseOrderId: number; purchaseOrderName?: string }>(response)
}

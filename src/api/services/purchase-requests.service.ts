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
  return unwrapResponse<PurchaseRequestListItem[]>(response)
}

export async function getPurchaseRequest(id: number) {
  const body = makeRpc({ id })
  const response = await apiClient.post(`${basePath}/${id}`, body)
  return unwrapResponse<PurchaseRequest>(response)
}

export async function createPurchaseRequest(payload: PurchaseRequestPayload) {
  const body = makeRpc(payload)
  const response = await apiClient.post(basePath, body)
  return unwrapResponse<PurchaseRequest>(response)
}

export async function updatePurchaseRequest(id: number, payload: PurchaseRequestPayload) {
  const body = makeRpc({ id, ...payload })
  const response = await apiClient.put(`${basePath}/${id}`, body)
  return unwrapResponse<PurchaseRequest>(response)
}

export async function submitPurchaseRequest(id: number) {
  const body = makeRpc({ id })
  const response = await apiClient.post(`${basePath}/${id}/submit`, body)
  return unwrapResponse<PurchaseRequest>(response)
}

export async function approvePurchaseRequest(id: number) {
  const body = makeRpc({ id })
  const response = await apiClient.post(`${basePath}/${id}/approve`, body)
  return unwrapResponse<PurchaseRequest>(response)
}

export async function rejectPurchaseRequest(id: number, reason?: string) {
  const body = makeRpc({ id, ...(reason && { reason }) })
  const response = await apiClient.post(`${basePath}/${id}/reject`, body)
  return unwrapResponse<PurchaseRequest>(response)
}

export async function cancelPurchaseRequest(id: number) {
  const body = makeRpc({ id })
  const response = await apiClient.post(`${basePath}/${id}/cancel`, body)
  return unwrapResponse<PurchaseRequest>(response)
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


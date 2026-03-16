import type { AxiosResponse } from 'axios'
import { apiClient } from '@/api/client'
import { ApiError } from '@/api/response'
import { makeRpc } from '@/api/services/rpc'

export type DocumentReviewState =
  | 'pending'
  | 'classifying'
  | 'extracting'
  | 'normalizing'
  | 'validating'
  | 'suggesting'
  | 'ready_for_review'
  | 'linked'
  | 'error'

export type DocumentReviewStatus =
  | 'pending_review'
  | 'in_review'
  | 'confirmed'
  | 'unsupported'
  | 'draft_created'

export type DocumentType =
  | 'receipt'
  | 'tax_invoice'
  | 'vendor_invoice'
  | 'payment_slip'
  | 'unknown_document'

export type SuggestedTarget = 'vendor_bill' | 'expense' | 'review_only'

export interface DocumentReviewIssue {
  id: number
  code: string
  severity: 'info' | 'warning' | 'blocking'
  field_name?: string
  message: string
  suggested_action?: string
}

export interface AccountingSuggestionCandidate {
  id: number
  name: string
  code?: string
  vat?: string
  state_id?: number
  state_name?: string
  amount?: number
  confidence: number
  reason: string
}

export interface AccountingSuggestion {
  id: number
  name: string
  state: 'draft' | 'reviewed' | 'confirmed' | 'applied' | 'error'
  suggested_target: SuggestedTarget
  suggested_document_type: DocumentType
  suggested_partner_id?: number
  suggested_partner_name?: string
  suggested_account_id?: number
  suggested_account_code?: string
  suggested_account_name?: string
  suggested_tax_ids: number[]
  suggested_taxes: Array<{ id: number; name: string; amount?: number }>
  suggested_journal_id?: number
  suggested_journal_name?: string
  suggested_analytic_account_id?: number
  suggested_analytic_account_name?: string
  partner_confidence?: number
  account_confidence?: number
  tax_confidence?: number
  journal_confidence?: number
  analytic_confidence?: number
  confidence_score?: number
  suggestion_explanation?: string
  reasoning_json?: string
  validation_flags_json?: string
  partner_candidates: AccountingSuggestionCandidate[]
  account_candidates: AccountingSuggestionCandidate[]
  tax_candidates: AccountingSuggestionCandidate[]
  journal_candidates: AccountingSuggestionCandidate[]
  analytic_candidates: AccountingSuggestionCandidate[]
  duplicate_summary?: string
  correction_count?: number
  confirmed_by?: string
  confirmed_at?: string
  applied_model?: string
  applied_res_id?: number
}

export interface DocumentReviewAttachment {
  id: number
  name: string
  mimetype?: string
  preview_url: string
  download_url: string
}

export interface DocumentReviewListItem {
  id: number
  name: string
  intake_id: number
  intake_name?: string
  state: DocumentReviewState
  review_state: DocumentReviewStatus
  document_type: DocumentType
  classification_confidence?: number
  vendor_name?: string
  document_number?: string
  document_date?: string
  total_amount?: number
  currency_name?: string
  suggested_target: SuggestedTarget
  suggestion_confidence?: number
  matched_partner_id?: number
  matched_partner_name?: string
  matched_partner_vat?: string
  matched_partner_state_name?: string
  issue_count: number
  blocking_issue_count: number
  attachment_count?: number
  preview_attachment_id?: number
}

export interface DocumentReviewDetail {
  id: number
  name: string
  state: DocumentReviewState
  review_state: DocumentReviewStatus
  provider_key?: string
  provider_version?: string
  document_type: DocumentType
  classification_confidence?: number
  raw_text?: string
  raw_extraction_json?: string
  vendor_name?: string
  vendor_tax_id?: string
  document_number?: string
  document_date?: string
  currency_id?: number
  currency_name?: string
  subtotal_amount?: number
  tax_amount?: number
  total_amount?: number
  detected_company_name?: string
  detected_branch_name?: string
  line_items_json?: string
  validation_summary?: string
  matching_summary?: string
  suggested_target: SuggestedTarget
  suggestion_confidence?: number
  linked_model?: string
  linked_res_id?: number
  matched_partner_id?: number
  matched_partner_name?: string
  matched_partner_vat?: string
  matched_partner_state_name?: string
  reviewed_by?: string
  reviewed_at?: string
  draft_created_at?: string
  attachment_ids: number[]
  attachments: DocumentReviewAttachment[]
  issues: DocumentReviewIssue[]
  accounting_suggestion?: AccountingSuggestion
}

export interface DocumentReviewListResponse {
  total: number
  count: number
  items: DocumentReviewListItem[]
}

export interface DocumentReviewListParams {
  limit?: number
  offset?: number
  states?: DocumentReviewState[]
  review_states?: DocumentReviewStatus[]
  search?: string
}

export interface DocumentReviewUpdatePayload {
  vendor_name?: string
  vendor_tax_id?: string
  document_number?: string
  document_date?: string | null
  subtotal_amount?: number | null
  tax_amount?: number | null
  total_amount?: number | null
  document_type?: DocumentType
  review_state?: DocumentReviewStatus
  matched_partner_id?: number | null
}

export interface AccountingSuggestionUpdatePayload {
  suggested_partner_id?: number | null
  suggested_account_id?: number | null
  suggested_tax_ids?: number[]
  suggested_journal_id?: number | null
  suggested_analytic_account_id?: number | null
}

type ReviewPayload<T> = T & {
  success: boolean
  error?: string | { message?: string; code?: string; details?: unknown } | null
}

function unwrapReviewPayload<T>(response: AxiosResponse<unknown>): T {
  const raw = response.data as { jsonrpc?: string; result?: unknown } | undefined
  const payload = (raw && raw.jsonrpc === '2.0' ? raw.result : raw) as ReviewPayload<T> | undefined
  if (!payload || payload.success !== true) {
    const error = payload?.error
    if (typeof error === 'string') {
      throw new ApiError(error)
    }
    throw new ApiError(error?.message || 'Unexpected review API response', {
      code: error?.code,
      details: error?.details,
    })
  }
  return payload
}

export async function listDocumentReviewItems(params: DocumentReviewListParams) {
  const response = await apiClient.post(
    '/line/review/items',
    makeRpc({
      ...(params.limit !== undefined ? { limit: params.limit } : {}),
      ...(params.offset !== undefined ? { offset: params.offset } : {}),
      ...(params.states?.length ? { states: params.states } : {}),
      ...(params.review_states?.length ? { review_states: params.review_states } : {}),
      ...(params.search ? { search: params.search } : {}),
    }),
  )
  const payload = unwrapReviewPayload<DocumentReviewListResponse>(response)
  return {
    total: payload.total ?? payload.count ?? payload.items.length,
    count: payload.count ?? payload.items.length,
    items: payload.items ?? [],
  }
}

export async function getDocumentReviewDetail(extractionId: number) {
  const response = await apiClient.post('/line/review/detail', makeRpc({ extraction_id: extractionId }))
  const payload = unwrapReviewPayload<{ item: DocumentReviewDetail }>(response)
  return payload.item
}

export async function updateDocumentReview(extractionId: number, values: DocumentReviewUpdatePayload) {
  const response = await apiClient.post('/line/review/update', makeRpc({ extraction_id: extractionId, values }))
  return unwrapReviewPayload<{ updated: boolean; reviewed_by?: string; reviewed_at?: string }>(response)
}

export async function updateAccountingSuggestion(
  extractionId: number,
  suggestionValues: AccountingSuggestionUpdatePayload,
  values?: DocumentReviewUpdatePayload,
) {
  const response = await apiClient.post(
    '/line/review/update',
    makeRpc({
      extraction_id: extractionId,
      ...(values ? { values } : {}),
      suggestion_values: suggestionValues,
    }),
  )
  return unwrapReviewPayload<{
    updated: boolean
    reviewed_by?: string
    reviewed_at?: string
    accounting_suggestion?: AccountingSuggestion
  }>(response)
}

export async function retryDocumentReview(extractionId: number) {
  const response = await apiClient.post('/line/review/retry', makeRpc({ extraction_id: extractionId }))
  return unwrapReviewPayload<{ state: DocumentReviewState; review_state: DocumentReviewStatus }>(response)
}

export async function markDocumentUnsupported(extractionId: number) {
  const response = await apiClient.post('/line/review/mark-unsupported', makeRpc({ extraction_id: extractionId }))
  return unwrapReviewPayload<{ state: DocumentReviewState; review_state: DocumentReviewStatus }>(response)
}

export async function createDocumentDraft(extractionId: number) {
  const response = await apiClient.post('/line/review/create-draft', makeRpc({ extraction_id: extractionId }))
  return unwrapReviewPayload<{ linked_model?: string; linked_res_id?: number; linked_move_id?: number }>(response)
}

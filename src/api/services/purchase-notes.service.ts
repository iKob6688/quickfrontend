import { apiClient } from '@/api/client'
import { unwrapResponse } from '@/api/response'
import { makeRpc } from '@/api/services/rpc'

export type NoteType = 'credit' | 'debit'
export type NoteStatus = 'draft' | 'posted' | 'paid' | 'cancelled'

export type NotePartner = { id: number; name: string }

export type NoteLine = {
  id: number
  product?: { id: number | null; name: string; code?: string }
  description: string
  quantity: number
  unitPrice: number
  discount?: number
  subtotal: number
  taxes?: Array<{ id: number; name: string }>
  uom?: { id: number | null; name: string }
}

export type PurchaseNoteListItem = {
  id: number
  number: string
  noteType: NoteType
  moveType: string
  status: NoteStatus
  partner: NotePartner
  documentDate?: string | null
  dueDate?: string | null
  currency: string
  amountUntaxed: number
  amountTax: number
  amountTotal: number
  sign: 1 | -1
  originalMoveId?: number | null
  originalMoveNumber?: string
}

export type PurchaseNoteDetail = PurchaseNoteListItem & {
  ref?: string
  invoiceOrigin?: string
  notes?: string
  lines: NoteLine[]
}

export type NoteLineInput = {
  productId: number | null
  description: string
  quantity: number
  unitPrice: number
  taxRate?: number
}

export async function listPurchaseNotes(params: {
  type?: NoteType
  partnerId?: number
  dateFrom?: string
  dateTo?: string
  limit?: number
  offset?: number
}) {
  const response = await apiClient.post(
    '/th/v1/purchases/notes',
    makeRpc({
      ...(params.type ? { type: params.type } : {}),
      ...(params.partnerId ? { partnerId: params.partnerId } : {}),
      ...(params.dateFrom ? { dateFrom: params.dateFrom } : {}),
      ...(params.dateTo ? { dateTo: params.dateTo } : {}),
      ...(params.limit != null ? { limit: params.limit } : {}),
      ...(params.offset != null ? { offset: params.offset } : {}),
    }),
  )
  return unwrapResponse<{ rows: PurchaseNoteListItem[]; count: number }>(response)
}

export async function getPurchaseNote(noteId: number) {
  const response = await apiClient.post(`/th/v1/purchases/notes/${noteId}`, makeRpc({ noteId }))
  return unwrapResponse<PurchaseNoteDetail>(response)
}

export async function postPurchaseNote(noteId: number) {
  const response = await apiClient.post(`/th/v1/purchases/notes/${noteId}/post`, makeRpc({ noteId }))
  return unwrapResponse<PurchaseNoteDetail>(response)
}

export async function cancelPurchaseNote(noteId: number) {
  const response = await apiClient.post(`/th/v1/purchases/notes/${noteId}/cancel`, makeRpc({ noteId }))
  return unwrapResponse<PurchaseNoteDetail>(response)
}

export async function createPurchaseCreditNote(
  billId: number,
  input: { reason: string; mode?: 'full' | 'delta'; lines?: NoteLineInput[]; post?: boolean; force?: boolean },
) {
  const response = await apiClient.post(
    `/th/v1/purchases/bills/${billId}/credit-note`,
    makeRpc({
      reason: input.reason,
      mode: input.mode ?? 'full',
      ...(input.mode === 'delta' ? { deltaLines: input.lines || [] } : {}),
      ...(input.post ? { post: true } : {}),
      ...(input.force ? { force: true } : {}),
    }),
  )
  return unwrapResponse<{ noteId: number | null; note?: PurchaseNoteDetail | null }>(response)
}

export async function createPurchaseDebitNote(
  billId: number,
  input: { reason: string; lines: NoteLineInput[]; post?: boolean; force?: boolean },
) {
  const response = await apiClient.post(
    `/th/v1/purchases/bills/${billId}/debit-note`,
    makeRpc({
      reason: input.reason,
      lines: input.lines,
      ...(input.post ? { post: true } : {}),
      ...(input.force ? { force: true } : {}),
    }),
  )
  return unwrapResponse<{ noteId: number; note?: PurchaseNoteDetail | null }>(response)
}


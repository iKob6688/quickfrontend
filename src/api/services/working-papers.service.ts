import { apiClient } from '@/api/client'
import { ApiError, toApiError, unwrapResponse } from '@/api/response'
import { makeRpc } from '@/api/services/rpc'

type RecordValue = Record<string, unknown>
const record = (value: unknown): RecordValue => value && typeof value === 'object' ? value as RecordValue : {}
const text = (value: RecordValue, ...keys: string[]) => {
  for (const key of keys) { const item = value[key]; if (typeof item === 'string' || typeof item === 'number') return String(item) }
  return undefined
}
const number = (value: RecordValue, ...keys: string[]) => {
  for (const key of keys) { const item = Number(value[key]); if (Number.isFinite(item)) return item }
  return undefined
}
const relation = (value: unknown) => Array.isArray(value) ? String(value[1] || '') : typeof value === 'object' && value ? text(record(value), 'name', 'display_name', 'displayName') : typeof value === 'string' ? value : undefined

export interface WorkFile {
  id: string; reference: string; name: string; clientName?: string; companyName?: string; period?: string
  dateFrom?: string; dateTo?: string; status?: string; preparedProgress?: number; reviewedProgress?: number
  tbVersion?: string; openReviewNotes?: number; preparerName?: string; reviewerName?: string; updatedAt?: string
  capabilities: Record<string, boolean>
}
export interface Workpaper extends WorkFile { objective?: string; procedure?: string; result?: string; conclusion?: string; evidenceCount?: number; preparedBy?: string; preparedAt?: string; reviewedBy?: string; reviewedAt?: string }
export interface WorkFileList { items: WorkFile[]; total: number }
export interface WorkingPaperSection { rows: RecordValue[]; total: number }

function mapFile(value: unknown): WorkFile {
  const item = record(value); const caps = record(item.capabilities ?? item.allowed_actions)
  return { id: text(item, 'id', 'work_file_id', 'workFileId') || '', reference: text(item, 'reference', 'code', 'name') || '', name: text(item, 'name', 'display_name', 'displayName', 'reference') || 'Work File', clientName: text(item, 'client_name', 'clientName') || relation(item.client_id ?? item.clientId), companyName: text(item, 'company_name', 'companyName') || relation(item.company_id ?? item.companyId), period: text(item, 'period', 'fiscal_year', 'fiscalYear'), dateFrom: text(item, 'date_from', 'dateFrom'), dateTo: text(item, 'date_to', 'dateTo'), status: text(item, 'status', 'state'), preparedProgress: number(item, 'prepared_progress', 'preparedProgress'), reviewedProgress: number(item, 'reviewed_progress', 'reviewedProgress'), tbVersion: text(item, 'tb_version', 'tbVersion'), openReviewNotes: number(item, 'open_review_notes', 'openReviewNotes'), preparerName: text(item, 'preparer_name', 'preparerName') || relation(item.preparer_id ?? item.preparerId), reviewerName: text(item, 'reviewer_name', 'reviewerName') || relation(item.reviewer_id ?? item.reviewerId), updatedAt: text(item, 'updated_at', 'updatedAt', 'write_date'), capabilities: Object.fromEntries(Object.entries(caps).map(([key, allowed]) => [key, Boolean(allowed)])) }
}
function mapList(value: unknown): WorkFileList { const result = record(value); const values = Array.isArray(value) ? value : Array.isArray(result.items) ? result.items : Array.isArray(result.records) ? result.records : []; return { items: values.map(mapFile).filter((item) => item.id), total: number(result, 'total', 'count') ?? values.length } }

async function request<T>(path: string, payload: RecordValue = {}): Promise<T> {
  try { return unwrapResponse<T>(await apiClient.post(`/th/v1/working-papers${path}`, makeRpc(payload))) }
  catch (error) { const apiError = toApiError(error); if ([404, 405, 501].includes(apiError.status ?? 0)) throw new ApiError('Working Papers ยังไม่ได้เปิด API สำหรับบริษัทนี้', { status: apiError.status }); throw apiError }
}

export async function listWorkFiles(filters: { search?: string; status?: string; page?: number; pageSize?: number } = {}) { return mapList(await request<unknown>('/work-files', { ...(filters.search ? { search: filters.search } : {}), ...(filters.status ? { status: filters.status } : {}), ...(filters.page ? { page: filters.page } : {}), ...(filters.pageSize ? { page_size: filters.pageSize } : {}) })) }
export async function getWorkFile(id: string) { return mapFile(await request<unknown>(`/work-files/${encodeURIComponent(id)}`)) }
export async function createWorkFile(payload: RecordValue) { return mapFile(await request<unknown>('/work-files', payload)) }
export async function getWorkFileSection(id: string, section: 'trial-balance' | 'leadsheets' | 'workpapers' | 'adjustments' | 'review-notes' | 'evidence' | 'activity') { const raw = await request<unknown>(`/work-files/${encodeURIComponent(id)}/${section}`); const result = record(raw); const rows = Array.isArray(raw) ? raw : Array.isArray(result.items) ? result.items : Array.isArray(result.rows) ? result.rows : Array.isArray(result.records) ? result.records : []; return { rows: rows.map(record), total: number(result, 'total', 'count') ?? rows.length } }
export async function runWorkFileAction(id: string, action: 'generate-snapshot' | 'complete' | 'reopen' | 'roll-forward', payload: RecordValue = {}) { return mapFile(await request<unknown>(`/work-files/${encodeURIComponent(id)}/${action}`, payload)) }
export async function getWorkpaper(id: string) { const response = await request<unknown>(`/workpapers/${encodeURIComponent(id)}`); const base = mapFile(response); const raw = record(response); return { ...base, objective: text(raw, 'objective'), procedure: text(raw, 'procedure'), result: text(raw, 'result'), conclusion: text(raw, 'conclusion'), evidenceCount: number(raw, 'evidence_count', 'evidenceCount'), preparedBy: text(raw, 'prepared_by_name', 'preparedBy'), preparedAt: text(raw, 'prepared_at', 'preparedAt'), reviewedBy: text(raw, 'reviewed_by_name', 'reviewedBy'), reviewedAt: text(raw, 'reviewed_at', 'reviewedAt') } }
export async function saveWorkpaper(id: string, payload: RecordValue) { return request<unknown>(`/workpapers/${encodeURIComponent(id)}`, payload) }
export async function runWorkpaperAction(id: string, action: 'prepare' | 'review', payload: RecordValue = {}) { return request<unknown>(`/workpapers/${encodeURIComponent(id)}/${action}`, payload) }

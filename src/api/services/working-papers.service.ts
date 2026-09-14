import { apiClient } from '@/api/client'
import { ApiError, toApiError, unwrapResponse } from '@/api/response'
import { makeRpc } from '@/api/services/rpc'

export type RecordValue = Record<string, unknown>
export type CapabilityMap = Record<string, boolean>

const record = (value: unknown): RecordValue => value && typeof value === 'object' ? value as RecordValue : {}
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : []
const text = (value: RecordValue, ...keys: string[]) => {
  for (const key of keys) {
    const item = value[key]
    if (typeof item === 'string' || typeof item === 'number') return String(item)
  }
  return undefined
}
const number = (value: RecordValue, ...keys: string[]) => {
  for (const key of keys) {
    const item = Number(value[key])
    if (Number.isFinite(item)) return item
  }
  return undefined
}
const bool = (value: RecordValue, ...keys: string[]) => {
  for (const key of keys) {
    if (typeof value[key] === 'boolean') return value[key] as boolean
  }
  return undefined
}
const relation = (value: unknown) => {
  if (Array.isArray(value)) return String(value[1] || '')
  if (value && typeof value === 'object') return text(record(value), 'name', 'display_name', 'displayName')
  if (typeof value === 'string') return value
  return undefined
}
const capabilities = (value: RecordValue): CapabilityMap => {
  const raw = record(value.capabilities ?? value.allowed_actions)
  return Object.fromEntries(Object.entries(raw).map(([key, allowed]) => [key, Boolean(allowed)]))
}

export interface WorkFile {
  id: string
  reference: string
  name: string
  clientName?: string
  companyName?: string
  period?: string
  dateFrom?: string
  dateTo?: string
  status?: string
  preparerName?: string
  reviewerName?: string
  preparedProgress?: number
  reviewedProgress?: number
  tbVersion?: string
  tbStatus?: string
  openReviewNotes?: number
  updatedAt?: string
  capabilities: CapabilityMap
  raw: RecordValue
}

export interface WorkFileList {
  items: WorkFile[]
  total: number
}

export interface TbLine {
  id: string
  accountId?: number
  accountCode?: string
  accountName?: string
  debit?: number
  credit?: number
  net?: number
  closing?: number
  mapping?: string
  leadsheet?: string
  raw: RecordValue
}

export interface TrialBalanceSnapshot {
  id?: string
  version?: string
  status?: string
  generatedAt?: string
  sealedAt?: string
  period?: string
  rows: TbLine[]
  total: number
  raw: RecordValue
}

export interface Leadsheet {
  id: string
  reference?: string
  name?: string
  currentAmount?: number
  priorAmount?: number
  adjustmentAmount?: number
  auditedAmount?: number
  difference?: number
  status?: string
  raw: RecordValue
}

export interface Workpaper {
  id: string
  workFileId?: string
  reference?: string
  name: string
  status?: string
  objective?: string
  procedure?: string
  result?: string
  conclusion?: string
  evidenceCount?: number
  openReviewNotes?: number
  preparedBy?: string
  preparedAt?: string
  reviewedBy?: string
  reviewedAt?: string
  capabilities: CapabilityMap
  raw: RecordValue
}

export interface ReviewNote {
  id: string
  workpaperId?: string
  title?: string
  body?: string
  response?: string
  status?: string
  createdBy?: string
  createdAt?: string
  respondedBy?: string
  respondedAt?: string
  clearedBy?: string
  clearedAt?: string
  capabilities: CapabilityMap
  raw: RecordValue
}

export interface Evidence {
  id: string
  name: string
  mimetype?: string
  size?: number
  createdBy?: string
  createdAt?: string
  capabilities: CapabilityMap
  raw: RecordValue
}

export interface Adjustment {
  id: string
  reference?: string
  date?: string
  description?: string
  debit?: number
  credit?: number
  status?: string
  accepted?: boolean
  posted?: boolean
  capabilities: CapabilityMap
  raw: RecordValue
}

export interface Sample {
  id: string
  name?: string
  method?: string
  seed?: string
  populationSize?: number
  sampleSize?: number
  status?: string
  generatedAt?: string
  selectedCount?: number
  capabilities: CapabilityMap
  raw: RecordValue
}

export interface MappingRow {
  id?: string
  accountId?: number
  accountCode?: string
  accountName?: string
  leadsheetCode?: string
  leadsheetName?: string
  workpaperReference?: string
  active?: boolean
  capabilities: CapabilityMap
  raw: RecordValue
}

export interface WorkingPaperSection<T> {
  rows: T[]
  total: number
  raw: unknown
}

function normalizeList(raw: unknown): { rows: unknown[]; total: number } {
  const data = record(raw)
  const rows =
    Array.isArray(raw) ? raw :
      array(data.items).length ? array(data.items) :
        array(data.rows).length ? array(data.rows) :
          array(data.records).length ? array(data.records) :
            array(data.data)
  return { rows, total: number(data, 'total', 'count') ?? rows.length }
}

function mapFile(value: unknown): WorkFile {
  const item = record(value)
  return {
    id: text(item, 'id', 'work_file_id', 'workFileId') || '',
    reference: text(item, 'reference', 'code', 'name') || '',
    name: text(item, 'name', 'display_name', 'displayName', 'reference') || 'Work File',
    clientName: text(item, 'client_name', 'clientName') || relation(item.client_id ?? item.clientId),
    companyName: text(item, 'company_name', 'companyName') || relation(item.company_id ?? item.companyId),
    period: text(item, 'period', 'fiscal_year', 'fiscalYear'),
    dateFrom: text(item, 'date_from', 'dateFrom'),
    dateTo: text(item, 'date_to', 'dateTo'),
    status: text(item, 'status', 'state'),
    preparerName: text(item, 'preparer_name', 'preparerName') || relation(item.preparer_id ?? item.preparerId),
    reviewerName: text(item, 'reviewer_name', 'reviewerName') || relation(item.reviewer_id ?? item.reviewerId),
    preparedProgress: number(item, 'prepared_progress', 'preparedProgress'),
    reviewedProgress: number(item, 'reviewed_progress', 'reviewedProgress'),
    tbVersion: text(item, 'tb_version', 'tbVersion'),
    tbStatus: text(item, 'tb_status', 'tbStatus'),
    openReviewNotes: number(item, 'open_review_notes', 'openReviewNotes'),
    updatedAt: text(item, 'updated_at', 'updatedAt', 'write_date'),
    capabilities: capabilities(item),
    raw: item,
  }
}

function mapTbLine(value: unknown): TbLine {
  const item = record(value)
  return {
    id: text(item, 'id', 'line_id', 'tb_line_id') || `${text(item, 'account_code', 'accountCode') || ''}-${text(item, 'account_name', 'accountName') || ''}`,
    accountId: number(item, 'account_id', 'accountId'),
    accountCode: text(item, 'account_code', 'accountCode', 'code') || relation(item.account_id),
    accountName: text(item, 'account_name', 'accountName', 'name'),
    debit: number(item, 'debit'),
    credit: number(item, 'credit'),
    net: number(item, 'net', 'balance'),
    closing: number(item, 'closing', 'closing_balance', 'closingBalance'),
    mapping: text(item, 'mapping', 'mapping_name', 'mappingName'),
    leadsheet: text(item, 'leadsheet', 'leadsheet_name', 'leadsheetName', 'leadsheet_code', 'leadsheetCode'),
    raw: item,
  }
}

function mapLeadsheet(value: unknown): Leadsheet {
  const item = record(value)
  return {
    id: text(item, 'id') || '',
    reference: text(item, 'reference', 'code'),
    name: text(item, 'name', 'display_name', 'displayName'),
    currentAmount: number(item, 'current_amount', 'currentAmount', 'per_books', 'perBooks'),
    priorAmount: number(item, 'prior_amount', 'priorAmount', 'py_amount', 'pyAmount'),
    adjustmentAmount: number(item, 'adjustment_amount', 'adjustmentAmount'),
    auditedAmount: number(item, 'audited_amount', 'auditedAmount'),
    difference: number(item, 'variance_amount', 'varianceAmount', 'difference'),
    status: text(item, 'status', 'state'),
    raw: item,
  }
}

function mapWorkpaper(value: unknown): Workpaper {
  const item = record(value)
  return {
    id: text(item, 'id', 'workpaper_id', 'workpaperId') || '',
    workFileId: text(item, 'work_file_id', 'workFileId'),
    reference: text(item, 'reference', 'code'),
    name: text(item, 'name', 'display_name', 'displayName', 'reference') || 'Workpaper',
    status: text(item, 'status', 'state'),
    objective: text(item, 'objective'),
    procedure: text(item, 'procedure'),
    result: text(item, 'result'),
    conclusion: text(item, 'conclusion'),
    evidenceCount: number(item, 'evidence_count', 'evidenceCount'),
    openReviewNotes: number(item, 'open_review_notes', 'openReviewNotes'),
    preparedBy: text(item, 'prepared_by_name', 'preparedBy') || relation(item.prepared_by),
    preparedAt: text(item, 'prepared_at', 'preparedAt'),
    reviewedBy: text(item, 'reviewed_by_name', 'reviewedBy') || relation(item.reviewed_by),
    reviewedAt: text(item, 'reviewed_at', 'reviewedAt'),
    capabilities: capabilities(item),
    raw: item,
  }
}

function mapReviewNote(value: unknown): ReviewNote {
  const item = record(value)
  return {
    id: text(item, 'id') || '',
    workpaperId: text(item, 'workpaper_id', 'workpaperId'),
    title: text(item, 'title', 'subject'),
    body: text(item, 'body', 'note', 'description'),
    response: text(item, 'response'),
    status: text(item, 'status', 'state'),
    createdBy: text(item, 'created_by_name', 'createdBy') || relation(item.create_uid),
    createdAt: text(item, 'created_at', 'createdAt', 'create_date'),
    respondedBy: text(item, 'responded_by_name', 'respondedBy'),
    respondedAt: text(item, 'responded_at', 'respondedAt'),
    clearedBy: text(item, 'cleared_by_name', 'clearedBy'),
    clearedAt: text(item, 'cleared_at', 'clearedAt'),
    capabilities: capabilities(item),
    raw: item,
  }
}

function mapEvidence(value: unknown): Evidence {
  const item = record(value)
  return {
    id: text(item, 'id', 'attachment_id', 'attachmentId') || '',
    name: text(item, 'name', 'filename') || 'Evidence',
    mimetype: text(item, 'mimetype', 'mime_type', 'content_type'),
    size: number(item, 'size', 'file_size'),
    createdBy: text(item, 'created_by_name', 'createdBy') || relation(item.create_uid),
    createdAt: text(item, 'created_at', 'createdAt', 'create_date'),
    capabilities: capabilities(item),
    raw: item,
  }
}

function mapAdjustment(value: unknown): Adjustment {
  const item = record(value)
  return {
    id: text(item, 'id') || '',
    reference: text(item, 'reference', 'name'),
    date: text(item, 'date'),
    description: text(item, 'description', 'narration'),
    debit: number(item, 'debit', 'total_debit'),
    credit: number(item, 'credit', 'total_credit'),
    status: text(item, 'status', 'state'),
    accepted: bool(item, 'accepted', 'is_accepted'),
    posted: bool(item, 'posted', 'is_posted'),
    capabilities: capabilities(item),
    raw: item,
  }
}

function mapSample(value: unknown): Sample {
  const item = record(value)
  return {
    id: text(item, 'id') || '',
    name: text(item, 'name', 'reference'),
    method: text(item, 'method', 'sampling_method'),
    seed: text(item, 'seed', 'random_seed'),
    populationSize: number(item, 'population_size', 'populationSize'),
    sampleSize: number(item, 'sample_size', 'sampleSize'),
    status: text(item, 'status', 'state'),
    generatedAt: text(item, 'generated_at', 'generatedAt'),
    selectedCount: number(item, 'selected_count', 'selectedCount', 'sample_size'),
    capabilities: capabilities(item),
    raw: item,
  }
}

function mapMapping(value: unknown): MappingRow {
  const item = record(value)
  return {
    id: text(item, 'id'),
    accountId: number(item, 'account_id', 'accountId'),
    accountCode: text(item, 'account_code', 'accountCode', 'code') || relation(item.account_id),
    accountName: text(item, 'account_name', 'accountName', 'name'),
    leadsheetCode: text(item, 'leadsheet_code', 'leadsheetCode'),
    leadsheetName: text(item, 'leadsheet_name', 'leadsheetName'),
    workpaperReference: text(item, 'workpaper_reference', 'workpaperReference'),
    active: bool(item, 'active'),
    capabilities: capabilities(item),
    raw: item,
  }
}

async function request<T>(path: string, payload: RecordValue = {}): Promise<T> {
  try {
    return unwrapResponse<T>(await apiClient.post(`/th/v1/working-papers${path}`, makeRpc(payload)))
  } catch (error) {
    const apiError = toApiError(error)
    if ([404, 405, 501].includes(apiError.status ?? 0)) {
      throw new ApiError('Working Papers API is not available for the current backend route.', { status: apiError.status })
    }
    throw apiError
  }
}

export async function listWorkFiles(filters: { search?: string; status?: string; limit?: number; offset?: number } = {}): Promise<WorkFileList> {
  const raw = await request<unknown>('/work-files', {
    ...(filters.search ? { search: filters.search } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.limit ? { limit: filters.limit } : {}),
    ...(filters.offset ? { offset: filters.offset } : {}),
  })
  const list = normalizeList(raw)
  return { items: list.rows.map(mapFile).filter((item) => item.id), total: list.total }
}

export async function getWorkFile(id: string) {
  return mapFile(await request<unknown>(`/work-files/${encodeURIComponent(id)}`))
}

export async function getTrialBalance(id: string): Promise<TrialBalanceSnapshot> {
  const raw = await request<unknown>(`/work-files/${encodeURIComponent(id)}/trial-balance`)
  const data = record(raw)
  const rows = normalizeList(data.lines ?? data.rows ?? data.items ?? raw)
  return {
    id: text(data, 'id', 'snapshot_id', 'snapshotId'),
    version: text(data, 'version', 'tb_version', 'tbVersion'),
    status: text(data, 'status', 'state'),
    generatedAt: text(data, 'generated_at', 'generatedAt'),
    sealedAt: text(data, 'sealed_at', 'sealedAt'),
    period: text(data, 'period'),
    rows: rows.rows.map(mapTbLine),
    total: rows.total,
    raw: data,
  }
}

export async function getLeadsheets(id: string): Promise<WorkingPaperSection<Leadsheet>> {
  const raw = await request<unknown>(`/work-files/${encodeURIComponent(id)}/leadsheets`)
  const list = normalizeList(raw)
  return { rows: list.rows.map(mapLeadsheet), total: list.total, raw }
}

export async function getWorkpapers(id: string): Promise<WorkingPaperSection<Workpaper>> {
  const raw = await request<unknown>(`/work-files/${encodeURIComponent(id)}/workpapers`)
  const list = normalizeList(raw)
  return { rows: list.rows.map(mapWorkpaper).filter((item) => item.id), total: list.total, raw }
}

export async function getAdjustments(id: string): Promise<WorkingPaperSection<Adjustment>> {
  const raw = await request<unknown>(`/work-files/${encodeURIComponent(id)}/adjustments`)
  const list = normalizeList(raw)
  return { rows: list.rows.map(mapAdjustment).filter((item) => item.id), total: list.total, raw }
}

export async function getReviewNotes(id: string): Promise<WorkingPaperSection<ReviewNote>> {
  const raw = await request<unknown>(`/work-files/${encodeURIComponent(id)}/review-notes`)
  const list = normalizeList(raw)
  return { rows: list.rows.map(mapReviewNote).filter((item) => item.id), total: list.total, raw }
}

export async function getSamples(id: string): Promise<WorkingPaperSection<Sample>> {
  const raw = await request<unknown>(`/work-files/${encodeURIComponent(id)}/samples`)
  const list = normalizeList(raw)
  return { rows: list.rows.map(mapSample).filter((item) => item.id), total: list.total, raw }
}

export async function getMappings(id: string): Promise<WorkingPaperSection<MappingRow>> {
  const raw = await request<unknown>(`/work-files/${encodeURIComponent(id)}/mappings`)
  const list = normalizeList(raw)
  return { rows: list.rows.map(mapMapping), total: list.total, raw }
}

export async function updateMapping(id: string, payload: RecordValue) {
  return request<unknown>(`/work-files/${encodeURIComponent(id)}/mappings/update`, payload)
}

export async function applyMappings(id: string) {
  return mapFile(await request<unknown>(`/work-files/${encodeURIComponent(id)}/mappings/apply`))
}

export async function runWorkFileAction(id: string, action: 'generate-snapshot' | 'complete' | 'reopen' | 'roll-forward', payload: RecordValue = {}) {
  return mapFile(await request<unknown>(`/work-files/${encodeURIComponent(id)}/${action}`, payload))
}

export async function glDrilldown(id: string, payload: { account_id?: number; tb_line_id?: string; leadsheet_id?: string; workpaper_id?: string; journal_id?: number; limit?: number }) {
  return request<unknown>(`/work-files/${encodeURIComponent(id)}/gl-drilldown`, payload as RecordValue)
}

export async function getWorkpaper(id: string) {
  return mapWorkpaper(await request<unknown>(`/workpapers/${encodeURIComponent(id)}`))
}

export async function saveWorkpaper(id: string, payload: { objective?: string; procedure?: string; result?: string; conclusion?: string }) {
  return mapWorkpaper(await request<unknown>(`/workpapers/${encodeURIComponent(id)}`, payload))
}

export async function runWorkpaperAction(id: string, action: 'prepare' | 'review') {
  return mapWorkpaper(await request<unknown>(`/workpapers/${encodeURIComponent(id)}/${action}`))
}

export async function listEvidence(workpaperId: string): Promise<WorkingPaperSection<Evidence>> {
  const raw = await request<unknown>(`/workpapers/${encodeURIComponent(workpaperId)}/evidence`)
  const list = normalizeList(raw)
  return { rows: list.rows.map(mapEvidence).filter((item) => item.id), total: list.total, raw }
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Unable to read evidence file'))
    reader.onload = () => {
      const result = String(reader.result || '')
      resolve(result.includes(',') ? result.split(',').pop() || '' : result)
    }
    reader.readAsDataURL(file)
  })
}

export async function uploadEvidence(workpaperId: string, file: File) {
  const content = await readFileAsBase64(file)
  return mapEvidence(await request<unknown>(`/workpapers/${encodeURIComponent(workpaperId)}/evidence`, {
    name: file.name,
    mimetype: file.type || 'application/octet-stream',
    content,
  }))
}

export async function downloadEvidence(evidenceId: string) {
  const response = await apiClient.get(`/th/v1/working-papers/evidence/${encodeURIComponent(evidenceId)}/download`, { responseType: 'blob' })
  return {
    blob: response.data as Blob,
    filename: String(response.headers?.['x-filename'] || `evidence-${evidenceId}`),
  }
}

export async function deleteEvidence(evidenceId: string) {
  return request<unknown>(`/evidence/${encodeURIComponent(evidenceId)}/delete`)
}

export async function createReviewNote(workFileId: string, payload: { workpaper_id?: string; title?: string; body: string }) {
  return mapReviewNote(await request<unknown>(`/work-files/${encodeURIComponent(workFileId)}/review-notes/create`, {
    ...(payload.workpaper_id ? { workpaper_id: payload.workpaper_id } : {}),
    ...(payload.title ? { title: payload.title } : {}),
    note: payload.body,
  }))
}

export async function runReviewNoteAction(noteId: string, action: 'respond' | 'clear', payload: { response?: string } = {}) {
  return mapReviewNote(await request<unknown>(`/review-notes/${encodeURIComponent(noteId)}/${action}`, payload))
}

export async function createAdjustment(workFileId: string, payload: RecordValue) {
  return mapAdjustment(await request<unknown>(`/work-files/${encodeURIComponent(workFileId)}/adjustments/create`, payload))
}

export async function updateAdjustment(adjustmentId: string, payload: RecordValue) {
  return mapAdjustment(await request<unknown>(`/adjustments/${encodeURIComponent(adjustmentId)}`, payload))
}

export async function postAdjustment(adjustmentId: string) {
  return mapAdjustment(await request<unknown>(`/adjustments/${encodeURIComponent(adjustmentId)}/post`))
}

export async function createSample(workFileId: string, payload: RecordValue) {
  return mapSample(await request<unknown>(`/work-files/${encodeURIComponent(workFileId)}/samples/create`, payload))
}

export async function generateSample(sampleId: string) {
  return mapSample(await request<unknown>(`/samples/${encodeURIComponent(sampleId)}/generate`))
}

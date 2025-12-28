import { apiClient } from '@/api/client'
import { unwrapResponse } from '@/api/response'
import { makeRpc } from '@/api/services/rpc'

export interface ExpenseLine {
  productId: number | null
  description: string
  quantity: number
  unitPrice: number
  taxId?: number | null
  subtotal: number // Calculated by Odoo
  totalTax: number // Calculated by Odoo
  total: number // Calculated by Odoo
}

export interface ExpensePayload {
  id?: number
  employeeId?: number // Optional, defaults to current user
  expenseDate: string // ISO 8601
  currency: string
  lines: ExpenseLine[]
  notes?: string
}

export interface Expense extends ExpensePayload {
  id: number
  number?: string
  employeeName?: string
  status: 'draft' | 'reported' | 'approved' | 'posted' | 'done' | 'refused'
  amountUntaxed: number
  totalTax: number
  total: number
  createdAt: string // ISO 8601
  updatedAt: string // ISO 8601
}

export interface ExpenseListItem {
  id: number
  number: string
  employeeName: string
  employeeId: number
  expenseDate: string // ISO 8601
  total: number
  status: 'draft' | 'reported' | 'approved' | 'posted' | 'done' | 'refused'
  currency: string
}

/**
 * Backend response (adt_th_api) returns hr.expense-like fields under /api/th/v1/expenses/*
 * and may wrap list results as { items, total, limit, offset }.
 */
interface BackendExpenseListItem {
  id: number
  name?: string
  employee?: { id?: number | null; name?: string | null }
  date?: string | null
  total_amount?: number | string | null
  currency?: string | null
  state?: string | null
  [key: string]: unknown
}

interface BackendExpenseListResponse {
  items?: BackendExpenseListItem[]
  total?: number
  limit?: number
  offset?: number
}

export interface ListExpensesParams {
  status?: 'draft' | 'reported' | 'approved' | 'posted' | 'done' | 'refused'
  employeeId?: number
  search?: string
  dateFrom?: string // ISO 8601
  dateTo?: string // ISO 8601
  limit?: number
  offset?: number
}

// NOTE: backend reality (adt_th_api): expenses are exposed under /api/th/v1/expenses/*
const basePath = '/th/v1/expenses'

function parseNumber(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (typeof v === 'string') {
    const n = Number(v.replace(/,/g, ''))
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

function mapBackendToFrontend(item: BackendExpenseListItem): ExpenseListItem {
  // Map backend state → our UI status
  const status = (item.state as ExpenseListItem['status'] | undefined) ?? 'draft'
  return {
    id: item.id,
    number: item.name ?? '',
    employeeName: item.employee?.name ?? '',
    employeeId: typeof item.employee?.id === 'number' ? item.employee.id : 0,
    expenseDate: item.date ?? '',
    total: parseNumber(item.total_amount),
    status,
    currency: item.currency ?? '',
  }
}

export async function listExpenses(params?: ListExpensesParams) {
  const body = makeRpc({
    // backend uses "state" while our UI uses "status" - send both for compatibility
    ...(params?.status && { status: params.status, state: params.status }),
    ...(params?.employeeId && { employee_id: params.employeeId }),
    ...(params?.search && { search: params.search }),
    ...(params?.limit && { limit: params.limit }),
    ...(params?.offset && { offset: params.offset }),
    ...(params?.dateFrom && { date_from: params.dateFrom }),
    ...(params?.dateTo && { date_to: params.dateTo }),
  })
  const response = await apiClient.post(`${basePath}/list`, body)
  const data = unwrapResponse<BackendExpenseListResponse | BackendExpenseListItem[] | ExpenseListItem[]>(response)

  // Backend may return array directly (ideal) or { items, total, ... }.
  const rawItems: unknown =
    Array.isArray(data) ? data : (data && typeof data === 'object' ? (data as BackendExpenseListResponse).items : [])

  if (Array.isArray(rawItems)) {
    // If already in frontend shape, keep it.
    const maybeFrontend = rawItems as any[]
    const looksFrontend =
      maybeFrontend.length === 0 ||
      (maybeFrontend[0] &&
        typeof maybeFrontend[0] === 'object' &&
        'employeeName' in (maybeFrontend[0] as any) &&
        'expenseDate' in (maybeFrontend[0] as any))

    if (looksFrontend) return rawItems as ExpenseListItem[]

    return (rawItems as BackendExpenseListItem[])
      .filter((it) => it && typeof it === 'object' && typeof (it as any).id === 'number')
      .map(mapBackendToFrontend)
  }

  return []
}

interface BackendExpenseDetail {
  id: number
  name?: string
  employee?: { id?: number | null; name?: string | null }
  product?: { id?: number | null; name?: string | null; code?: string | null }
  date?: string | null
  quantity?: number | string | null
  unit_amount?: number | string | null
  total_amount?: number | string | null
  currency?: string | null
  state?: string | null
  company?: { id?: number | null; name?: string | null }
  sheet?: { id?: number | null; name?: string | null; state?: string | null }
  payment_mode?: string | null
  description?: string | null
  attachment_ids?: unknown[]
  tax_ids?: Array<{ id?: number; name?: string; amount?: number }>
  [key: string]: unknown
}

interface BackendExpenseDetailResponse {
  expense?: BackendExpenseDetail
}

function mapBackendExpenseDetailToFrontend(backend: BackendExpenseDetail): Expense {
  const status = (backend.state as Expense['status'] | undefined) ?? 'draft'
  const total = parseNumber(backend.total_amount)
  const unitAmount = parseNumber(backend.unit_amount)
  const quantity = parseNumber(backend.quantity ?? 1)
  
  // Calculate tax from tax_ids
  // Backend provides tax_ids with amount (e.g., 7.0 for 7%)
  // If unit_amount is valid, calculate tax from it; otherwise estimate from total
  let totalTax = 0
  let amountUntaxed = total
  
  if (backend.tax_ids && Array.isArray(backend.tax_ids) && backend.tax_ids.length > 0) {
    const taxRate = backend.tax_ids.reduce((sum, t) => sum + (parseNumber(t.amount) || 0), 0) / 100
    
    if (unitAmount > 0) {
      // If unit_amount is provided, calculate tax from it
      const subtotal = unitAmount * quantity
      totalTax = subtotal * taxRate
      amountUntaxed = subtotal
    } else {
      // If unit_amount is 0 or missing, assume total_amount includes tax
      // Calculate untaxed amount: total = untaxed * (1 + taxRate)
      amountUntaxed = total / (1 + taxRate)
      totalTax = total - amountUntaxed
    }
  } else {
    // No tax, so total is untaxed
    amountUntaxed = total
  }
  
  // Convert single expense item to lines array format
  // If unitAmount is 0 or invalid, calculate it from amountUntaxed / quantity
  const effectiveUnitPrice = unitAmount > 0 ? unitAmount : (quantity > 0 ? amountUntaxed / quantity : amountUntaxed)
  
  const lines: ExpenseLine[] = [
    {
      productId: backend.product?.id ?? null,
      description: backend.description || backend.name || '',
      quantity: quantity,
      unitPrice: effectiveUnitPrice,
      taxId: backend.tax_ids?.[0]?.id ?? null,
      subtotal: amountUntaxed,
      totalTax: totalTax,
      total: total,
    },
  ]

  return {
    id: backend.id,
    number: backend.name ?? '',
    employeeName: backend.employee?.name ?? '',
    expenseDate: backend.date ?? '',
    currency: backend.currency ?? 'THB',
    status,
    amountUntaxed,
    totalTax,
    total,
    lines,
    notes: backend.description ?? undefined,
    createdAt: '', // Backend doesn't provide this in the response
    updatedAt: '', // Backend doesn't provide this in the response
  }
}

export async function getExpense(id: number) {
  const body = makeRpc({ id })
  const response = await apiClient.post(`${basePath}/${id}`, body)
  const data = unwrapResponse<BackendExpenseDetailResponse | Expense>(response)
  
  // Backend returns { expense: {...} } format
  if (data && typeof data === 'object' && 'expense' in data) {
    const backendExpense = (data as BackendExpenseDetailResponse).expense
    if (!backendExpense) {
      throw new Error('Expense not found in backend response')
    }
    return mapBackendExpenseDetailToFrontend(backendExpense)
  }
  
  // If already in frontend format (unlikely but handle it)
  if (data && typeof data === 'object' && 'lines' in data) {
    return data as Expense
  }
  
  throw new Error('Unexpected expense response format')
}

export async function createExpense(payload: ExpensePayload) {
  const body = makeRpc(payload)
  const response = await apiClient.post(basePath, body)
  return unwrapResponse<Expense>(response)
}

export async function updateExpense(id: number, payload: ExpensePayload) {
  const body = makeRpc({ id, ...payload })
  const response = await apiClient.put(`${basePath}/${id}`, body)
  return unwrapResponse<Expense>(response)
}

export async function submitExpense(id: number) {
  const body = makeRpc({ id })
  const response = await apiClient.post(`${basePath}/${id}/submit`, body)
  return unwrapResponse<Expense>(response)
}


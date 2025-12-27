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

export async function listExpenses(params?: ListExpensesParams) {
  const body = makeRpc({
    ...(params?.status && { status: params.status }),
    ...(params?.employeeId && { employee_id: params.employeeId }),
    ...(params?.search && { search: params.search }),
    ...(params?.limit && { limit: params.limit }),
    ...(params?.offset && { offset: params.offset }),
    ...(params?.dateFrom && { date_from: params.dateFrom }),
    ...(params?.dateTo && { date_to: params.dateTo }),
  })
  const response = await apiClient.post(`${basePath}/list`, body)
  return unwrapResponse<ExpenseListItem[]>(response)
}

export async function getExpense(id: number) {
  const body = makeRpc({ id })
  const response = await apiClient.post(`${basePath}/${id}`, body)
  return unwrapResponse<Expense>(response)
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


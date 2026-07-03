import { apiClient } from '@/api/client'
import { unwrapResponse } from '@/api/response'
import { makeRpc } from '@/api/services/rpc'

export interface EmployeeUserOption {
  id: number
  name: string
  login?: string | null
  email?: string | null
  employeeId?: number | null
  userId?: number | null
}

export interface ListEmployeeUsersParams {
  q?: string
  limit?: number
  offset?: number
  active?: boolean
}

type RawRecord = Record<string, unknown>

function num(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/g, '').trim())
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function str(value: unknown) {
  return typeof value === 'string' ? value : value == null ? null : String(value)
}

function normalizeEmployeeUser(raw: unknown): EmployeeUserOption | null {
  const item = (raw && typeof raw === 'object' ? raw : {}) as RawRecord
  const id = num(
    item.id ??
      item.userId ??
      item.user_id ??
      item.employeeId ??
      item.employee_id ??
      item.resId ??
      item.res_id,
  )
  const name = str(item.name ?? item.display_name ?? item.employeeName ?? item.employee_name)
  if (!id || !name) return null
  return {
    id,
    name,
    login: str(item.login ?? item.username),
    email: str(item.email),
    employeeId: num(item.employeeId ?? item.employee_id) || null,
    userId: num(item.userId ?? item.user_id ?? item.id) || null,
  }
}

async function tryListPath(path: string, params: ListEmployeeUsersParams) {
  const response = await apiClient.post(
    path,
    makeRpc({
      ...(params.q ? { q: params.q, search: params.q } : {}),
      ...(params.limit !== undefined ? { limit: params.limit } : {}),
      ...(params.offset !== undefined ? { offset: params.offset } : {}),
      ...(params.active !== undefined ? { active: params.active } : {}),
    }),
  )
  const raw = unwrapResponse<unknown>(response)
  const rows = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object'
      ? Array.isArray((raw as RawRecord).items)
        ? ((raw as RawRecord).items as unknown[])
        : Array.isArray((raw as RawRecord).users)
          ? ((raw as RawRecord).users as unknown[])
          : Array.isArray((raw as RawRecord).employees)
            ? ((raw as RawRecord).employees as unknown[])
            : []
      : []
  return rows.map(normalizeEmployeeUser).filter((item): item is EmployeeUserOption => Boolean(item))
}

export async function listEmployeeUsers(params: ListEmployeeUsersParams = {}) {
  const candidates = [
    '/th/v1/chonlatee-billing/employees/list',
    '/th/v1/system/users/list',
    '/th/v1/users/list',
    '/th/v1/employees/list',
    '/th/v1/hr/employees/list',
  ]

  for (const path of candidates) {
    try {
      const rows = await tryListPath(path, params)
      if (rows.length > 0) return rows
    } catch {
      // Try the next candidate path.
    }
  }
  return []
}

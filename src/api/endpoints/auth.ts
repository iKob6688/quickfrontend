import { apiClient } from '@/api/client'
import { unwrapResponse } from '@/api/response'

export interface LoginPayload {
  login: string
  password: string
}

export interface AuthUser {
  id: number
  name: string
  login: string
  email?: string
  locale?: string
  companyName?: string
  instancePublicId?: string
  companyId?: number
  companies?: { id: number; name: string }[]
}

export interface LoginResponse {
  token: string
  user: AuthUser
  companies: { id: number; name: string }[]
}

export interface MeResponse extends AuthUser {
  instancePublicId: string
  companyId: number
  companyName: string
  companies: { id: number; name: string }[]
}

export interface RegisterCompanyPayload {
  companyName: string
  adminEmail: string
}

export interface RegisterCompanyResponse {
  company_id: number
  company_name: string
  admin_user_id: number
  admin_login: string
  admin_password: string
}

// NOTE: axios baseURL is VITE_API_BASE_URL (= '/api'), so endpoint paths here must NOT start with '/api'
// Example: baseURL '/api' + path '/th/v1/auth/login' => '/api/th/v1/auth/login'
const basePath = '/th/v1/auth'

/**
 * Gets Odoo database name from environment variable
 */
function getOdooDb(): string | undefined {
  const db = import.meta.env.VITE_ODOO_DB
  return db && typeof db === 'string' && db.trim() ? db.trim() : undefined
}

/**
 * Creates a JSON-RPC 2.0 request body for Odoo endpoints
 * Automatically includes db from VITE_ODOO_DB if available
 */
function makeRpc(params: Record<string, unknown>) {
  const db = getOdooDb()
  return {
    jsonrpc: '2.0' as const,
    method: 'call' as const,
    params: {
      ...params,
      ...(db ? { db } : {}),
    },
  }
}

export async function login(payload: LoginPayload) {
  // makeRpc now automatically includes db, so we don't need to pass it explicitly
  const body = makeRpc({
    login: payload.login,
    password: payload.password,
  })
  const response = await apiClient.post(`${basePath}/login`, body)
  return unwrapResponse<LoginResponse>(response)
}

export async function getMe() {
  const body = makeRpc({})
  try {
    // Preferred: POST JSON-RPC
    const response = await apiClient.post(`${basePath}/me`, body)
    return unwrapResponse<MeResponse>(response)
  } catch (err) {
    // Backward-compat: some Odoo deployments expose /me as GET only.
    // If we get 405, retry GET without body.
    const status = (err as { response?: { status?: number } })?.response?.status
    if (status === 405) {
      const response = await apiClient.get(`${basePath}/me`)
      return unwrapResponse<MeResponse>(response)
    }
    throw err
  }
}

export async function logout() {
  const body = makeRpc({})
  await apiClient.post(`${basePath}/logout`, body)
}

export async function registerCompany(input: RegisterCompanyPayload) {
  const masterKey = import.meta.env.VITE_REGISTER_MASTER_KEY
  // makeRpc now automatically includes db, so we don't need to pass it explicitly
  const body = makeRpc({
    master_key: masterKey,
    company_name: input.companyName,
    admin_email: input.adminEmail,
  })
  const response = await apiClient.post(`${basePath}/register_company`, body)
  return unwrapResponse<RegisterCompanyResponse>(response)
}

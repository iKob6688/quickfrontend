import { apiClient } from '@/api/client'
import { unwrapResponse } from '@/api/response'
import { makeRpc } from '@/api/services/rpc'

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
const basePath = '/th/v1/auth'

export async function login(payload: LoginPayload) {
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
    const response = await apiClient.post(`${basePath}/me`, body)
    return unwrapResponse<MeResponse>(response)
  } catch (err) {
    // Backward-compat: some deployments expose /me as GET only
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
  const body = makeRpc({
    master_key: masterKey,
    company_name: input.companyName,
    admin_email: input.adminEmail,
  })
  const response = await apiClient.post(`${basePath}/register_company`, body)
  return unwrapResponse<RegisterCompanyResponse>(response)
}



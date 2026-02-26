import { apiClient } from '@/api/client'
import { unwrapResponse, ApiError } from '@/api/response'
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
// Local deployments vary:
// - some expose Odoo web session at /web/session/*
// - some mount it under /odoo/web/session/*
// Try root first, then /odoo as fallback.
const webSessionBaseURLs = ['', '/odoo'] as const

type OdooWebSessionAuthResult = {
  uid?: number
  user_context?: { lang?: string }
  username?: string
  user_name?: string
  db?: string
  user_companies?: {
    current_company?: [number, string]
    allowed_companies?: Record<string, { id?: number; name?: string }>
  }
}

function is404Error(err: unknown) {
  return (err as { response?: { status?: number } })?.response?.status === 404
}

async function loginViaWebSession(payload: LoginPayload): Promise<LoginResponse> {
  const db = import.meta.env.VITE_ODOO_DB
  let response: any = null
  let raw: { result?: OdooWebSessionAuthResult; error?: unknown } | undefined
  let result: OdooWebSessionAuthResult | undefined
  let lastErr: unknown = null
  for (const baseURL of webSessionBaseURLs) {
    try {
      response = await apiClient.post(
        '/web/session/authenticate',
        {
          jsonrpc: '2.0',
          method: 'call',
          params: {
            db,
            login: payload.login,
            password: payload.password,
          },
          id: Date.now(),
        },
        { baseURL, withCredentials: true, maxRedirects: 0 },
      )
      raw = response.data as { result?: OdooWebSessionAuthResult; error?: unknown } | undefined
      result = raw?.result
      if (result?.uid) break
    } catch (e) {
      lastErr = e
      continue
    }
  }
  if (!response || !result?.uid) {
    if (lastErr) throw lastErr instanceof Error ? lastErr : new ApiError('Odoo web session login failed')
    throw new ApiError('Odoo web session login failed', { status: response?.status, details: raw })
  }
  const allowedCompanies = Object.values(result.user_companies?.allowed_companies ?? {})
    .map((c) => ({ id: Number(c.id || 0), name: c.name || '' }))
    .filter((c) => c.id > 0)
  const currentCompany = result.user_companies?.current_company
  const user: AuthUser = {
    id: result.uid,
    name: result.user_name || payload.login,
    login: result.username || payload.login,
    locale: result.user_context?.lang,
    companyId: currentCompany?.[0],
    companyName: currentCompany?.[1],
    companies: allowedCompanies,
  }
  return {
    // Session-cookie mode fallback for local/dev when custom auth route is unavailable.
    // Keep a marker token so frontend considers itself authenticated.
    token: '__odoo_web_session__',
    user,
    companies: allowedCompanies,
  }
}

async function getMeViaWebSession(): Promise<MeResponse> {
  let response: any = null
  let r: any = null
  let lastRaw: any = null
  let lastErr: unknown = null
  for (const baseURL of webSessionBaseURLs) {
    try {
      response = await apiClient.post(
        '/web/session/get_session_info',
        { jsonrpc: '2.0', method: 'call', params: {}, id: Date.now() },
        { baseURL, withCredentials: true, maxRedirects: 0 },
      )
      const raw = response.data as { result?: any } | undefined
      lastRaw = raw
      r = raw?.result
      if (r?.uid) break
    } catch (e) {
      lastErr = e
    }
  }
  if (!r?.uid) {
    if (lastErr) throw lastErr instanceof Error ? lastErr : new ApiError('Odoo web session not authenticated')
    throw new ApiError('Odoo web session not authenticated', { status: response?.status, details: lastRaw })
  }
  const allowedCompanies = Object.values(r.user_companies?.allowed_companies ?? {})
    .map((c: any) => ({ id: Number(c.id || 0), name: c.name || '' }))
    .filter((c) => c.id > 0)
  const currentCompany = r.user_companies?.current_company
  return {
    id: r.uid,
    name: r.user_name || r.username || '',
    login: r.username || '',
    email: r.email || undefined,
    locale: r.user_context?.lang,
    companyId: currentCompany?.[0],
    companyName: currentCompany?.[1],
    companies: allowedCompanies,
    instancePublicId: currentCompany?.[0] ? String(currentCompany[0]) : '',
  }
}

async function logoutViaWebSession() {
  let lastErr: unknown = null
  for (const baseURL of webSessionBaseURLs) {
    try {
      await apiClient.post(
        '/web/session/destroy',
        { jsonrpc: '2.0', method: 'call', params: {}, id: Date.now() },
        { baseURL, withCredentials: true, maxRedirects: 0 },
      )
      return
    } catch (e) {
      lastErr = e
    }
  }
  if (lastErr) throw lastErr instanceof Error ? lastErr : new ApiError('Odoo web session logout failed')
}

export async function login(payload: LoginPayload) {
  const body = makeRpc({
    login: payload.login,
    password: payload.password,
  })
  try {
    const response = await apiClient.post(`${basePath}/login`, body)
    return unwrapResponse<LoginResponse>(response)
  } catch (err) {
    if (is404Error(err)) {
      // Local/dev fallback when custom auth route is unavailable but Odoo web session exists.
      return loginViaWebSession(payload)
    }
    // Handle 405 Method Not Allowed - usually means VITE_API_BASE_URL is incorrect
    const status = (err as { response?: { status?: number } })?.response?.status
    if (status === 405) {
      const baseURL = import.meta.env.VITE_API_BASE_URL ?? '/api'
      const isRelativeUrl = baseURL.startsWith('/')
      const message =
        `การเชื่อมต่อล้มเหลว (405 Method Not Allowed). ` +
        `กรุณาตรวจสอบการตั้งค่า VITE_API_BASE_URL ในไฟล์ .env\n\n` +
        `ค่าปัจจุบัน: ${baseURL}\n` +
        (isRelativeUrl
          ? `⚠️  สำหรับ server deployment ต้องใช้ full URL เช่น:\n` +
            `   - https://your-server.com/api\n` +
            `   - https://api.example.com\n\n` +
            `รันคำสั่ง: npm run update-env เพื่ออัพเดทการตั้งค่า`
          : `ตรวจสอบว่า URL ถูกต้องและ server รองรับ POST method`)
      throw new ApiError(message, { status: 405, code: 'METHOD_NOT_ALLOWED' })
    }
    throw err
  }
}

export async function getMe() {
  const body = makeRpc({})
  try {
    const response = await apiClient.post(`${basePath}/me`, body)
    return unwrapResponse<MeResponse>(response)
  } catch (err) {
    if (is404Error(err)) {
      return getMeViaWebSession()
    }
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
  try {
    await apiClient.post(`${basePath}/logout`, body)
  } catch (err) {
    if (is404Error(err)) {
      await logoutViaWebSession()
      return
    }
    throw err
  }
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

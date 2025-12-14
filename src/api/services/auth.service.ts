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

export async function login(payload: LoginPayload) {
  const body = makeRpc({
    login: payload.login,
    password: payload.password,
  })
  try {
    const response = await apiClient.post(`${basePath}/login`, body)
    return unwrapResponse<LoginResponse>(response)
  } catch (err) {
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



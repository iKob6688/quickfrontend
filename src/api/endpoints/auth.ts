export {
  login,
  getMe,
  logout,
  registerCompany,
} from '@/api/services/auth.service'

export type {
  LoginPayload,
  LoginResponse,
  MeResponse,
  AuthUser,
  RegisterCompanyPayload,
  RegisterCompanyResponse,
} from '@/api/services/auth.service'

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { LoginPayload, MeResponse } from '@/api/services/auth.service'
import {
  getMe,
  login as apiLogin,
  logout as apiLogout,
} from '@/api/services/auth.service'
import { clearOfflineData } from '@/offline/syncEngine'
import { clearAuthStorage, setAccessToken, getAccessToken } from '@/lib/authToken'
import {
  getInstanceId,
  setInstanceId,
  clearInstanceId,
} from '@/lib/instanceId'
import { toApiError } from '@/api/response'

interface AuthState {
  user: MeResponse | null
  accessToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error?: string
  instancePublicId: string | null
  login: (payload: LoginPayload) => Promise<void>
  logout: () => Promise<void>
  loadMe: () => Promise<void>
}

function resolveInstanceId(user: MeResponse | null): string | null {
  if (!user) return null
  if (user.instancePublicId) return user.instancePublicId
  if (user.companyId != null) return String(user.companyId)
  return null
}

export const useAuthStore = create<AuthState>()(
  devtools(
    (set) => ({
      user: null,
      accessToken: getAccessToken(),
      isAuthenticated: !!getAccessToken(),
      isLoading: false,
      instancePublicId: getInstanceId(),
      async login(payload) {
        set({ isLoading: true, error: undefined })
        try {
          const loginResp = await apiLogin(payload)
          setAccessToken(loginResp.token)

          // Fetch full profile (with instancePublicId / company info)
          const me = await getMe()
          const resolvedInstanceId =
            resolveInstanceId(me) ?? getInstanceId()

          setInstanceId(resolvedInstanceId)

          set({
            user: me,
            accessToken: loginResp.token,
            isAuthenticated: true,
            isLoading: false,
            instancePublicId: resolvedInstanceId,
            error: undefined,
          })
        } catch (err) {
          const apiErr = toApiError(err)
          set({
            error: apiErr.message,
            isLoading: false,
            isAuthenticated: false,
          })
          throw apiErr
        }
      },
      async logout() {
        try {
          await apiLogout()
        } catch {
          // ignore backend logout errors; proceed with local cleanup
        } finally {
          clearAuthStorage()
          clearInstanceId()
          await clearOfflineData()
          set({
            user: null,
            accessToken: null,
            isAuthenticated: false,
            isLoading: false,
            error: undefined,
            instancePublicId: null,
          })
        }
      },
      async loadMe() {
        const token = getAccessToken()
        if (!token) {
          clearInstanceId()
          set({
            user: null,
            isAuthenticated: false,
            instancePublicId: null,
          })
          return
        }

        set({ isLoading: true })
        try {
          const me = await getMe()
          const resolvedInstanceId =
            resolveInstanceId(me) ?? getInstanceId()
          setInstanceId(resolvedInstanceId)
          set({
            user: me,
            accessToken: token,
            isAuthenticated: true,
            isLoading: false,
            instancePublicId: resolvedInstanceId,
          })
        } catch (err) {
          clearAuthStorage()
          clearInstanceId()
          set({
            user: null,
            accessToken: null,
            isAuthenticated: false,
            isLoading: false,
            instancePublicId: null,
            error: toApiError(err).message,
          })
        }
      },
    }),
    { name: 'auth-store' },
  ),
)


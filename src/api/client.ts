import axios from 'axios'
import { getAccessToken, clearAuthStorage } from '@/lib/authToken'
import { getInstanceId, clearInstanceId } from '@/lib/instanceId'

const baseURL =
  import.meta.env.VITE_API_BASE_URL ?? window.location.origin

const apiKey = import.meta.env.VITE_API_KEY

export const apiClient = axios.create({
  baseURL,
  withCredentials: true,
})

export type UnauthorizedHandler = () => void

let unauthorizedHandler: UnauthorizedHandler | null = null

export function setUnauthorizedHandler(handler: UnauthorizedHandler) {
  unauthorizedHandler = handler
}

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken()
  const instanceId = getInstanceId()

  // Start from existing headers to avoid dropping anything the caller set.
  const headers: Record<string, string> = {
    ...(config.headers as Record<string, string> | undefined),
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  if (instanceId) {
    headers['X-Instance-ID'] = instanceId
  }

  if (apiKey) {
    headers['X-ADT-API-Key'] = apiKey
  }

  config.headers = headers

  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status

    if (status === 401) {
      // Refresh-token flow can be added here in the future.
      clearAuthStorage()
      clearInstanceId()
      if (unauthorizedHandler) {
        unauthorizedHandler()
      }
    }

    return Promise.reject(error)
  },
)



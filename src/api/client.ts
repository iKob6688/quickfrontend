import axios, { AxiosHeaders } from 'axios'
import { getAccessToken, clearAuthStorage } from '@/lib/authToken'
import { getInstanceId, clearInstanceId } from '@/lib/instanceId'

// Default to '/api' so Vite proxy works even if .env isn't loaded yet.
const baseURL =
  import.meta.env.VITE_API_BASE_URL ?? '/api'

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

function isUnauthorizedEnvelope(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false
  let data: any = raw
  if (data.jsonrpc === '2.0' && data.result) {
    data = data.result
  }
  if (!data || typeof data !== 'object') return false
  if (data.success !== false) return false
  const err = data.error
  if (!err) return false
  if (typeof err === 'string') return err.toLowerCase() === 'unauthorized'
  if (typeof err === 'object' && typeof err.message === 'string') {
    return err.message.toLowerCase() === 'unauthorized'
  }
  return false
}

function handleUnauthorized() {
  clearAuthStorage()
  clearInstanceId()
  if (unauthorizedHandler) unauthorizedHandler()
}

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken()
  const instanceId = getInstanceId()

  // Start from existing headers to avoid dropping anything the caller set.
  const headers = AxiosHeaders.from(config.headers ?? {})

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  if (instanceId) {
    headers.set('X-Instance-ID', instanceId)
  }

  if (apiKey) {
    headers.set('X-ADT-API-Key', apiKey)
  }

  config.headers = headers

  return config
})

apiClient.interceptors.response.use(
  (response) => {
    // Odoo type="json" may respond 200 with ApiEnvelope Unauthorized.
    if (isUnauthorizedEnvelope(response.data)) {
      handleUnauthorized()
      return Promise.reject(new Error('Unauthorized'))
    }
    return response
  },
  async (error) => {
    const status = error.response?.status

    if (status === 401) {
      // Refresh-token flow can be added here in the future.
      handleUnauthorized()
    } else if (isUnauthorizedEnvelope(error.response?.data)) {
      // Some proxies/backends can still return 200/400 with envelope Unauthorized.
      handleUnauthorized()
    }

    return Promise.reject(error)
  },
)



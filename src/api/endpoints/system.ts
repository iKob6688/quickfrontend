import { apiClient } from '@/api/client'
import { unwrapResponse } from '@/api/response'

export interface PingResponse {
  pong: boolean
}

// NOTE: axios baseURL is VITE_API_BASE_URL (= '/api'), so endpoint paths here must NOT start with '/api'
const basePath = '/th/v1'

function makeRpc(params: Record<string, unknown>) {
  return {
    jsonrpc: '2.0' as const,
    method: 'call' as const,
    params,
  }
}

export async function ping() {
  const response = await apiClient.post(`${basePath}/ping`, makeRpc({}))
  return unwrapResponse<PingResponse>(response)
}



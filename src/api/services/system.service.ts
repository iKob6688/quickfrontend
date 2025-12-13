import { apiClient } from '@/api/client'
import { unwrapResponse } from '@/api/response'
import { makeRpc } from '@/api/services/rpc'

export interface PingResponse {
  pong: boolean
}

const basePath = '/th/v1'

export async function ping() {
  const response = await apiClient.post(`${basePath}/ping`, makeRpc({}, { includeDb: false }))
  return unwrapResponse<PingResponse>(response)
}



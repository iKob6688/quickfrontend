import { apiClient } from '@/api/client'
import { unwrapResponse } from '@/api/response'
import { makeRpc } from '@/api/services/rpc'

export interface BootstrapPayload {
  registration_token: string
  db?: string
}

export interface BootstrapResponse {
  api_base_url: string
  db: string
  api_key: string
  allowed_scopes: string[]
  company_id: number
  company_name: string
}

export async function bootstrap(payload: BootstrapPayload) {
  // Per docs/api_contract.md: JSON-RPC request
  const response = await apiClient.post('/th/v1/frontend/bootstrap', makeRpc(payload))
  return unwrapResponse<BootstrapResponse>(response)
}



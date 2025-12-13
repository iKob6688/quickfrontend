import { apiClient } from '@/api/client'
import { unwrapResponse } from '@/api/response'

export interface BootstrapPayload {
  registration_token: string
}

export interface BootstrapResponse {
  api_base_url: string
  db: string
  api_key: string
  allowed_scopes: string[]
  company_id: number
  company_name: string
}

/**
 * Bootstrap endpoint (typically called from CLI, not from React)
 * But available here if needed for runtime checks or re-bootstrap
 * 
 * Note: This endpoint doesn't require auth, so it uses apiClient
 * which may include X-ADT-API-Key if already configured, but that's fine.
 */
export async function bootstrap(payload: BootstrapPayload) {
  const response = await apiClient.post('/th/v1/frontend/bootstrap', {
    registration_token: payload.registration_token,
  })
  return unwrapResponse<BootstrapResponse>(response)
}


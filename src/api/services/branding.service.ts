import { apiClient } from '@/api/client'
import { makeRpc } from '@/api/services/rpc'
import { unwrapResponse } from '@/api/response'
import axios from 'axios'

export type CompanyBrandingDTO = {
  name: string
  head_office_label: string
  logo_url: string
  address_lines: string[]
  tel: string
  fax: string
  email: string
  website: string
  tax_id: string
  branch?: string
}

async function postRpcWith404Fallback<T>(
  paths: string[],
  payload: Record<string, unknown>,
): Promise<T> {
  let lastErr: unknown = null
  for (const p of paths) {
    try {
      const res = await apiClient.post(p, makeRpc(payload))
      return unwrapResponse<T>(res)
    } catch (e) {
      lastErr = e
      // Production servers may expose only one of the alias route families.
      // If this path is missing (404), try the next candidate.
      if (axios.isAxiosError(e) && e.response?.status === 404) continue
      throw e
    }
  }
  throw lastErr ?? new Error('Branding API not found (all candidate paths returned 404)')
}

export async function fetchCompanyBranding(): Promise<CompanyBrandingDTO> {
  return await postRpcWith404Fallback<CompanyBrandingDTO>(
    [
      // Preferred (newer) namespace
      '/th/v1/erpth/branding/company',
      // Legacy / alternative alias used by some deployments
      '/erpth/v1/branding/company',
    ],
    {},
  )
}

export async function updateCompanyBranding(payload: {
  companyName: string
  headOfficeLabel?: string
  addressLines: string[]
  tel?: string
  fax?: string
  email?: string
  website?: string
  taxId?: string
  logoBase64?: string
}): Promise<CompanyBrandingDTO> {
  return await postRpcWith404Fallback<CompanyBrandingDTO>(
    [
      // Preferred (newer) namespace
      '/th/v1/erpth/branding/company/update',
      // Legacy / alternative alias used by some deployments
      '/erpth/v1/branding/company/update',
    ],
    payload as unknown as Record<string, unknown>,
  )
}



import { apiClient } from '@/api/client'
import { makeRpc } from '@/api/services/rpc'
import { ApiError, unwrapResponse } from '@/api/response'
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
  const attempts: Array<{ path: string; status?: number }> = []
  for (const p of paths) {
    try {
      const res = await apiClient.post(p, makeRpc(payload))
      return unwrapResponse<T>(res)
    } catch (e) {
      lastErr = e
      const status = axios.isAxiosError(e) ? e.response?.status : undefined
      attempts.push({ path: p, status })

      // Production servers may expose only one of the alias route families.
      // If this path is missing (404), try the next candidate.
      if (axios.isAxiosError(e) && status === 404) continue

      // Non-404: surface which endpoint failed for faster production debugging.
      if (axios.isAxiosError(e)) {
        throw new ApiError(`Branding API failed at ${p}`, {
          status,
          details: { attempts, response: e.response?.data },
        })
      }

      throw new ApiError(`Branding API failed at ${p}`, { details: { attempts } })
    }
  }

  // All candidates returned 404 (or no response). Throw a helpful error message.
  if (axios.isAxiosError(lastErr)) {
    throw new ApiError(`Branding API endpoint not found (404). Tried: ${attempts.map((a) => a.path).join(', ')}`, {
      status: 404,
      details: { attempts, response: lastErr.response?.data },
    })
  }

  throw new ApiError(
    `Branding API endpoint not found. Tried: ${attempts.map((a) => a.path).join(', ')}`,
    { details: { attempts } },
  )
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
      // Common JSON endpoint naming variants found in some Odoo controllers
      '/th/v1/erpth/branding/company/update_json',
      '/th/v1/erpth/branding/company_update',
      '/th/v1/erpth/branding/company_update_json',
      // Legacy / alternative alias used by some deployments
      '/erpth/v1/branding/company/update',
      '/erpth/v1/branding/company/update_json',
      '/erpth/v1/branding/company_update',
      '/erpth/v1/branding/company_update_json',
    ],
    payload as unknown as Record<string, unknown>,
  )
}



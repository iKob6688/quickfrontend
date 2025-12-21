import { apiClient } from '@/api/client'
import { makeRpc } from '@/api/services/rpc'
import { unwrapResponse } from '@/api/response'

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

export async function fetchCompanyBranding(): Promise<CompanyBrandingDTO> {
  const res = await apiClient.post('/th/v1/erpth/branding/company', makeRpc({}))
  return unwrapResponse<CompanyBrandingDTO>(res)
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
  const res = await apiClient.post(
    '/th/v1/erpth/branding/company/update',
    makeRpc(payload),
  )
  return unwrapResponse<CompanyBrandingDTO>(res)
}



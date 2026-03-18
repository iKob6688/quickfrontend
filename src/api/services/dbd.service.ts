import { apiClient } from '@/api/client'
import { unwrapResponse } from '@/api/response'
import { makeRpc } from '@/api/services/rpc'

export interface DbdLookupResult {
  taxId: string
  juristicId?: string | null
  companyNameTh?: string | null
  companyNameEn?: string | null
  juristicType?: string | null
  status?: string | null
  registeredDate?: string | null
  registeredCapital?: number | null
  addressText?: string | null
  provinceName?: string | null
  districtName?: string | null
  subDistrictName?: string | null
  zipcode?: string | null
  rawPayload?: unknown
  lookupStatus: 'ok' | 'not_found' | 'not_configured' | 'error'
  message?: string | null
}

export async function lookupDbdByTaxId(taxId: string) {
  const body = makeRpc({
    tax_id: taxId,
    juristic_id: taxId,
    vat: taxId,
  })

  const tryPaths = ['/th/v1/dbd/lookup', '/web/adt/th/v1/dbd/lookup']
  let lastErr: unknown = null

  for (const path of tryPaths) {
    try {
      const response = await apiClient.post(path, body)
      return unwrapResponse<DbdLookupResult>(response)
    } catch (error) {
      lastErr = error
    }
  }

  throw (lastErr instanceof Error ? lastErr : new Error('DBD lookup failed'))
}

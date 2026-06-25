import { apiClient } from '@/api/client'
import { unwrapResponse } from '@/api/response'
import { makeRpc } from '@/api/services/rpc'

export interface SalesDocumentNumberingSettings {
  quotationPrefix: string
  saleOrderPrefix: string
  companyId: number
  companyName: string
}

export interface UpdateSalesDocumentNumberingPayload {
  quotationPrefix: string
  saleOrderPrefix: string
}

const basePath = '/th/v1/sales/settings/document-numbering'

function normalizePrefix(value: string) {
  return value.trim().toUpperCase()
}

export async function getSalesDocumentNumberingSettings() {
  const response = await apiClient.post(`${basePath}/get`, makeRpc({}))
  const data = unwrapResponse<SalesDocumentNumberingSettings>(response)
  return {
    ...data,
    quotationPrefix: normalizePrefix(data.quotationPrefix || 'QT'),
    saleOrderPrefix: normalizePrefix(data.saleOrderPrefix || 'SO'),
  }
}

export async function updateSalesDocumentNumberingSettings(
  payload: UpdateSalesDocumentNumberingPayload,
) {
  const response = await apiClient.post(
    `${basePath}/update`,
    makeRpc({
      quotationPrefix: normalizePrefix(payload.quotationPrefix),
      saleOrderPrefix: normalizePrefix(payload.saleOrderPrefix),
    }),
  )
  const data = unwrapResponse<SalesDocumentNumberingSettings>(response)
  return {
    ...data,
    quotationPrefix: normalizePrefix(data.quotationPrefix || 'QT'),
    saleOrderPrefix: normalizePrefix(data.saleOrderPrefix || 'SO'),
  }
}

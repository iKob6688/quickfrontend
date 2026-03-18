import { apiClient } from '@/api/client'
import { unwrapResponse } from '@/api/response'
import { makeRpc } from '@/api/services/rpc'

export interface StockPickingMoveLine {
  id: number
  productId?: number | null
  productName?: string
  orderedQty: number
  doneQty: number
  uom?: string | null
}

export interface StockPickingDetail {
  id: number
  name: string
  state: string
  pickingTypeCode: 'outgoing' | 'incoming' | string
  scheduledDate?: string | null
  dateDone?: string | null
  origin?: string | null
  partnerName?: string | null
  moves: StockPickingMoveLine[]
}

export async function getSalesDelivery(id: number) {
  const response = await apiClient.post(`/th/v1/sales/deliveries/${id}`, makeRpc({ id }))
  return unwrapResponse<StockPickingDetail>(response)
}

export async function validateSalesDelivery(id: number) {
  const response = await apiClient.post(`/th/v1/sales/deliveries/${id}/validate`, makeRpc({ id }))
  return unwrapResponse<StockPickingDetail>(response)
}

export async function getPurchaseReceipt(id: number) {
  const response = await apiClient.post(`/th/v1/purchases/receipts/${id}`, makeRpc({ id }))
  return unwrapResponse<StockPickingDetail>(response)
}

export async function validatePurchaseReceipt(id: number) {
  const response = await apiClient.post(`/th/v1/purchases/receipts/${id}/validate`, makeRpc({ id }))
  return unwrapResponse<StockPickingDetail>(response)
}

export async function fetchSalesDeliveryPdf(id: number) {
  const response = await apiClient.get(`/th/v1/sales/deliveries/${id}/pdf`, {
    responseType: 'arraybuffer',
    headers: { Accept: 'application/pdf,application/json' },
  })
  const contentType = String(response.headers?.['content-type'] ?? '')
  if (contentType.includes('application/pdf')) {
    return new Blob([response.data], { type: 'application/pdf' })
  }
  throw new Error('Delivery PDF response is not a PDF document')
}

export async function openSalesDeliveryPdf(id: number) {
  const blob = await fetchSalesDeliveryPdf(id)
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener,noreferrer')
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

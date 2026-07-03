import { apiClient } from '@/api/client'
import { unwrapResponse } from '@/api/response'
import { makeRpc } from '@/api/services/rpc'

export interface InitializeChonlateeBillingPayload {
  preparedByEmployeeId?: number | null
  preparedByUserId?: number | null
  preparedByName?: string
  billingPeriod?: string
  billingSubject?: string
  reference?: string
  contactName?: string
  contactPhone?: string
  contactEmail?: string
  remarks?: string
}

export interface InitializeChonlateeBillingResult {
  invoiceId: number
  timesheetState?: string | null
  timesheetStartedAt?: string | null
}

export async function initializeChonlateeBillingInvoice(
  invoiceId: number,
  payload: InitializeChonlateeBillingPayload,
) {
  const response = await apiClient.post(
    `/th/v1/chonlatee-billing/invoices/${encodeURIComponent(String(invoiceId))}/initialize`,
    makeRpc({
      prepared_by_employee_id: payload.preparedByEmployeeId ?? null,
      prepared_by_user_id: payload.preparedByUserId ?? null,
      prepared_by_name: payload.preparedByName ?? '',
      billing_period: payload.billingPeriod ?? '',
      billing_subject: payload.billingSubject ?? '',
      reference: payload.reference ?? '',
      contact_name: payload.contactName ?? '',
      contact_phone: payload.contactPhone ?? '',
      contact_email: payload.contactEmail ?? '',
      remarks: payload.remarks ?? '',
    }),
  )
  return unwrapResponse<InitializeChonlateeBillingResult>(response)
}

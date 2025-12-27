import { apiClient } from '@/api/client'
import { unwrapResponse } from '@/api/response'
import { makeRpc } from '@/api/services/rpc'

export interface Tax {
  id: number
  name: string
  amount: number // Tax percentage (e.g., 7 for 7%)
  type: 'percent' | 'fixed' | 'group'
  typeTaxUse: 'sale' | 'purchase' | 'none'
  active: boolean
  vatCode?: string // VAT code (e.g., "VAT7" for 7% VAT)
  accountId?: number
  refundAccountId?: number
}

export interface TaxListItem {
  id: number
  name: string
  amount: number
  type: 'percent' | 'fixed' | 'group'
  typeTaxUse: 'sale' | 'purchase' | 'none'
  active: boolean
  vatCode?: string
}

export interface TaxCalculationResult {
  baseAmount: number
  taxDetails: Array<{
    taxId: number
    taxName: string
    taxAmount: number // Amount of tax
    taxBase: number // Base amount for this tax
  }>
  totalTax: number
  total: number
  currency: string
}

export interface VatValidationResult {
  vatNumber: string
  isValid: boolean
  companyName?: string // If valid, returns registered company name
  address?: string // If valid, returns registered address
  errorCode?: string // If invalid, error code
  errorMessage?: string // If invalid, error message
}

export interface ListTaxesParams {
  type?: 'sale' | 'purchase' | 'none'
  active?: boolean
  search?: string
  includeVat?: boolean
  limit?: number
  offset?: number
}

// NOTE: backend reality (adt_th_api): taxes are exposed under /api/th/v1/taxes/*
const basePath = '/th/v1/taxes'

export async function listTaxes(params?: ListTaxesParams) {
  const body = makeRpc({
    ...(params?.type && { type: params.type }),
    ...(params?.active !== undefined && { active: params.active }),
    ...(params?.search && { search: params.search }),
    ...(params?.includeVat !== undefined && { include_vat: params.includeVat }),
    ...(params?.limit && { limit: params.limit }),
    ...(params?.offset && { offset: params.offset }),
  })
  const response = await apiClient.post(`${basePath}/list`, body)
  return unwrapResponse<TaxListItem[]>(response)
}

export async function calculateTax(params: {
  baseAmount: number
  taxIds: number[] // Tax IDs to apply
  currency?: string // Default: THB
}) {
  const body = makeRpc({
    base_amount: params.baseAmount,
    tax_ids: params.taxIds,
    ...(params.currency && { currency: params.currency }),
  })
  const response = await apiClient.post(`${basePath}/calculate`, body)
  return unwrapResponse<TaxCalculationResult>(response)
}

export async function validateVatNumber(params: {
  vatNumber: string // e.g., "0123456789012" (13 digits)
  countryCode?: string // Default: "TH"
}) {
  const body = makeRpc({
    vat_number: params.vatNumber,
    ...(params.countryCode && { country_code: params.countryCode }),
  })
  const response = await apiClient.post(`${basePath}/validate-vat`, body)
  return unwrapResponse<VatValidationResult>(response)
}


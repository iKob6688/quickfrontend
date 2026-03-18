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
  priceInclude?: boolean
}

export interface TaxAdminMeta {
  permissions: {
    canManageAdminFields: boolean
  }
  accounts: Array<{
    id: number
    code: string
    name: string
    displayName: string
    accountType?: string
  }>
}

export interface TaxAdminListItem extends TaxListItem {
  amountType?: 'percent' | 'fixed' | 'group'
  priceInclude?: boolean
  invoiceAccountId?: number | null
  refundAccountId?: number | null
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
    ...(params?.type && { type_tax_use: params.type }),
    ...(params?.active !== undefined && { active: params.active }),
    ...(params?.search && { q: params.search }),
    ...(params?.includeVat !== undefined && { include_vat_only: params.includeVat }),
    ...(params?.limit && { limit: params.limit }),
    ...(params?.offset && { offset: params.offset }),
  })
  const response = await apiClient.post(`${basePath}/list`, body)
  const raw = unwrapResponse<any>(response)
  const items = Array.isArray(raw) ? raw : Array.isArray(raw?.items) ? raw.items : []
  return items.map((t: any) => ({
    id: Number(t.id),
    name: String(t.name ?? ''),
    amount: Number(t.amount ?? 0),
    type: (t.amountType ?? t.amount_type ?? 'percent') as TaxListItem['type'],
    typeTaxUse: (t.typeTaxUse ?? t.type_tax_use ?? 'sale') as TaxListItem['typeTaxUse'],
    active: !!t.active,
    vatCode: t.vatCode ?? t.vat_code ?? undefined,
    priceInclude: t.priceInclude ?? t.price_include ?? undefined,
  }))
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
    vat: params.vatNumber,
    vat_number: params.vatNumber,
    ...(params.countryCode && { country_code: params.countryCode }),
  })
  const response = await apiClient.post(`${basePath}/vat/validate`, body)
  return unwrapResponse<VatValidationResult>(response)
}

export async function getTaxAdminMeta() {
  const body = makeRpc({})
  const tryPaths = ['/th/v1/taxes/admin/meta', '/web/adt/th/v1/taxes/admin/meta']
  let lastErr: unknown = null
  for (const path of tryPaths) {
    try {
      const response = await apiClient.post(path, body)
      return unwrapResponse<TaxAdminMeta>(response)
    } catch (e) {
      lastErr = e
    }
  }
  throw (lastErr instanceof Error ? lastErr : new Error('Error loading tax admin meta'))
}

export async function listTaxAdminItems(params?: {
  typeTaxUse?: 'sale' | 'purchase'
  activeOnly?: boolean | null
  q?: string
  vatOnly?: boolean
  limit?: number
}) {
  const body = makeRpc({
    ...(params?.typeTaxUse && { type_tax_use: params.typeTaxUse }),
    ...(params?.activeOnly !== undefined && params?.activeOnly !== null && { active: params.activeOnly }),
    ...(params?.q && { q: params.q }),
    ...(params?.vatOnly !== undefined && { vat_only: params.vatOnly }),
    ...(params?.limit && { limit: params.limit }),
  })
  const tryPaths = ['/th/v1/taxes/admin/list', '/web/adt/th/v1/taxes/admin/list']
  let lastErr: unknown = null
  for (const path of tryPaths) {
    try {
      const response = await apiClient.post(path, body)
      const raw = unwrapResponse<any>(response)
      const items = Array.isArray(raw?.items) ? raw.items : []
      return {
        items: items.map((t: any) => ({
          id: Number(t.id),
          name: String(t.name ?? ''),
          amount: Number(t.amount ?? 0),
          type: (t.amountType ?? t.amount_type ?? 'percent') as TaxListItem['type'],
          amountType: (t.amountType ?? t.amount_type ?? 'percent') as TaxAdminListItem['amountType'],
          typeTaxUse: (t.typeTaxUse ?? t.type_tax_use ?? 'sale') as TaxListItem['typeTaxUse'],
          active: !!t.active,
          priceInclude: !!(t.priceInclude ?? t.price_include),
          invoiceAccountId: t.invoiceAccountId ?? t.invoice_account_id ?? null,
          refundAccountId: t.refundAccountId ?? t.refund_account_id ?? null,
          vatCode: t.vatCode ?? t.vat_code ?? undefined,
        })) as TaxAdminListItem[],
        total: Number(raw?.total ?? items.length ?? 0),
      }
    } catch (e) {
      lastErr = e
    }
  }
  throw (lastErr instanceof Error ? lastErr : new Error('Error listing taxes (admin)'))
}

export async function createTaxAdminItem(payload: {
  name: string
  amount: number
  typeTaxUse: 'sale' | 'purchase'
  amountType?: 'percent' | 'fixed'
  active?: boolean
  priceInclude?: boolean
  invoiceAccountId?: number | null
  refundAccountId?: number | null
}) {
  const body = makeRpc({
    name: payload.name,
    amount: payload.amount,
    type_tax_use: payload.typeTaxUse,
    amount_type: payload.amountType ?? 'percent',
    active: payload.active ?? true,
    price_include: !!payload.priceInclude,
    invoice_account_id: payload.invoiceAccountId || false,
    refund_account_id: payload.refundAccountId || false,
  })
  const tryPaths = ['/th/v1/taxes/admin/create', '/web/adt/th/v1/taxes/admin/create']
  let lastErr: unknown = null
  for (const path of tryPaths) {
    try {
      const response = await apiClient.post(path, body)
      return unwrapResponse<TaxAdminListItem>(response)
    } catch (e) {
      lastErr = e
    }
  }
  throw (lastErr instanceof Error ? lastErr : new Error('Error creating tax'))
}

export async function updateTaxAdminItem(
  id: number,
  payload: Partial<{
    name: string
    amount: number
    active: boolean
    priceInclude: boolean
    invoiceAccountId: number | null
    refundAccountId: number | null
  }>,
) {
  const body = makeRpc({
    ...(payload.name !== undefined && { name: payload.name }),
    ...(payload.amount !== undefined && { amount: payload.amount }),
    ...(payload.active !== undefined && { active: payload.active }),
    ...(payload.priceInclude !== undefined && { price_include: payload.priceInclude }),
    ...(payload.invoiceAccountId !== undefined && { invoice_account_id: payload.invoiceAccountId || false }),
    ...(payload.refundAccountId !== undefined && { refund_account_id: payload.refundAccountId || false }),
  })
  const tryPaths = [`/th/v1/taxes/admin/${id}/update`, `/web/adt/th/v1/taxes/admin/${id}/update`]
  let lastErr: unknown = null
  for (const path of tryPaths) {
    try {
      const response = await apiClient.post(path, body)
      return unwrapResponse<TaxAdminListItem>(response)
    } catch (e) {
      lastErr = e
    }
  }
  throw (lastErr instanceof Error ? lastErr : new Error('Error updating tax'))
}

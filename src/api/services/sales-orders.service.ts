import { apiClient } from '@/api/client'
import { unwrapResponse } from '@/api/response'
import { makeRpc } from '@/api/services/rpc'
import {
  createInvoice,
  getInvoice,
  listInvoices,
  postInvoice,
  updateInvoice,
  type Invoice,
  type InvoiceLine,
  type InvoiceListItem,
} from '@/api/services/invoices.service'

export type SalesOrderStatus = 'draft' | 'sent' | 'sale' | 'done' | 'cancel'
export type SalesOrderType = 'quotation' | 'sale'

export interface SalesOrderLine {
  productId: number | null
  description: string
  quantity: number
  unitPrice: number
  discount?: number
  taxIds?: number[]
  subtotal: number
  totalTax: number
  total: number
}

export interface SalesOrderPayload {
  partnerId: number
  orderDate: string
  validityDate?: string
  currency: string
  orderType?: SalesOrderType
  lines: SalesOrderLine[]
  notes?: string
}

export interface SalesOrder extends SalesOrderPayload {
  id: number
  number?: string
  partnerName?: string
  status: SalesOrderStatus
  amountUntaxed: number
  totalTax: number
  total: number
  createdAt: string
  updatedAt: string
}

export interface SalesOrderListItem {
  id: number
  number: string
  partnerId: number
  partnerName: string
  orderDate: string
  validityDate?: string
  total: number
  status: SalesOrderStatus
  orderType: SalesOrderType
  currency: string
}

export interface ListSalesOrdersParams {
  status?: SalesOrderStatus
  orderType?: SalesOrderType
  search?: string
  partnerId?: number
  dateFrom?: string
  dateTo?: string
  limit?: number
  offset?: number
}

const basePath = '/th/v1/sales/orders'

// Compatibility tag: when backend has no /sales/orders, we keep intent in invoice notes.
const quotationTag = '[SO-TYPE:QUOTATION]'
const saleTag = '[SO-TYPE:SALE]'

interface BackendSalesOrder {
  id: number
  name?: string
  documentNumber?: string
  orderType?: SalesOrderType | 'quotation' | 'sale' | 'draft'
  type?: SalesOrderType | 'quotation' | 'sale' | 'draft'
  state?: string
  status?: string
  partner?: { id: number; name: string } | number | string
  customer?: { id: number; name: string } | number | string
  partnerId?: number
  customerId?: number
  partnerName?: string
  customerName?: string
  date_order?: string
  orderDate?: string
  validity_date?: string
  validityDate?: string
  currency?: string
  amount_total?: number | string
  amount_untaxed?: number | string
  amount_tax?: number | string
  notes?: string | null
  lines?: Array<{
    product_id?: number | null
    productId?: number | null
    description?: string
    name?: string
    quantity?: number | string
    price_unit?: number | string
    unitPrice?: number | string
    discount?: number | string
    tax_ids?: number[]
    taxIds?: number[]
    price_subtotal?: number | string
    subtotal?: number | string
    price_tax?: number | string
    totalTax?: number | string
    price_total?: number | string
    total?: number | string
  }>
  createdAt?: string
  updatedAt?: string
  create_date?: string
  write_date?: string
  [key: string]: unknown
}

function toNumber(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

function toSalesOrderStatusFromInvoice(status: Invoice['status'] | InvoiceListItem['status']): SalesOrderStatus {
  if (status === 'draft') return 'draft'
  if (status === 'posted') return 'sale'
  if (status === 'paid') return 'done'
  return 'cancel'
}

function parseOrderTypeFromNotes(notes?: string | null): SalesOrderType | null {
  const text = String(notes || '').toUpperCase()
  if (text.includes(saleTag)) return 'sale'
  if (text.includes(quotationTag)) return 'quotation'
  return null
}

function inferOrderTypeByStatus(status: SalesOrderStatus): SalesOrderType {
  return status === 'sale' || status === 'done' ? 'sale' : 'quotation'
}

function normalizeNotesWithOrderType(notes: string | undefined, orderType: SalesOrderType | undefined) {
  const raw = (notes || '').replace(quotationTag, '').replace(saleTag, '').trim()
  const tag = orderType === 'sale' ? saleTag : quotationTag
  return raw ? `${tag}\n${raw}` : tag
}

function mapStatus(raw: unknown): SalesOrderStatus {
  const v = String(raw ?? '').toLowerCase().trim()
  if (v === 'quotation' || v === 'draft') return 'draft'
  if (v === 'sent') return 'sent'
  if (v === 'sale' || v === 'confirmed') return 'sale'
  if (v === 'done' || v === 'locked') return 'done'
  if (v === 'cancel' || v === 'cancelled') return 'cancel'
  return 'draft'
}

function mapOrderType(raw: unknown, status: SalesOrderStatus): SalesOrderType {
  const v = String(raw ?? '').toLowerCase().trim()
  if (v === 'sale' || v === 'order') return 'sale'
  if (v === 'quotation' || v === 'quote' || v === 'draft') return 'quotation'
  return inferOrderTypeByStatus(status)
}

function extractPartner(backend: BackendSalesOrder): { partnerId: number; partnerName: string } {
  const source = backend.partner ?? backend.customer
  if (source && typeof source === 'object') {
    const row = source as { id?: unknown; name?: unknown }
    return {
      partnerId: toNumber(row.id),
      partnerName: typeof row.name === 'string' ? row.name : backend.partnerName || backend.customerName || '—',
    }
  }

  if (typeof source === 'number') {
    return {
      partnerId: source,
      partnerName: backend.partnerName || backend.customerName || `Partner #${source}`,
    }
  }

  if (typeof source === 'string') {
    return {
      partnerId: toNumber(backend.partnerId ?? backend.customerId),
      partnerName: source,
    }
  }

  return {
    partnerId: toNumber(backend.partnerId ?? backend.customerId),
    partnerName: backend.partnerName || backend.customerName || '—',
  }
}

function mapBackendOrderToListItem(backend: BackendSalesOrder): SalesOrderListItem {
  const status = mapStatus(backend.status ?? backend.state)
  const orderType = mapOrderType(backend.orderType ?? backend.type, status)
  const partner = extractPartner(backend)

  return {
    id: backend.id,
    number: String(backend.documentNumber ?? backend.name ?? ''),
    partnerId: partner.partnerId,
    partnerName: partner.partnerName,
    orderDate: String(backend.orderDate ?? backend.date_order ?? ''),
    validityDate: backend.validityDate ? String(backend.validityDate) : backend.validity_date ? String(backend.validity_date) : undefined,
    total: toNumber(backend.amount_total),
    status,
    orderType,
    currency: String(backend.currency ?? 'THB'),
  }
}

function mapBackendOrderToDetail(backend: BackendSalesOrder): SalesOrder {
  const listItem = mapBackendOrderToListItem(backend)
  const lines = (backend.lines ?? []).map((line) => ({
    productId: line.productId ?? line.product_id ?? null,
    description: String(line.description ?? line.name ?? ''),
    quantity: toNumber(line.quantity),
    unitPrice: toNumber(line.unitPrice ?? line.price_unit),
    discount: toNumber(line.discount),
    taxIds: Array.isArray(line.taxIds) ? line.taxIds : Array.isArray(line.tax_ids) ? line.tax_ids : [],
    subtotal: toNumber(line.subtotal ?? line.price_subtotal),
    totalTax: toNumber(line.totalTax ?? line.price_tax),
    total: toNumber(line.total ?? line.price_total),
  }))

  return {
    id: listItem.id,
    number: listItem.number,
    partnerId: listItem.partnerId,
    partnerName: listItem.partnerName,
    orderDate: listItem.orderDate,
    validityDate: listItem.validityDate,
    currency: listItem.currency,
    orderType: listItem.orderType,
    status: listItem.status,
    lines,
    notes: backend.notes ?? undefined,
    amountUntaxed: toNumber(backend.amount_untaxed),
    totalTax: toNumber(backend.amount_tax),
    total: toNumber(backend.amount_total),
    createdAt: String(backend.createdAt ?? backend.create_date ?? backend.orderDate ?? backend.date_order ?? ''),
    updatedAt: String(backend.updatedAt ?? backend.write_date ?? backend.orderDate ?? backend.date_order ?? ''),
  }
}

function toBackendPayload(payload: SalesOrderPayload) {
  return {
    partner_id: payload.partnerId,
    order_date: payload.orderDate,
    ...(payload.validityDate ? { validity_date: payload.validityDate } : {}),
    currency: payload.currency,
    order_type: payload.orderType ?? 'quotation',
    lines: payload.lines.map((line) => ({
      product_id: line.productId,
      description: line.description,
      quantity: line.quantity,
      unit_price: line.unitPrice,
      ...(typeof line.discount === 'number' ? { discount: line.discount } : {}),
      ...(Array.isArray(line.taxIds) ? { tax_ids: line.taxIds } : {}),
    })),
    ...(payload.notes ? { notes: payload.notes } : {}),
  }
}

function extractHttpStatus(err: unknown): number | null {
  if (!err || typeof err !== 'object') return null
  const maybe = err as { response?: { status?: unknown } }
  return typeof maybe.response?.status === 'number' ? maybe.response.status : null
}

function shouldFallbackToInvoice(err: unknown): boolean {
  const status = extractHttpStatus(err)
  return status === 404 || status === 405 || status === 501
}

function mapInvoiceLineToSalesOrderLine(line: InvoiceLine): SalesOrderLine {
  const quantity = toNumber(line.quantity)
  const unitPrice = toNumber(line.unitPrice)
  const subtotal = toNumber(line.subtotal)
  const totalTax = toNumber(line.taxRate) > 0 ? (subtotal * toNumber(line.taxRate)) / 100 : 0
  return {
    productId: line.productId ?? null,
    description: line.description || '',
    quantity,
    unitPrice,
    subtotal,
    totalTax,
    total: subtotal + totalTax,
  }
}

function mapInvoiceToSalesOrderDetail(inv: Invoice): SalesOrder {
  const status = toSalesOrderStatusFromInvoice(inv.status)
  const taggedType = parseOrderTypeFromNotes(inv.notes)
  return {
    id: inv.id,
    number: inv.number,
    partnerId: inv.customerId,
    partnerName: inv.customerName,
    orderDate: inv.invoiceDate || inv.createdAt || '',
    validityDate: inv.dueDate || undefined,
    currency: inv.currency,
    orderType: taggedType ?? inferOrderTypeByStatus(status),
    status,
    lines: (inv.lines || []).map(mapInvoiceLineToSalesOrderLine),
    notes: inv.notes,
    amountUntaxed: toNumber(inv.amountUntaxed),
    totalTax: toNumber(inv.totalTax),
    total: toNumber(inv.total),
    createdAt: inv.createdAt,
    updatedAt: inv.updatedAt,
  }
}

function mapInvoiceItemToSalesOrderListItem(inv: InvoiceListItem): SalesOrderListItem {
  const status = toSalesOrderStatusFromInvoice(inv.status)
  return {
    id: inv.id,
    number: inv.number || `#${inv.id}`,
    partnerId: inv.customerId,
    partnerName: inv.customerName,
    orderDate: inv.invoiceDate,
    validityDate: inv.dueDate,
    total: toNumber(inv.total),
    status,
    orderType: inferOrderTypeByStatus(status),
    currency: inv.currency || 'THB',
  }
}

function mapSalesOrderStatusToInvoiceStatus(status?: SalesOrderStatus): 'draft' | 'posted' | 'paid' | 'cancelled' | undefined {
  if (!status) return undefined
  if (status === 'draft' || status === 'sent') return 'draft'
  if (status === 'sale') return 'posted'
  if (status === 'done') return 'paid'
  return 'cancelled'
}

function toInvoicePayload(payload: SalesOrderPayload) {
  return {
    customerId: payload.partnerId,
    invoiceDate: payload.orderDate,
    dueDate: payload.validityDate || payload.orderDate,
    currency: payload.currency,
    notes: normalizeNotesWithOrderType(payload.notes, payload.orderType),
    lines: payload.lines.map((line) => ({
      productId: line.productId,
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      taxRate: 0,
      subtotal: line.subtotal,
    })),
  }
}

async function listSalesOrdersViaInvoice(params?: ListSalesOrdersParams) {
  const rows = await listInvoices({
    status: mapSalesOrderStatusToInvoiceStatus(params?.status),
    search: params?.search,
    limit: params?.limit,
    offset: params?.offset,
    dateFrom: params?.dateFrom,
    dateTo: params?.dateTo,
  })
  let mapped = rows.map(mapInvoiceItemToSalesOrderListItem)
  if (params?.orderType) {
    mapped = mapped.filter((row) => row.orderType === params.orderType)
  }
  return mapped
}

export async function listSalesOrders(params?: ListSalesOrdersParams) {
  const body = makeRpc({
    ...(params?.status ? { status: params.status } : {}),
    ...(params?.orderType ? { order_type: params.orderType } : {}),
    ...(params?.search ? { search: params.search } : {}),
    ...(params?.partnerId ? { partner_id: params.partnerId } : {}),
    ...(params?.dateFrom ? { date_from: params.dateFrom } : {}),
    ...(params?.dateTo ? { date_to: params.dateTo } : {}),
    ...(params?.limit ? { limit: params.limit } : {}),
    ...(params?.offset ? { offset: params.offset } : {}),
  })

  try {
    const response = await apiClient.post(`${basePath}/list`, body)
    const data = unwrapResponse<BackendSalesOrder[] | { items?: BackendSalesOrder[] }>(response)
    const rows = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []
    return rows.map(mapBackendOrderToListItem)
  } catch (err) {
    if (shouldFallbackToInvoice(err)) return listSalesOrdersViaInvoice(params)
    throw err
  }
}

export async function getSalesOrder(id: number) {
  try {
    const response = await apiClient.post(`${basePath}/${id}`, makeRpc({ id }))
    const data = unwrapResponse<BackendSalesOrder>(response)
    return mapBackendOrderToDetail(data)
  } catch (err) {
    if (shouldFallbackToInvoice(err)) {
      const inv = await getInvoice(id)
      return mapInvoiceToSalesOrderDetail(inv)
    }
    throw err
  }
}

export async function createSalesOrder(payload: SalesOrderPayload) {
  try {
    const response = await apiClient.post(basePath, makeRpc(toBackendPayload(payload)))
    const data = unwrapResponse<BackendSalesOrder>(response)
    return mapBackendOrderToDetail(data)
  } catch (err) {
    if (shouldFallbackToInvoice(err)) {
      const inv = await createInvoice(toInvoicePayload(payload))
      return mapInvoiceToSalesOrderDetail(inv)
    }
    throw err
  }
}

export async function updateSalesOrder(id: number, payload: SalesOrderPayload) {
  try {
    const response = await apiClient.put(`${basePath}/${id}`, makeRpc({ id, ...toBackendPayload(payload) }))
    const data = unwrapResponse<BackendSalesOrder>(response)
    return mapBackendOrderToDetail(data)
  } catch (err) {
    if (shouldFallbackToInvoice(err)) {
      const inv = await updateInvoice(id, toInvoicePayload(payload))
      return mapInvoiceToSalesOrderDetail(inv)
    }
    throw err
  }
}

export async function confirmSalesOrder(id: number) {
  try {
    const response = await apiClient.post(`${basePath}/${id}/confirm`, makeRpc({ id }))
    const data = unwrapResponse<BackendSalesOrder>(response)
    return mapBackendOrderToDetail(data)
  } catch (err) {
    if (shouldFallbackToInvoice(err)) {
      const inv = await postInvoice(id)
      return mapInvoiceToSalesOrderDetail(inv)
    }
    throw err
  }
}

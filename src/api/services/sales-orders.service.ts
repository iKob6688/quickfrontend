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
  lineType?: 'normal' | 'section' | 'note'
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

export interface SalesOrderAttachment {
  id?: number
  name: string
  url?: string
  size?: number
  type?: string
}

export interface SalesOrderPayload {
  partnerId?: number | null
  orderDate: string
  validityDate?: string
  currency: string
  orderType?: SalesOrderType
  lines: SalesOrderLine[]
  notes?: string
  customerNameText?: string
  customerAddressText?: string
  customerPhoneText?: string
  customerEmailText?: string
  customerTaxIdText?: string
  customerBranchText?: string
  internalNotes?: string
  paymentTermText?: string
  vatEnabled?: boolean
  vatRate?: number
  withholdingTaxEnabled?: boolean
  withholdingTaxRate?: number
  attachments?: SalesOrderAttachment[]
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
  deliveries?: Array<{ id: number; name?: string; state?: string; scheduled_date?: string | null }>
  invoices?: Array<{ id: number; name?: string; state?: string; amount_total?: number }>
}

export interface SalesOrderListItem {
  id: number
  number: string
  partnerId: number
  partnerName: string
  customerNameText?: string
  orderDate: string
  validityDate?: string
  total: number
  status: SalesOrderStatus
  orderType: SalesOrderType
  currency: string
  notes?: string
  jobCategory?: 'accounting' | 'closing' | 'registration' | 'other'
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
  customerNameText?: string | null
  customer_name_text?: string | null
  customerAddressText?: string | null
  customer_address_text?: string | null
  customerPhoneText?: string | null
  customer_phone_text?: string | null
  customerEmailText?: string | null
  customer_email_text?: string | null
  customerTaxIdText?: string | null
  customer_tax_id_text?: string | null
  customerBranchText?: string | null
  customer_branch_text?: string | null
  internalNotes?: string | null
  internal_notes?: string | null
  paymentTermText?: string | null
  payment_term_text?: string | null
  vatEnabled?: boolean | null
  vat_enabled?: boolean | null
  vatRate?: number | string | null
  vat_rate?: number | string | null
  withholdingTaxEnabled?: boolean | null
  withholding_tax_enabled?: boolean | null
  withholdingTaxRate?: number | string | null
  withholding_tax_rate?: number | string | null
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
    display_type?: 'line_section' | 'line_note' | string | null
  }>
  createdAt?: string
  updatedAt?: string
  create_date?: string
  write_date?: string
  attachments?: Array<{ name?: string; url?: string; size?: number; type?: string }>
  attachment_files?: Array<{ name?: string; url?: string; size?: number; type?: string }>
  deliveries?: Array<{ id: number; name?: string; state?: string; scheduled_date?: string | null }>
  invoices?: Array<{ id: number; name?: string; state?: string; amount_total?: number }>
  [key: string]: unknown
}

function isBackendSalesOrder(value: unknown): value is BackendSalesOrder {
  return Boolean(value && typeof value === 'object' && 'id' in value)
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

function getBackendCustomerNameText(backend: BackendSalesOrder) {
  return backend.customerNameText ?? backend.customer_name_text ?? undefined
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
      partnerName:
        typeof row.name === 'string'
          ? row.name
          : getBackendCustomerNameText(backend) || backend.partnerName || backend.customerName || 'ไม่ระบุลูกค้า',
    }
  }

  if (typeof source === 'number') {
    return {
      partnerId: source,
      partnerName: getBackendCustomerNameText(backend) || backend.partnerName || backend.customerName || `Partner #${source}`,
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
    partnerName: getBackendCustomerNameText(backend) || backend.partnerName || backend.customerName || 'ไม่ระบุลูกค้า',
  }
}

function mapBackendOrderToListItem(backend: BackendSalesOrder): SalesOrderListItem {
  const status = mapStatus(backend.status ?? backend.state)
  const orderType = mapOrderType(backend.orderType ?? backend.type, status)
  const partner = extractPartner(backend)
  const notes = typeof backend.notes === 'string' ? backend.notes : undefined
  const customerNameText = getBackendCustomerNameText(backend)
  const text = `${notes ?? ''}`.toLowerCase()
  const jobCategory: SalesOrderListItem['jobCategory'] =
    /ปิดงบ|financial statement|close company|fs\b/.test(text)
      ? 'closing'
      : /จดทะเบียน|registration|boi|fbl|visa|work permit|license/.test(text)
        ? 'registration'
        : /บัญชี|account|bookkeep|outsourcing/.test(text)
          ? 'accounting'
          : 'other'

  return {
    id: backend.id,
    number: String(backend.documentNumber ?? backend.name ?? ''),
    partnerId: partner.partnerId,
    partnerName: partner.partnerName,
    customerNameText,
    orderDate: String(backend.orderDate ?? backend.date_order ?? ''),
    validityDate: backend.validityDate ? String(backend.validityDate) : backend.validity_date ? String(backend.validity_date) : undefined,
    total: toNumber(backend.amount_total),
    status,
    orderType,
    currency: String(backend.currency ?? 'THB'),
    notes,
    jobCategory,
  }
}

function mapBackendOrderToDetail(backend: BackendSalesOrder): SalesOrder {
  const listItem = mapBackendOrderToListItem(backend)
  const customerNameText = getBackendCustomerNameText(backend)
  const customerAddressText = backend.customerAddressText ?? backend.customer_address_text ?? undefined
  const customerPhoneText = backend.customerPhoneText ?? backend.customer_phone_text ?? undefined
  const customerEmailText = backend.customerEmailText ?? backend.customer_email_text ?? undefined
  const customerTaxIdText = backend.customerTaxIdText ?? backend.customer_tax_id_text ?? undefined
  const customerBranchText = backend.customerBranchText ?? backend.customer_branch_text ?? undefined
  const internalNotes = backend.internalNotes ?? backend.internal_notes ?? undefined
  const paymentTermText = backend.paymentTermText ?? backend.payment_term_text ?? undefined
  const vatEnabled =
    typeof backend.vatEnabled === 'boolean'
      ? backend.vatEnabled
      : typeof backend.vat_enabled === 'boolean'
        ? backend.vat_enabled
        : undefined
  const vatRate =
    backend.vatRate == null
      ? backend.vat_rate == null
        ? undefined
        : toNumber(backend.vat_rate)
      : toNumber(backend.vatRate)
  const withholdingTaxEnabled =
    typeof backend.withholdingTaxEnabled === 'boolean'
      ? backend.withholdingTaxEnabled
      : typeof backend.withholding_tax_enabled === 'boolean'
        ? backend.withholding_tax_enabled
        : undefined
  const withholdingTaxRate =
    backend.withholdingTaxRate == null
      ? backend.withholding_tax_rate == null
        ? undefined
        : toNumber(backend.withholding_tax_rate)
      : toNumber(backend.withholdingTaxRate)
  const attachments = Array.isArray(backend.attachments)
    ? backend.attachments
    : Array.isArray(backend.attachment_files)
      ? backend.attachment_files
      : []
  const lines: SalesOrderLine[] = (backend.lines ?? []).map((line) => {
    const lineType: SalesOrderLine['lineType'] =
      line.display_type === 'line_section'
        ? 'section'
        : line.display_type === 'line_note'
          ? 'note'
          : 'normal'

    return {
      lineType,
      productId: line.productId ?? line.product_id ?? null,
      description: String(line.description ?? line.name ?? ''),
      quantity: toNumber(line.quantity),
      unitPrice: toNumber(line.unitPrice ?? line.price_unit),
      discount: toNumber(line.discount),
      taxIds: Array.isArray(line.taxIds) ? line.taxIds : Array.isArray(line.tax_ids) ? line.tax_ids : [],
      subtotal: toNumber(line.subtotal ?? line.price_subtotal),
      totalTax: toNumber(line.totalTax ?? line.price_tax),
      total: toNumber(line.total ?? line.price_total),
    }
  })

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
    customerNameText,
    customerAddressText,
    customerPhoneText,
    customerEmailText,
    customerTaxIdText,
    customerBranchText,
    internalNotes,
    paymentTermText,
    vatEnabled,
    vatRate,
    withholdingTaxEnabled,
    withholdingTaxRate,
    attachments: attachments.length
      ? attachments
          .map((attachment) =>
            attachment?.name
              ? {
                  id: typeof (attachment as { id?: unknown }).id === 'number' ? Number((attachment as { id?: unknown }).id) : undefined,
                  name: String(attachment.name),
                  url: attachment.url ? String(attachment.url) : undefined,
                  size: typeof attachment.size === 'number' ? attachment.size : undefined,
                  type: attachment.type ? String(attachment.type) : undefined,
                }
              : null,
          )
          .filter((attachment): attachment is NonNullable<typeof attachment> => Boolean(attachment))
      : undefined,
    amountUntaxed: toNumber(backend.amount_untaxed),
    totalTax: toNumber(backend.amount_tax),
    total: toNumber(backend.amount_total),
    createdAt: String(backend.createdAt ?? backend.create_date ?? backend.orderDate ?? backend.date_order ?? ''),
    updatedAt: String(backend.updatedAt ?? backend.write_date ?? backend.orderDate ?? backend.date_order ?? ''),
    deliveries: Array.isArray(backend.deliveries) ? backend.deliveries : [],
    invoices: Array.isArray(backend.invoices) ? backend.invoices : [],
  }
}

function getCompatibleCustomerSummary(payload: SalesOrderPayload) {
  const parts = [
    payload.customerNameText ? `ชื่อ: ${payload.customerNameText}` : '',
    payload.customerAddressText ? `ที่อยู่: ${payload.customerAddressText}` : '',
    payload.customerPhoneText ? `โทรศัพท์: ${payload.customerPhoneText}` : '',
    payload.customerEmailText ? `อีเมล: ${payload.customerEmailText}` : '',
    payload.customerTaxIdText ? `เลขผู้เสียภาษี: ${payload.customerTaxIdText}` : '',
    payload.customerBranchText ? `สาขา: ${payload.customerBranchText}` : '',
    payload.paymentTermText ? `เงื่อนไขชำระเงิน: ${payload.paymentTermText}` : '',
  ].filter(Boolean)
  return parts.join('\n')
}

function getCompatibleNotes(payload: SalesOrderPayload, includeExtraInfo: boolean) {
  const notes = String(payload.notes || '').trim()
  const internalNotes = String(payload.internalNotes || '').trim()
  if (!includeExtraInfo) {
    return notes || undefined
  }

  const blocks = [notes ? `หมายเหตุลูกค้า:\n${notes}` : '', internalNotes ? `โน้ตภายในบริษัท:\n${internalNotes}` : '']
    .filter(Boolean)
    .join('\n\n')
  const customerSummary = getCompatibleCustomerSummary(payload)
  const attachmentSummary =
    Array.isArray(payload.attachments) && payload.attachments.length > 0
      ? `เอกสารแนบ:\n${payload.attachments.map((attachment) => `- ${attachment.name}`).join('\n')}`
      : ''

  return [blocks, customerSummary ? `ข้อมูลลูกค้าแบบกรอกเอง:\n${customerSummary}` : '', attachmentSummary]
    .filter(Boolean)
    .join('\n\n')
    .trim() || undefined
}

function toBackendPayload(payload: SalesOrderPayload, mode: 'full' | 'legacy' = 'full') {
  const isLegacy = mode === 'legacy'
  const body: Record<string, unknown> = {
    order_date: payload.orderDate,
    ...(payload.validityDate ? { validity_date: payload.validityDate } : {}),
    currency: payload.currency,
    order_type: payload.orderType ?? 'quotation',
    lines: (payload.lines || []).map((line) => ({
      ...(line.lineType && line.lineType !== 'normal' && !isLegacy
        ? { display_type: line.lineType === 'section' ? 'line_section' : 'line_note' }
        : {}),
      product_id: line.productId,
      description: line.description,
      quantity: line.lineType && line.lineType !== 'normal' ? 0 : line.quantity,
      unit_price: line.lineType && line.lineType !== 'normal' ? 0 : line.unitPrice,
      ...(typeof line.discount === 'number' && (!line.lineType || line.lineType === 'normal') ? { discount: line.discount } : {}),
      ...(Array.isArray(line.taxIds) && (!line.lineType || line.lineType === 'normal') ? { tax_ids: line.taxIds } : {}),
    })),
    ...(getCompatibleNotes(payload, isLegacy) ? { notes: getCompatibleNotes(payload, isLegacy) } : {}),
  }

  if (typeof payload.partnerId === 'number' && payload.partnerId > 0) {
    body.partner_id = payload.partnerId
  }

  if (!isLegacy) {
    // Full mode keeps all customer-entered free-text fields available for backends that support them.
    if (payload.customerNameText) body.customer_name_text = payload.customerNameText
    if (payload.customerAddressText) body.customer_address_text = payload.customerAddressText
    if (payload.customerPhoneText) body.customer_phone_text = payload.customerPhoneText
    if (payload.customerEmailText) body.customer_email_text = payload.customerEmailText
    if (payload.customerTaxIdText) body.customer_tax_id_text = payload.customerTaxIdText
    if (payload.customerBranchText) body.customer_branch_text = payload.customerBranchText

    if (payload.internalNotes) body.internal_notes = payload.internalNotes
    if (payload.paymentTermText) body.payment_term_text = payload.paymentTermText
    if (typeof payload.vatEnabled === 'boolean') body.vat_enabled = payload.vatEnabled
    if (typeof payload.vatRate === 'number') body.vat_rate = payload.vatRate
    if (typeof payload.withholdingTaxEnabled === 'boolean') body.withholding_tax_enabled = payload.withholdingTaxEnabled
    if (typeof payload.withholdingTaxRate === 'number') body.withholding_tax_rate = payload.withholdingTaxRate
    if (Array.isArray(payload.attachments) && payload.attachments.length > 0) {
      body.attachments = payload.attachments.map((attachment) => ({
        name: attachment.name,
        url: attachment.url,
        size: attachment.size,
        type: attachment.type,
      }))
    }
  }

  return body
}

function toAttachmentFormData(fileList: File[]) {
  const form = new FormData()
  for (const file of fileList) {
    form.append('ufile', file)
  }
  return form
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

function isLegacyFallbackEligible(err: unknown): boolean {
  const status = extractHttpStatus(err)
  if (status !== 400 && status !== 422) return false
  const message = err instanceof Error ? err.message : String((err as { message?: unknown } | null)?.message ?? '')
  return /unknown|unexpected|invalid field|field .* does not exist|display_type|internal_notes|customer_.*text|attachment/i.test(message)
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
  if (!(typeof payload.partnerId === 'number' && payload.partnerId > 0)) {
    throw new Error('ยังไม่สามารถบันทึกผ่านระบบสำรองได้ เพราะไม่มีลูกค้าที่ถูกเลือก กรุณาเปิด backend sales order ที่รองรับการกรอกชื่อลูกค้าเอง')
  }
  return {
    customerId: payload.partnerId,
    invoiceDate: payload.orderDate,
    dueDate: payload.validityDate || payload.orderDate,
    currency: payload.currency,
    notes: normalizeNotesWithOrderType(payload.notes, payload.orderType),
    lines: (payload.lines || []).map((line) => ({
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
    // New schema fields may be rejected by older deployments; retry once with the legacy payload.
    if (isLegacyFallbackEligible(err)) {
      const legacyResponse = await apiClient.post(basePath, makeRpc(toBackendPayload(payload, 'legacy')))
      const legacyData = unwrapResponse<BackendSalesOrder>(legacyResponse)
      return mapBackendOrderToDetail(legacyData)
    }
    if (shouldFallbackToInvoice(err)) {
      // Invoice fallback is only safe when a real customer exists; otherwise the backend could create a wrong record.
      if (!(typeof payload.partnerId === 'number' && payload.partnerId > 0)) {
        throw new Error('ระบบใบเสนอราคาใช้งานไม่ได้และไม่สามารถใช้ระบบสำรองได้ เพราะยังไม่มีลูกค้าที่ถูกเลือก กรุณาเปิด backend sales order ที่รองรับการกรอกชื่อลูกค้าเอง')
      }
      try {
        const inv = await createInvoice(toInvoicePayload(payload))
        return mapInvoiceToSalesOrderDetail(inv)
      } catch {
        throw new Error('ไม่สามารถบันทึกผ่านระบบสำรองได้ กรุณาลองอีกครั้งหรือเปิด backend sales order ที่รองรับการบันทึกใบเสนอราคาโดยตรง')
      }
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
    // New schema fields may be rejected by older deployments; retry once with the legacy payload.
    if (isLegacyFallbackEligible(err)) {
      const legacyResponse = await apiClient.put(`${basePath}/${id}`, makeRpc({ id, ...toBackendPayload(payload, 'legacy') }))
      const legacyData = unwrapResponse<BackendSalesOrder>(legacyResponse)
      return mapBackendOrderToDetail(legacyData)
    }
    if (shouldFallbackToInvoice(err)) {
      // Invoice fallback is only safe when a real customer exists; otherwise the backend could create a wrong record.
      if (!(typeof payload.partnerId === 'number' && payload.partnerId > 0)) {
        throw new Error('ระบบใบเสนอราคาใช้งานไม่ได้และไม่สามารถใช้ระบบสำรองได้ เพราะยังไม่มีลูกค้าที่ถูกเลือก กรุณาเปิด backend sales order ที่รองรับการกรอกชื่อลูกค้าเอง')
      }
      try {
        const inv = await updateInvoice(id, toInvoicePayload(payload))
        return mapInvoiceToSalesOrderDetail(inv)
      } catch {
        throw new Error('ไม่สามารถบันทึกผ่านระบบสำรองได้ กรุณาลองอีกครั้งหรือเปิด backend sales order ที่รองรับการบันทึกใบเสนอราคาโดยตรง')
      }
    }
    throw err
  }
}

export interface SalesOrderAttachmentUploadResult {
  attachments: SalesOrderAttachment[]
}

export async function uploadSalesOrderAttachments(orderId: number, files: File[]) {
  if (!Number.isFinite(orderId) || orderId <= 0 || !files.length) {
    return []
  }

  const response = await apiClient.post(
    `${basePath}/${orderId}/attachments/upload`,
    toAttachmentFormData(files),
    {
      headers: { 'Content-Type': 'multipart/form-data' },
    },
  )

  const data = unwrapResponse<SalesOrderAttachmentUploadResult | SalesOrderAttachment[]>(response)
  if (Array.isArray(data)) {
    return data
  }
  return Array.isArray(data.attachments) ? data.attachments : []
}

export async function deleteSalesOrderAttachment(orderId: number, attachmentId: number) {
  if (!Number.isFinite(orderId) || orderId <= 0 || !Number.isFinite(attachmentId) || attachmentId <= 0) {
    return false
  }

  const response = await apiClient.delete(`${basePath}/${orderId}/attachments/${attachmentId}`)
  const data = unwrapResponse<{ deleted?: boolean }>(response)
  return data.deleted !== false
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

export interface DeliverSalesOrderResponse {
  order: SalesOrder
  delivered?: boolean
  message?: string
}

export async function deliverSalesOrder(id: number) {
  const response = await apiClient.post(`${basePath}/${id}/deliver`, makeRpc({ id }))
  const data = unwrapResponse<{ order?: BackendSalesOrder } & Record<string, unknown>>(response)
  const orderData = isBackendSalesOrder(data.order) ? data.order : isBackendSalesOrder(data) ? data : undefined
  if (!orderData) {
    throw new Error('Invalid sales order deliver response')
  }
  return {
    ...data,
    order: mapBackendOrderToDetail(orderData),
  } as DeliverSalesOrderResponse
}

export interface CreateInvoiceFromSalesOrderResponse {
  invoiceId: number
  invoiceNumber?: string
  invoiceState?: string
  created?: boolean
  sourceOrderId?: number
  sourceOrderNumber?: string
}

export async function createInvoiceFromSalesOrder(id: number) {
  const response = await apiClient.post(`${basePath}/${id}/create-invoice`, makeRpc({ id }))
  return unwrapResponse<CreateInvoiceFromSalesOrderResponse>(response)
}

async function fetchPdfFromEndpoints(endpoints: string[]) {
  for (const url of endpoints) {
    try {
      const response = await apiClient.get(url, {
        responseType: 'arraybuffer',
        headers: { Accept: 'application/pdf,application/json' },
      })
      const contentType = String(response.headers?.['content-type'] ?? '')
      if (contentType.includes('application/pdf')) {
        return new Blob([response.data], { type: 'application/pdf' })
      }
    } catch {
      // try next endpoint
    }
  }
  return null
}

export async function fetchSalesOrderPdf(id: number) {
  const endpoints = [
    `${basePath}/${id}/pdf`,
    `/web/adt/th/v1/sales/orders/${id}/pdf`,
  ]

  const directBlob = await fetchPdfFromEndpoints(endpoints)
  if (directBlob) return directBlob
  throw new Error('Sales order / quotation PDF endpoint not available')
}

export async function openSalesOrderPdf(id: number) {
  const blob = await fetchSalesOrderPdf(id)
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener,noreferrer')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export interface SendSalesOrderEmailPayload {
  emailTo: string
  contactId?: number
  subject?: string
  message?: string
}

export async function sendSalesOrderEmail(id: number, payload: SendSalesOrderEmailPayload) {
  const body = makeRpc({
    email_to: payload.emailTo,
    ...(payload.contactId ? { contact_id: payload.contactId } : {}),
    ...(payload.subject ? { subject: payload.subject } : {}),
    ...(payload.message ? { message: payload.message } : {}),
  })

  const endpoints = [
    `${basePath}/${id}/send-email`,
    `/web/adt/th/v1/sales/orders/${id}/send-email`,
    `${basePath}/${id}/email/send`,
    `/web/adt/th/v1/sales/orders/${id}/email/send`,
    `/th/v1/sales/invoices/${id}/send-email`,
  ]

  let lastError: unknown = null
  for (const url of endpoints) {
    try {
      const response = await apiClient.post(url, body)
      return unwrapResponse<Record<string, unknown> | { sent?: boolean }>(response)
    } catch (err) {
      lastError = err
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Send email endpoint not available')
}

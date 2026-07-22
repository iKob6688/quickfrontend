import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData, type QueryFunctionContext } from '@tanstack/react-query'
import { Alert, Modal, Spinner } from 'react-bootstrap'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Combobox, type ComboboxOption } from '@/components/ui/Combobox'
import { ProductCombobox } from '@/features/sales/ProductCombobox'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import { extractFieldErrors, type FieldErrors } from '@/lib/formErrors'
import { loadRecentNotes, pushRecentNote } from '@/lib/formDrafts'
import {
  clearSalesOrderDraft,
  loadSalesOrderDraft,
  loadSalesOrderPreferences,
  saveSalesOrderDraft,
  saveSalesOrderPreferences,
  sanitizeSalesOrderAttachments,
  type SalesOrderDraftPayload,
  type SalesOrderDraftPreferences,
  type SalesOrderAttachmentDraft,
} from '@/lib/salesOrderDrafts'
import { toast } from '@/lib/toastStore'
import { createPartner, getPartner, listPartners, type PartnerListResponse, type PartnerSummary, type PartnerUpsertPayload } from '@/api/services/partners.service'
import { getDefaultVatTaxId, listVatTaxes, type TaxAdminListItem } from '@/api/services/taxes.service'
import {
  createSalesOrder,
  deleteSalesOrderAttachment,
  getSalesOrder,
  fetchSalesOrderPdf,
  sendSalesOrderEmail,
  uploadSalesOrderAttachments,
  updateSalesOrder,
  type SalesOrderAttachment,
  type SalesOrderLine,
  type SalesOrderPayload,
  type SalesOrderType,
} from '@/api/services/sales-orders.service'
import { CountrySelector } from '@/features/customers/CountrySelector'
import { StateSelector } from '@/features/customers/StateSelector'
import {
  ThaiDistrictSelector,
  ThaiProvinceSelector,
  ThaiSubDistrictSelector,
} from '@/features/customers/ThaiAddressSelectors'
import { resolveThaiAddress } from '@/api/services/thai-address.service'
import { normalizeVatNumber, sanitizeVatNumber, thaiVatValidationMessage } from '@/lib/vat'
import { useAppDateTimeFormatter } from '@/lib/dateFormat'
import { calculateSalesOrderTotals } from '@/lib/salesOrderTotals'
import {
  getSalesOrderCustomerContactText,
  getSalesOrderCustomerDisplayName,
  getSalesOrderDocumentLabel,
  getSalesOrderDocumentTitle,
} from '@/lib/salesOrderPresentation'
import {
  DocumentPageLayout,
  useDocumentKeyboardShortcuts,
} from '@/features/document'

const SALES_ORDER_DRAFT_KEY = 'qf:draft:sales-order-form:create:v2'
const SALES_ORDER_PREFERENCES_KEY = 'qf:prefs:sales-order-form:v1'
const SALES_ORDER_RECENT_NOTES_KEY = 'qf:recent-notes:sales-order:v2'
const SALES_ORDER_RECENT_INTERNAL_NOTES_KEY = 'qf:recent-notes:sales-order-internal:v1'

function localDateInputValue(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function toNumberLike(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value.replace(/,/g, '').trim())
    return Number.isFinite(parsed) ? parsed : fallback
  }
  return fallback
}

function safeString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function stripLeadingProductCode(name: string, defaultCode?: string) {
  const rawName = name.trim()
  const code = String(defaultCode || '').trim()
  if (!rawName) return ''
  if (!code) return rawName

  const escapedCode = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`^\\[?${escapedCode}\\]?\\s*[-–—:]?\\s*`, 'i')
  const stripped = rawName.replace(pattern, '').trim()
  return stripped || rawName
}

function toAttachmentDraft(attachment: SalesOrderAttachment, file?: File): SalesOrderAttachmentDraft {
  return {
    id: attachment.id,
    name: attachment.name,
    url: attachment.url,
    size: attachment.size,
    type: attachment.type,
    file,
  }
}

type SalesOrderLineKind = 'normal' | 'section' | 'note'
function createSalesLine(lineType: SalesOrderLineKind = 'normal'): SalesOrderLine {
  return {
    lineType,
    productId: null,
    productCode: '',
    description: '',
    quantity: lineType === 'normal' ? 1 : 0,
    unitPrice: 0,
    discount: 0,
    discountPercent: 0,
    taxIds: [],
    subtotal: 0,
    totalTax: 0,
    total: 0,
  }
}

function normalizeSalesLine(line: Partial<SalesOrderLine>): SalesOrderLine {
  return {
    lineType: line.lineType === 'section' || line.lineType === 'note' ? line.lineType : 'normal',
    productId: line.productId ?? null,
    productCode: String(line.productCode || '').trim(),
    description: safeString(line.description),
    quantity: toNumberLike(line.quantity, 1),
    unitPrice: toNumberLike(line.unitPrice, 0),
    discount: toNumberLike(line.discountPercent ?? line.discount, 0),
    discountPercent: toNumberLike(line.discountPercent ?? line.discount, 0),
    taxIds: Array.isArray(line.taxIds)
      ? line.taxIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
      : [],
    subtotal: toNumberLike(line.subtotal, 0),
    totalTax: toNumberLike(line.totalTax, 0),
    total: toNumberLike(line.total, 0),
  }
}

type SalesOrderFormState = {
  partnerId: number | null
  orderDate: string
  validityDate?: string
  currency: string
  orderType: SalesOrderType
  paymentTermText: string
  customerNameText: string
  customerAddressText: string
  customerPhoneText: string
  customerEmailText: string
  customerTaxIdText: string
  customerBranchText: string
  internalNotes: string
  notes: string
  vatEnabled: boolean
  vatRate: number
  withholdingTaxEnabled: boolean
  withholdingTaxRate: number
  saveCustomerInfoForNextTime: boolean
  lines: SalesOrderLine[]
}

type QuickPartnerState = PartnerUpsertPayload & { city?: string }

function createBlankFormState(
  preferences: SalesOrderDraftPreferences,
  initialOrderType: SalesOrderType,
): SalesOrderFormState {
  return {
    partnerId: null,
    orderDate: localDateInputValue(),
    validityDate: localDateInputValue(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
    currency: preferences.currency || 'THB',
    orderType: initialOrderType,
    paymentTermText: preferences.paymentTermText || '7 วัน',
    customerNameText: preferences.customerNameText || '',
    customerAddressText: preferences.customerAddressText || '',
    customerPhoneText: preferences.customerPhoneText || '',
    customerEmailText: preferences.customerEmailText || '',
    customerTaxIdText: preferences.customerTaxIdText || '',
    customerBranchText: preferences.customerBranchText || '',
    internalNotes: '',
    notes: '',
    vatEnabled: preferences.vatEnabled ?? true,
    vatRate: preferences.vatRate ?? 7,
    withholdingTaxEnabled: preferences.withholdingTaxEnabled ?? false,
    withholdingTaxRate: preferences.withholdingTaxRate ?? 3,
    saveCustomerInfoForNextTime: Boolean(preferences.customerNameText || preferences.customerAddressText || preferences.customerPhoneText || preferences.customerEmailText),
    lines: [],
  }
}

function normalizeDraftState(
  draft: SalesOrderDraftPayload,
  preferences: SalesOrderDraftPreferences,
  initialOrderType: SalesOrderType,
): SalesOrderFormState {
  const base = createBlankFormState(preferences, initialOrderType)
  return {
    ...base,
    partnerId: typeof draft.partnerId === 'number' ? draft.partnerId : draft.partnerId ?? null,
    orderDate: draft.orderDate || base.orderDate,
    validityDate: draft.validityDate || base.validityDate,
    currency: draft.currency || base.currency,
    orderType: draft.orderType || base.orderType,
    paymentTermText: draft.paymentTermText || base.paymentTermText,
    customerNameText: draft.customerNameText || base.customerNameText,
    customerAddressText: draft.customerAddressText || base.customerAddressText,
    customerPhoneText: draft.customerPhoneText || base.customerPhoneText,
    customerEmailText: draft.customerEmailText || base.customerEmailText,
    customerTaxIdText: draft.customerTaxIdText || base.customerTaxIdText,
    customerBranchText: draft.customerBranchText || base.customerBranchText,
    internalNotes: draft.internalNotes || '',
    notes: draft.notes || '',
    vatEnabled: typeof draft.vatEnabled === 'boolean' ? draft.vatEnabled : base.vatEnabled,
    vatRate: typeof draft.vatRate === 'number' ? draft.vatRate : base.vatRate,
    withholdingTaxEnabled:
      typeof draft.withholdingTaxEnabled === 'boolean' ? draft.withholdingTaxEnabled : base.withholdingTaxEnabled,
    withholdingTaxRate: typeof draft.withholdingTaxRate === 'number' ? draft.withholdingTaxRate : base.withholdingTaxRate,
    lines: (draft.lines || []).map((line) => normalizeSalesLine(line)),
  }
}

function normalizeOrderToFormState(
  order: Awaited<ReturnType<typeof getSalesOrder>>,
  preferences: SalesOrderDraftPreferences,
): SalesOrderFormState {
  const base = createBlankFormState(preferences, order.orderType || 'quotation')
  const partnerId = typeof order.partnerId === 'number' && order.partnerId > 0 ? order.partnerId : null
  return {
    ...base,
    partnerId,
    orderDate: order.orderDate || base.orderDate,
    validityDate: order.validityDate || base.validityDate,
    currency: order.currency || base.currency,
    orderType: order.orderType || base.orderType,
    paymentTermText: order.paymentTermText || base.paymentTermText,
    customerNameText: order.customerNameText || order.partnerName || base.customerNameText,
    customerAddressText: order.customerAddressText || base.customerAddressText,
    customerPhoneText: order.customerPhoneText || base.customerPhoneText,
    customerEmailText: order.customerEmailText || base.customerEmailText,
    customerTaxIdText: order.customerTaxIdText || base.customerTaxIdText,
    customerBranchText: order.customerBranchText || base.customerBranchText,
    internalNotes: order.internalNotes || '',
    notes: order.notes || '',
    vatEnabled: typeof order.vatEnabled === 'boolean' ? order.vatEnabled : base.vatEnabled,
    vatRate: typeof order.vatRate === 'number' ? order.vatRate : base.vatRate,
    withholdingTaxEnabled:
      typeof order.withholdingTaxEnabled === 'boolean' ? order.withholdingTaxEnabled : base.withholdingTaxEnabled,
    withholdingTaxRate: typeof order.withholdingTaxRate === 'number' ? order.withholdingTaxRate : base.withholdingTaxRate,
    lines: order.lines.map((line) => normalizeSalesLine(line)),
  }
}

function hasMeaningfulSalesOrderDraft(data: SalesOrderFormState, attachmentCount: number) {
  return Boolean(
    (data.partnerId && data.partnerId > 0) ||
      data.lines.length > 0 ||
      data.notes.trim() ||
      data.internalNotes.trim() ||
      data.customerNameText.trim() ||
      data.customerAddressText.trim() ||
      data.customerPhoneText.trim() ||
      data.customerEmailText.trim() ||
      data.customerTaxIdText.trim() ||
      data.customerBranchText.trim() ||
      data.paymentTermText.trim() ||
      data.validityDate !== localDateInputValue(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)) ||
      data.orderDate !== localDateInputValue() ||
      data.currency.trim().toUpperCase() !== 'THB' ||
      attachmentCount > 0 ||
      data.orderType !== 'quotation' ||
      !data.vatEnabled ||
      data.withholdingTaxEnabled,
  )
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function asCurrency(value: number, currency: string) {
  return `${currency || 'THB'} ${value.toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatSalesOrderStatus(status?: string) {
  const value = String(status || 'draft').toLowerCase()
  if (value === 'sent') return 'ส่งแล้ว'
  if (value === 'sale') return 'ยืนยันแล้ว'
  if (value === 'done') return 'เสร็จแล้ว'
  if (value === 'cancel') return 'ยกเลิก'
  return 'ร่าง'
}

function buildPrintHtml(params: {
  title: string
  documentNumber: string
  customerName: string
  customerAddress: string
  customerContact: string
  orderDate: string
  paymentTermText: string
  validityDate: string
  currency: string
  notes: string
  lines: Array<{ description: string; quantity: number; unitPrice: number; total: number; lineType?: SalesOrderLineKind }>
  grossSubtotal: number
  discountAmount: number
  afterDiscount: number
  vatAmount: number
  withholdingAmount: number
  grandTotal: number
  attachments: Array<{ name: string; size?: number; type?: string }>
}) {
  const rows = params.lines.length
    ? params.lines
        .map(
          (line, index) =>
            line.lineType === 'section' || line.lineType === 'note'
              ? `
            <tr>
              <td>${index + 1}</td>
              <td colspan="4" class="special-line special-line--${line.lineType}">
                <strong>${escapeHtml(line.lineType === 'section' ? 'หัวข้อ' : 'หมายเหตุ')}</strong>
                <div>${escapeHtml(line.description || '-').replace(/\n/g, '<br />')}</div>
              </td>
            </tr>
          `
              : `
            <tr>
              <td>${index + 1}</td>
              <td>${escapeHtml(line.description || '-')}</td>
              <td class="num">${line.quantity.toLocaleString('th-TH')}</td>
              <td class="num">${asCurrency(line.unitPrice, params.currency)}</td>
              <td class="num">${asCurrency(line.total, params.currency)}</td>
            </tr>
          `,
        )
        .join('')
    : `<tr><td colspan="5" class="muted">ไม่มีรายการสินค้า</td></tr>`

  const attachments = params.attachments.length
    ? params.attachments
        .map(
          (attachment) =>
            `<li>${escapeHtml(attachment.name)}${attachment.size ? ` (${Math.round(attachment.size / 1024)} KB)` : ''}</li>`,
        )
        .join('')
    : '<li class="muted">ไม่มีเอกสารแนบ</li>'

  return `<!doctype html>
  <html lang="th">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(params.documentNumber)}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 0; padding: 32px; color: #0f172a; }
      .header { display: flex; justify-content: space-between; gap: 16px; margin-bottom: 24px; }
      .brand { font-size: 28px; font-weight: 700; color: #0f172a; }
      .meta { color: #475569; font-size: 13px; line-height: 1.5; }
      .panel { border: 1px solid #dbe4ee; border-radius: 14px; padding: 16px; margin-bottom: 18px; }
      .panel h3 { margin: 0 0 10px; font-size: 16px; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th, td { border-bottom: 1px solid #e2e8f0; text-align: left; padding: 8px 6px; vertical-align: top; }
      th { font-size: 12px; text-transform: uppercase; letter-spacing: .03em; color: #475569; }
      .num { text-align: right; white-space: nowrap; }
      .special-line { background: #f8fafc; }
      .special-line--section { border-left: 4px solid #2563eb; }
      .special-line--note { border-left: 4px solid #64748b; }
      .muted { color: #64748b; }
      .summary { display: grid; gap: 6px; max-width: 340px; margin-left: auto; }
      .summary-row { display: flex; justify-content: space-between; gap: 12px; }
      .summary-row strong { font-size: 18px; }
      .section-title { font-size: 13px; text-transform: uppercase; letter-spacing: .08em; color: #64748b; margin-bottom: 8px; }
      ul { margin: 0; padding-left: 18px; }
      @media print { body { padding: 18px; } }
    </style>
  </head>
  <body>
    <div class="header">
      <div>
        <div class="brand">${escapeHtml(params.title)}</div>
        <div class="meta">
          <div>${escapeHtml(params.documentNumber)}</div>
          <div>วันที่: ${escapeHtml(params.orderDate || '-')}</div>
          <div>เงื่อนไขชำระเงิน: ${escapeHtml(params.paymentTermText || '-')}</div>
          <div>วันหมดอายุ: ${escapeHtml(params.validityDate || '-')}</div>
        </div>
      </div>
      <div class="summary">
        <div class="summary-row"><span>ยอดก่อนส่วนลด</span><span>${asCurrency(params.grossSubtotal, params.currency)}</span></div>
        <div class="summary-row"><span>ส่วนลด</span><span>${asCurrency(params.discountAmount, params.currency)}</span></div>
        <div class="summary-row"><span>หลังหักส่วนลด</span><span>${asCurrency(params.afterDiscount, params.currency)}</span></div>
        <div class="summary-row"><span>VAT</span><span>${asCurrency(params.vatAmount, params.currency)}</span></div>
        <div class="summary-row"><span>หัก ณ ที่จ่าย</span><span>${asCurrency(params.withholdingAmount, params.currency)}</span></div>
        <div class="summary-row"><strong>ยอดสุทธิ</strong><strong>${asCurrency(params.grandTotal, params.currency)}</strong></div>
      </div>
    </div>

    <div class="panel">
      <h3>ข้อมูลลูกค้า</h3>
      <div class="grid">
        <div>
          <div class="section-title">ชื่อ</div>
          <div>${escapeHtml(params.customerName || '-')}</div>
        </div>
        <div>
          <div class="section-title">ติดต่อ</div>
          <div>${escapeHtml(params.customerContact || '-')}</div>
        </div>
        <div style="grid-column: 1 / -1;">
          <div class="section-title">ที่อยู่</div>
          <div>${escapeHtml(params.customerAddress || '-')}</div>
        </div>
      </div>
    </div>

    <div class="panel">
      <h3>รายการ</h3>
      <table>
        <thead>
          <tr>
            <th style="width: 50px;">#</th>
            <th>รายละเอียด</th>
            <th style="width: 90px;" class="num">จำนวน</th>
            <th style="width: 140px;" class="num">ราคาต่อหน่วย</th>
            <th style="width: 140px;" class="num">รวม</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <div class="panel">
      <h3>หมายเหตุ</h3>
      <div>${escapeHtml(params.notes || '-').replace(/\n/g, '<br />')}</div>
      <div class="section-title" style="margin-top: 14px;">เอกสารแนบ</div>
      <ul>${attachments}</ul>
    </div>
  </body>
  </html>`
}

function buildSalesOrderPrintPayload(params: {
  formData: SalesOrderFormState
  selectedPartnerName: string
  orderType: SalesOrderType
  isEdit: boolean
  documentNumber: string
  renderedLineTotals: ReturnType<typeof calculateSalesOrderTotals>['lineTotals']
  grossSubtotal: number
  discountAmount: number
  afterDiscount: number
  vatAmount: number
  withholdingAmount: number
  grandTotal: number
  attachmentItems: SalesOrderAttachmentDraft[]
}) {
  const {
    formData,
    selectedPartnerName,
    orderType,
    isEdit,
    documentNumber,
    renderedLineTotals,
    grossSubtotal,
    discountAmount,
    afterDiscount,
    vatAmount,
    withholdingAmount,
    grandTotal,
    attachmentItems,
  } = params
  return buildPrintHtml({
    title: getSalesOrderDocumentTitle(orderType, isEdit),
    documentNumber,
    customerName: getSalesOrderCustomerDisplayName({
      customerNameText: formData.customerNameText,
      partnerName: selectedPartnerName,
    }),
    customerAddress: formData.customerAddressText,
    customerContact: getSalesOrderCustomerContactText(formData),
    orderDate: formData.orderDate,
    paymentTermText: formData.paymentTermText,
    validityDate: formData.validityDate || '',
    currency: formData.currency,
    notes: formData.notes,
    lines: formData.lines.map((line, index) => {
      const computed = renderedLineTotals[index]
      const lineType = line.lineType || 'normal'
      if (lineType === 'section' || lineType === 'note') {
        return {
          description: line.description || (lineType === 'section' ? 'หัวข้อ' : 'หมายเหตุ'),
          quantity: 0,
          unitPrice: 0,
          total: 0,
          lineType,
        }
      }
      return {
        description: line.description || (line.productId ? `Product #${line.productId}` : 'รายการ'),
        quantity: computed ? computed.line.quantity : toNumberLike(line.quantity),
        unitPrice: computed ? computed.line.unitPrice : toNumberLike(line.unitPrice),
        total: computed ? computed.total : toNumberLike(line.total),
        lineType,
      }
    }),
    grossSubtotal,
    discountAmount,
    afterDiscount,
    vatAmount,
    withholdingAmount,
    grandTotal,
    attachments: sanitizeSalesOrderAttachments(attachmentItems),
  })
}

export function SalesOrderFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const formatDateTime = useAppDateTimeFormatter()

  const isEdit = !!id
  const orderId = id ? Number.parseInt(id, 10) : null
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), [])
  const partnerIdRaw = searchParams.get('partnerId')
  const partnerIdPrefill = partnerIdRaw ? Number(partnerIdRaw) : null
  const orderTypeParam = searchParams.get('orderType')
  const initialOrderType: SalesOrderType = orderTypeParam === 'sale' ? 'sale' : 'quotation'

  const initialPreferences = loadSalesOrderPreferences(SALES_ORDER_PREFERENCES_KEY)
  const [formData, setFormData] = useState<SalesOrderFormState>(() => {
    const base = createBlankFormState(initialPreferences, initialOrderType)
    return {
      ...base,
      partnerId:
        !isEdit && partnerIdPrefill && Number.isFinite(partnerIdPrefill) && partnerIdPrefill > 0 ? partnerIdPrefill : null,
    }
  })

  const { data: existingOrder, isLoading: isLoadingOrder } = useQuery({
    queryKey: ['salesOrder', orderId],
    queryFn: () => getSalesOrder(orderId!),
    enabled: isEdit && !!orderId,
  })

  const [partnerSearch, setPartnerSearch] = useState('')
  const [quickPartnerOpen, setQuickPartnerOpen] = useState(false)
  const [quickPartnerSaving, setQuickPartnerSaving] = useState(false)
  const thailandId = Number(import.meta.env.VITE_COUNTRY_TH_ID || 219)
  const [quickPartner, setQuickPartner] = useState<QuickPartnerState>({
    company_type: 'company',
    name: '',
    vat: '',
    phone: '',
    email: '',
    street: '',
    district: '',
    subDistrict: '',
    zip: '',
    countryId: thailandId,
    stateId: null,
    provinceId: null,
    districtId: null,
    subDistrictId: null,
    vatPriceMode: 'vat_excluded',
    branchCode: 'สำนักงานใหญ่',
    active: true,
  })
  const debouncedPartnerSearch = useDebouncedValue(partnerSearch, 250)
  const partnerLimit = 20
  const skipNextDraftSaveRef = useRef(false)
  const lastResolvedQuickPartnerZipRef = useRef<string>('')

  const [fieldErrors, setFieldErrors] = useState<FieldErrors | null>(null)
  const [recentNotes, setRecentNotes] = useState<string[]>([])
  const [recentInternalNotes, setRecentInternalNotes] = useState<string[]>([])
  const [draftPendingRestore, setDraftPendingRestore] = useState<SalesOrderFormState | null>(null)
  const [draftPendingRestoreAttachments, setDraftPendingRestoreAttachments] = useState<SalesOrderAttachmentDraft[]>([])
  const [draftUpdatedAt, setDraftUpdatedAt] = useState<string | null>(null)
  const [draftGateResolved, setDraftGateResolved] = useState(false)
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null)
  const [attachmentPickerKey, setAttachmentPickerKey] = useState(0)
  const [attachmentItems, setAttachmentItems] = useState<SalesOrderAttachmentDraft[]>([])

  const salesTaxesQuery = useQuery({
    queryKey: ['tax-admin', 'sales-order-form', 'sale'],
    queryFn: () => listVatTaxes({ typeTaxUse: 'sale', activeOnly: true, limit: 500 }),
    staleTime: 60_000,
  })

  const saleTaxOptions: TaxAdminListItem[] = useMemo(() => salesTaxesQuery.data?.items ?? [], [salesTaxesQuery.data])
  const saleTaxMap = useMemo(() => new Map<number, TaxAdminListItem>(saleTaxOptions.map((tax) => [tax.id, tax])), [saleTaxOptions])
  const defaultSaleTaxId = useMemo(() => getDefaultVatTaxId(saleTaxOptions), [saleTaxOptions])
  const defaultSaleTax = defaultSaleTaxId ? saleTaxMap.get(defaultSaleTaxId) : undefined
  const defaultSaleTaxRate = useMemo(() => {
    if (!defaultSaleTax) return 7
    const amount = Number(defaultSaleTax.amount || 0)
    return Number.isFinite(amount) && amount > 0 ? amount : 7
  }, [defaultSaleTax])

  const partnerOptionsQuery = useInfiniteQuery<PartnerListResponse, Error, InfiniteData<PartnerListResponse>, readonly unknown[], number>({
    queryKey: ['partner-selector-sales-order', debouncedPartnerSearch],
    initialPageParam: 0,
    queryFn: (context: QueryFunctionContext<readonly unknown[], number>) =>
      listPartners({
        q: debouncedPartnerSearch || undefined,
        active: true,
        limit: partnerLimit,
        offset: Number(context.pageParam ?? 0),
      }),
    getNextPageParam: (lastPage: PartnerListResponse, allPages: PartnerListResponse[]) => {
      const loaded = allPages.reduce((acc, p) => acc + (p?.items?.length ?? 0), 0)
      if (loaded >= (lastPage?.total ?? 0)) return undefined
      if ((lastPage?.items?.length ?? 0) < partnerLimit) return undefined
      return loaded
    },
    staleTime: 30_000,
  } as any)

  const partnerItems = useMemo(
    () => partnerOptionsQuery.data?.pages.flatMap((p: PartnerListResponse) => p.items) ?? [],
    [partnerOptionsQuery.data?.pages],
  )
  const partnerTotal = partnerOptionsQuery.data?.pages[0]?.total

  const selectedPartnerQuery = useQuery({
    queryKey: ['partner', formData.partnerId],
    enabled: formData.partnerId != null && formData.partnerId > 0,
    queryFn: () => getPartner(formData.partnerId!),
    staleTime: 30_000,
  })

  useEffect(() => {
    if (!selectedPartnerQuery.data || partnerSearch.trim()) return
    setPartnerSearch(selectedPartnerQuery.data.displayName || selectedPartnerQuery.data.name)
  }, [selectedPartnerQuery.data, partnerSearch])

  useEffect(() => {
    setRecentNotes(loadRecentNotes(SALES_ORDER_RECENT_NOTES_KEY))
    setRecentInternalNotes(loadRecentNotes(SALES_ORDER_RECENT_INTERNAL_NOTES_KEY))
  }, [])

  useEffect(() => {
    if (isEdit) {
      setDraftGateResolved(true)
      setDraftPendingRestore(null)
      setDraftPendingRestoreAttachments([])
      return
    }
    const draft = loadSalesOrderDraft(SALES_ORDER_DRAFT_KEY)
    if (draft?.data) {
      setDraftPendingRestore(normalizeDraftState(draft.data, initialPreferences, initialOrderType))
      setDraftPendingRestoreAttachments(
        sanitizeSalesOrderAttachments(draft.data.attachments || []).map((attachment) => ({
          ...attachment,
        })),
      )
      setDraftUpdatedAt(draft.updatedAt || null)
    } else {
      setDraftPendingRestore(null)
      setDraftPendingRestoreAttachments([])
      setDraftUpdatedAt(null)
    }
    setDraftGateResolved(true)
  }, [isEdit, initialPreferences, initialOrderType])

  useEffect(() => {
    if (isEdit || draftPendingRestore) return
    if (!draftGateResolved) return
    if (skipNextDraftSaveRef.current) {
      skipNextDraftSaveRef.current = false
      return
    }
    if (!hasMeaningfulSalesOrderDraft(formData, attachmentItems.length)) {
      clearSalesOrderDraft(SALES_ORDER_DRAFT_KEY)
      setDraftSavedAt(null)
      return
    }
    const timer = window.setTimeout(() => {
      saveSalesOrderDraft(SALES_ORDER_DRAFT_KEY, {
        ...formData,
        attachments: sanitizeSalesOrderAttachments(attachmentItems),
      })
      setDraftSavedAt(new Date().toISOString())
    }, 700)
    return () => window.clearTimeout(timer)
  }, [isEdit, draftGateResolved, draftPendingRestore, formData, attachmentItems])

  useEffect(() => {
    if (!isEdit) return
    if (!existingOrder) return
    const timer = window.setTimeout(() => {
      setFormData(normalizeOrderToFormState(existingOrder, initialPreferences))
      setAttachmentItems((existingOrder.attachments || []).map((attachment: SalesOrderAttachment) => toAttachmentDraft(attachment)))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [existingOrder, isEdit, initialPreferences])

  useEffect(() => {
    if (isEdit) return
    saveSalesOrderPreferences(SALES_ORDER_PREFERENCES_KEY, {
      currency: formData.currency,
      paymentTermText: formData.paymentTermText,
      vatEnabled: formData.vatEnabled,
      vatRate: formData.vatRate,
      withholdingTaxEnabled: formData.withholdingTaxEnabled,
      withholdingTaxRate: formData.withholdingTaxRate,
      customerNameText: formData.saveCustomerInfoForNextTime ? formData.customerNameText : undefined,
      customerAddressText: formData.saveCustomerInfoForNextTime ? formData.customerAddressText : undefined,
      customerPhoneText: formData.saveCustomerInfoForNextTime ? formData.customerPhoneText : undefined,
      customerEmailText: formData.saveCustomerInfoForNextTime ? formData.customerEmailText : undefined,
      customerTaxIdText: formData.saveCustomerInfoForNextTime ? formData.customerTaxIdText : undefined,
      customerBranchText: formData.saveCustomerInfoForNextTime ? formData.customerBranchText : undefined,
    })
  }, [
    formData.currency,
    formData.paymentTermText,
    formData.vatEnabled,
    formData.vatRate,
    formData.withholdingTaxEnabled,
    formData.withholdingTaxRate,
    formData.customerNameText,
    formData.customerAddressText,
    formData.customerPhoneText,
    formData.customerEmailText,
    formData.customerTaxIdText,
    formData.customerBranchText,
    formData.saveCustomerInfoForNextTime,
    isEdit,
  ])

  const orderTotals = useMemo(
    () =>
      calculateSalesOrderTotals(formData.lines, {
        taxMap: saleTaxMap,
        vatEnabled: formData.vatEnabled,
        vatRate: formData.vatRate,
        withholdingTaxEnabled: formData.withholdingTaxEnabled,
        withholdingTaxRate: formData.withholdingTaxRate,
      }),
    [formData.lines, saleTaxMap, formData.vatEnabled, formData.vatRate, formData.withholdingTaxEnabled, formData.withholdingTaxRate],
  )
  const renderedLineTotals = orderTotals.lineTotals
  const grossSubtotalAmount = orderTotals.grossSubtotal
  const discountAmount = orderTotals.discountAmount
  const afterDiscountAmount = orderTotals.afterDiscount
  const vatAmount = orderTotals.vatAmount
  const withholdingAmount = orderTotals.withholdingAmount
  const grandTotal = orderTotals.grandTotal
  const documentNumber = isEdit ? existingOrder?.number || (orderId ? `#${orderId}` : 'QT000001') : 'QT000001'

  const createMutation = useMutation({
    mutationFn: (payload: SalesOrderPayload) => createSalesOrder(payload),
    onError: (err: unknown) => {
      const fe = extractFieldErrors(err)
      if (fe) setFieldErrors(fe)
      toast.error('สร้างเอกสารขายไม่สำเร็จ', err instanceof Error ? err.message : undefined)
    },
  })

  const updateMutation = useMutation({
    mutationFn: (payload: SalesOrderPayload) => updateSalesOrder(orderId!, payload),
    onError: (err: unknown) => {
      const fe = extractFieldErrors(err)
      if (fe) setFieldErrors(fe)
      toast.error('บันทึกเอกสารขายไม่สำเร็จ', err instanceof Error ? err.message : undefined)
    },
  })

  const canSubmit = useMemo(() => {
    if (!formData.orderDate) return false
    if (!formData.currency.trim()) return false
    return true
  }, [formData.orderDate, formData.currency])

  const updateLine = (index: number, updates: Partial<SalesOrderLine>) => {
    setFormData((prev) => {
      if (index < 0 || index >= prev.lines.length) return prev
      const lines = [...prev.lines]
      lines[index] = normalizeSalesLine({ ...lines[index], ...updates })
      return { ...prev, lines }
    })
  }

  const addLine = () => {
    setFormData((prev) => ({
      ...prev,
      lines: [
        ...prev.lines,
        createSalesLine('normal'),
      ],
    }))
  }

  const addSectionLine = () => {
    setFormData((prev) => ({
      ...prev,
      lines: [
        ...prev.lines,
        {
          ...createSalesLine('section'),
          description: 'หัวข้อ',
        },
      ],
    }))
  }

  const addNoteLine = () => {
    setFormData((prev) => ({
      ...prev,
      lines: [
        ...prev.lines,
        {
          ...createSalesLine('note'),
          description: 'หมายเหตุ',
        },
      ],
    }))
  }

  const removeLine = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== index),
    }))
  }

  const applyRecentNote = (note: string) => setFormData((prev) => ({ ...prev, notes: note }))
  const appendRecentNote = (note: string) =>
    setFormData((prev) => ({
      ...prev,
      notes: prev.notes.trim() ? `${prev.notes}\n${note}` : note,
    }))
  const applyRecentInternalNote = (note: string) => setFormData((prev) => ({ ...prev, internalNotes: note }))
  const appendRecentInternalNote = (note: string) =>
    setFormData((prev) => ({
      ...prev,
      internalNotes: prev.internalNotes.trim() ? `${prev.internalNotes}\n${note}` : note,
    }))

  const handleFilesPicked = (files: FileList | File[]) => {
    const nextItems = Array.from(files)
      .filter((file) => file.name.trim())
      .map((file) => {
        const metadata = {
          name: file.name,
          size: file.size,
          type: file.type,
        }
        return {
          ...toAttachmentDraft(metadata, file),
        }
      })
    if (!nextItems.length) return
    setAttachmentItems((prev) => [...prev, ...nextItems])
  }

  const removeAttachment = async (index: number) => {
    const item = attachmentItems[index]
    if (!item) return

    if (item.id && !item.file && isEdit && orderId) {
      try {
        await deleteSalesOrderAttachment(orderId, item.id)
        setAttachmentItems((prev) => prev.filter((_, i) => i !== index))
        toast.success('ลบเอกสารแนบแล้ว', item.name)
      } catch (err) {
        toast.error('ลบเอกสารแนบไม่สำเร็จ', err instanceof Error ? err.message : undefined)
      }
      return
    }

    setAttachmentItems((prev) => prev.filter((_, i) => i !== index))
  }

  const previewAttachment = (attachment: SalesOrderAttachmentDraft) => {
    const objectUrl = attachment.file ? URL.createObjectURL(attachment.file) : attachment.url
    if (!objectUrl) {
      toast.error('ไม่พบไฟล์แนบสำหรับดูตัวอย่าง')
      return
    }
    const tab = window.open(objectUrl, '_blank', 'noopener,noreferrer')
    if (!tab) {
      toast.error('ไม่สามารถเปิดไฟล์แนบได้')
    }
    if (attachment.file) {
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000)
    }
  }

  const downloadAttachment = (attachment: SalesOrderAttachmentDraft) => {
    const objectUrl = attachment.file ? URL.createObjectURL(attachment.file) : attachment.url
    if (!objectUrl) {
      toast.error('ไม่พบไฟล์แนบสำหรับดาวน์โหลด')
      return
    }
    const link = window.document.createElement('a')
    link.href = objectUrl
    link.download = attachment.name || 'attachment'
    window.document.body.appendChild(link)
    link.click()
    link.remove()
    if (attachment.file) {
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000)
    }
  }

  const buildPayload = (partnerIdOverride?: number | null): SalesOrderPayload => {
    const payload: SalesOrderPayload = {
      partnerId:
        typeof partnerIdOverride === 'number' && partnerIdOverride > 0
          ? partnerIdOverride
          : formData.partnerId && formData.partnerId > 0
            ? formData.partnerId
            : null,
      orderDate: formData.orderDate,
      validityDate: formData.validityDate,
      currency: formData.currency,
      orderType: formData.orderType,
      lines: formData.lines.map((line, index) => {
        const computed = renderedLineTotals[index]?.line ?? normalizeSalesLine(line)
        return {
          ...computed,
          productId: computed.productId ?? null,
          description: computed.description || '',
          quantity: toNumberLike(computed.quantity),
          unitPrice: toNumberLike(computed.unitPrice),
          discount: toNumberLike(computed.discountPercent ?? computed.discount),
          discountPercent: toNumberLike(computed.discountPercent ?? computed.discount),
          taxIds: Array.isArray(computed.taxIds)
            ? computed.taxIds.filter((taxId) => Number.isFinite(Number(taxId)) && Number(taxId) > 0)
            : [],
          subtotal: toNumberLike(computed.subtotal),
          totalTax: toNumberLike(computed.totalTax),
          total: toNumberLike(computed.total),
          lineType: computed.lineType || 'normal',
        }
      }),
      notes: formData.notes || '',
      customerNameText: formData.customerNameText || undefined,
      customerAddressText: formData.customerAddressText || undefined,
      customerPhoneText: formData.customerPhoneText || undefined,
      customerEmailText: formData.customerEmailText || undefined,
      customerTaxIdText: formData.customerTaxIdText || undefined,
      customerBranchText: formData.customerBranchText || undefined,
      internalNotes: formData.internalNotes || undefined,
      paymentTermText: formData.paymentTermText || undefined,
      vatEnabled: formData.vatEnabled,
      vatRate: formData.vatRate,
      withholdingTaxEnabled: formData.withholdingTaxEnabled,
      withholdingTaxRate: formData.withholdingTaxRate,
      attachments: sanitizeSalesOrderAttachments(attachmentItems),
    }
    return payload
  }

  const ensureSalesOrderPartner = async () => {
    if (formData.partnerId && formData.partnerId > 0) {
      return formData.partnerId
    }

    const partnerName = formData.customerNameText.trim() || partnerSearch.trim()
    if (!partnerName) {
      throw new Error('กรุณาเลือกลูกค้าหรือกรอกชื่อลูกค้าก่อนบันทึก')
    }

    const created = await createPartner({
      company_type: 'company',
      name: partnerName,
      email: formData.customerEmailText.trim() || undefined,
      phone: formData.customerPhoneText.trim() || undefined,
      vat: formData.customerTaxIdText.trim() || undefined,
      branchCode: formData.customerBranchText.trim() || undefined,
      street: formData.customerAddressText.trim() || undefined,
    })

    await queryClient.invalidateQueries({ queryKey: ['partners'] })
    await queryClient.invalidateQueries({ queryKey: ['partner', created.id] })
    setFormData((prev) => ({
      ...prev,
      partnerId: created.id,
      customerNameText: created.displayName || created.name || partnerName,
    }))
    setPartnerSearch(created.displayName || created.name || partnerName)

    return created.id
  }

  const persistSavedOrderState = (savedOrder: Awaited<ReturnType<typeof createSalesOrder>>) => {
    clearSalesOrderDraft(SALES_ORDER_DRAFT_KEY)
    setDraftSavedAt(null)
    if (formData.notes.trim()) {
      pushRecentNote(SALES_ORDER_RECENT_NOTES_KEY, formData.notes)
      setRecentNotes(loadRecentNotes(SALES_ORDER_RECENT_NOTES_KEY))
    }
    if (formData.internalNotes.trim()) {
      pushRecentNote(SALES_ORDER_RECENT_INTERNAL_NOTES_KEY, formData.internalNotes)
      setRecentInternalNotes(loadRecentNotes(SALES_ORDER_RECENT_INTERNAL_NOTES_KEY))
    }
    if (formData.saveCustomerInfoForNextTime) {
      saveSalesOrderPreferences(SALES_ORDER_PREFERENCES_KEY, {
        currency: formData.currency,
        paymentTermText: formData.paymentTermText,
        vatEnabled: formData.vatEnabled,
        vatRate: formData.vatRate,
        withholdingTaxEnabled: formData.withholdingTaxEnabled,
        withholdingTaxRate: formData.withholdingTaxRate,
        customerNameText: formData.customerNameText,
        customerAddressText: formData.customerAddressText,
        customerPhoneText: formData.customerPhoneText,
        customerEmailText: formData.customerEmailText,
        customerTaxIdText: formData.customerTaxIdText,
        customerBranchText: formData.customerBranchText,
      })
    }
    queryClient.invalidateQueries({ queryKey: ['salesOrders'] })
    queryClient.invalidateQueries({ queryKey: ['salesOrder', savedOrder.id] })
  }

  const uploadPendingAttachments = async (savedOrderId: number) => {
    const pendingFiles = attachmentItems.filter((attachment): attachment is SalesOrderAttachmentDraft & { file: File } =>
      Boolean(attachment.file),
    )
    if (!pendingFiles.length) return { uploaded: [] as SalesOrderAttachment[], failedNames: [] as string[] }

    const uploadResults: Array<{ index: number; uploaded: SalesOrderAttachment[] }> = []
    const failedNames: string[] = []

    for (const attachment of pendingFiles) {
      try {
        const uploaded = await uploadSalesOrderAttachments(savedOrderId, [attachment.file])
        if (uploaded.length > 0) {
          const currentIndex = attachmentItems.findIndex((item) => item === attachment)
          if (currentIndex >= 0) {
            uploadResults.push({ index: currentIndex, uploaded })
          }
        } else {
          failedNames.push(attachment.name)
        }
      } catch {
        failedNames.push(attachment.name)
      }
    }

    if (uploadResults.length > 0) {
      setAttachmentItems((current) => {
        const next: SalesOrderAttachmentDraft[] = []
        current.forEach((item, itemIndex) => {
          const match = uploadResults.find((result) => result.index === itemIndex)
          if (match) {
            next.push(...match.uploaded.map((attachment) => toAttachmentDraft(attachment)))
            return
          }
          next.push(item)
        })
        return next
      })
    }

    if (failedNames.length > 0) {
      toast.info('ไฟล์แนบยังไม่ถูกอัปโหลดจริง จะเก็บเฉพาะชื่อไฟล์จนกว่า backend รองรับ')
    }

    return {
      uploaded: uploadResults.flatMap((result) => result.uploaded),
      failedNames,
    }
  }

  const submitSalesOrder = async () => {
    try {
      if (!canSubmit) {
        toast.error('กรุณากรอกวันที่เอกสารและสกุลเงิน')
        return
      }

      const resolvedPartnerId = await ensureSalesOrderPartner()
      const payload = buildPayload(resolvedPartnerId)
      const savedOrder = isEdit ? await updateMutation.mutateAsync(payload) : await createMutation.mutateAsync(payload)
      persistSavedOrderState(savedOrder)
      const uploadResult = await uploadPendingAttachments(savedOrder.id)
      await queryClient.invalidateQueries({ queryKey: ['salesOrder', savedOrder.id] })
      if (uploadResult.failedNames.length > 0) {
        toast.info('บันทึกใบเสนอราคาแล้ว แต่ไฟล์บางรายการอัปโหลดไม่สำเร็จ', uploadResult.failedNames.join(', '))
        return
      }
      toast.success(isEdit ? 'บันทึกเอกสารขายสำเร็จ' : 'สร้างเอกสารขายสำเร็จ', savedOrder.number ? `เลขที่: ${savedOrder.number}` : undefined)
      navigate(`/sales/orders/${savedOrder.id}`)
    } catch {
      // Mutation-level errors are already surfaced via toast/onError.
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFieldErrors(null)
    void submitSalesOrder()
  }

  const openPreviewWindow = () => {
    const html = buildSalesOrderPrintPayload({
      formData,
      selectedPartnerName: selectedPartnerQuery.data?.displayName || selectedPartnerQuery.data?.name || '',
      orderType: formData.orderType,
      isEdit,
      documentNumber,
      renderedLineTotals,
      grossSubtotal: grossSubtotalAmount,
      discountAmount,
      afterDiscount: afterDiscountAmount,
      vatAmount,
      withholdingAmount,
      grandTotal,
      attachmentItems,
    })
    const preview = window.open('', '_blank', 'noopener,noreferrer,width=1200,height=900')
    if (!preview) {
      toast.error('ไม่สามารถเปิดหน้าพิมพ์ได้')
      return
    }
    preview.document.open()
    preview.document.write(html)
    preview.document.close()
    preview.focus()
    setTimeout(() => preview.print(), 250)
  }

  const handleDownloadPdf = async () => {
    if (!isEdit || !orderId) return
    try {
      const blob = await fetchSalesOrderPdf(orderId)
      const url = URL.createObjectURL(blob)
      const link = window.document.createElement('a')
      link.href = url
      link.download = `${documentNumber.replace(/[^a-zA-Z0-9ก-๙_-]+/g, '_') || 'sales-order'}.pdf`
      window.document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    } catch (err) {
      toast.error('ดาวน์โหลด PDF ไม่สำเร็จ', err instanceof Error ? err.message : undefined)
    }
  }

  const handleShareLink = async () => {
    if (!isEdit || !orderId) {
      toast.error('ต้องบันทึกเอกสารก่อนจึงจะแชร์ลิงก์ได้')
      return
    }
    const url = `${window.location.origin}/sales/orders/${orderId}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success('คัดลอกลิงก์แล้ว')
    } catch {
      toast.error('คัดลอกลิงก์ไม่สำเร็จ')
    }
  }

  const handleEmail = async () => {
    if (!isEdit || !orderId) {
      toast.error('ต้องบันทึกเอกสารก่อนจึงจะส่งอีเมลได้')
      return
    }
    const fallbackEmail = selectedPartnerQuery.data?.email || formData.customerEmailText || ''
    const emailTo = window.prompt('กรอกอีเมลผู้รับ', fallbackEmail)
    if (!emailTo?.trim()) return
    try {
      await sendSalesOrderEmail(orderId, {
        emailTo: emailTo.trim(),
        subject: `${documentNumber} - ${getSalesOrderDocumentLabel(formData.orderType)}`,
        message: formData.notes || undefined,
      })
      toast.success('ส่งอีเมลสำเร็จ')
    } catch (err) {
      toast.error('ส่งอีเมลไม่สำเร็จ', err instanceof Error ? err.message : undefined)
    }
  }

  async function resolveQuickPartnerThaiAddress() {
    if (quickPartner.countryId !== thailandId) return
    const resolved = await resolveThaiAddress({
      provinceId: quickPartner.provinceId,
      districtId: quickPartner.districtId,
      districtName: quickPartner.district,
      subDistrictName: quickPartner.subDistrict,
      zipCode: quickPartner.zip,
    })
    setQuickPartner((prev) => ({
      ...prev,
      provinceId: resolved.province?.id ?? prev.provinceId ?? null,
      stateId: resolved.province?.stateId ?? prev.stateId ?? null,
      districtId: resolved.district?.id ?? prev.districtId ?? null,
      subDistrictId: resolved.subDistrict?.id ?? prev.subDistrictId ?? null,
      district: resolved.district?.name || prev.district,
      city: resolved.district?.name || prev.city,
      subDistrict: resolved.subDistrict?.name || prev.subDistrict,
      zip: resolved.zipCode || prev.zip,
    }))
  }

  useEffect(() => {
    const zip = String(quickPartner.zip || '').trim()
    if (quickPartner.countryId !== thailandId || zip.length !== 5 || !/^\d{5}$/.test(zip)) {
      if (!zip) lastResolvedQuickPartnerZipRef.current = ''
      return
    }
    if (lastResolvedQuickPartnerZipRef.current === zip) return
    lastResolvedQuickPartnerZipRef.current = zip
    resolveQuickPartnerThaiAddress().catch(() => {
      lastResolvedQuickPartnerZipRef.current = ''
    })
  }, [quickPartner.countryId, quickPartner.zip])

  async function submitQuickPartner() {
    if (!quickPartner.name.trim()) {
      toast.error('กรุณากรอกชื่อรายชื่อติดต่อ')
      return
    }
    const vatError = thaiVatValidationMessage(quickPartner.vat)
    if (vatError) {
      toast.error(vatError)
      return
    }
    try {
      setQuickPartnerSaving(true)
      const created = await createPartner({
        ...quickPartner,
        name: quickPartner.name.trim(),
        email: quickPartner.email?.trim() || undefined,
        phone: quickPartner.phone?.trim() || undefined,
        vat: normalizeVatNumber(quickPartner.vat),
        street: quickPartner.street?.trim() || undefined,
        district: quickPartner.district?.trim() || undefined,
        subDistrict: quickPartner.subDistrict?.trim() || undefined,
        zip: quickPartner.zip?.trim() || undefined,
        stateId: quickPartner.stateId ?? undefined,
      })
      await queryClient.invalidateQueries({ queryKey: ['partner-selector-sales-order'] })
      await queryClient.invalidateQueries({ queryKey: ['partners'] })
      setFormData((prev) => ({ ...prev, partnerId: created.id, customerNameText: created.displayName || created.name }))
      setPartnerSearch(created.displayName || created.name)
      setQuickPartnerOpen(false)
      setQuickPartner({
        company_type: 'company',
        name: '',
        vat: '',
        phone: '',
        email: '',
        street: '',
        district: '',
        subDistrict: '',
        zip: '',
        countryId: thailandId,
        stateId: null,
        provinceId: null,
        districtId: null,
        subDistrictId: null,
        vatPriceMode: 'vat_excluded',
        branchCode: 'สำนักงานใหญ่',
        active: true,
      })
      toast.success('สร้างรายชื่อติดต่อใหม่สำเร็จ')
    } catch (err) {
      toast.error('สร้างรายชื่อติดต่อไม่สำเร็จ', err instanceof Error ? err.message : undefined)
    } finally {
      setQuickPartnerSaving(false)
    }
  }

  if (isEdit && isLoadingOrder) {
    return (
      <div className="d-flex justify-content-center align-items-center py-5">
        <Spinner animation="border" role="status" />
        <span className="ms-3">กำลังโหลดข้อมูล...</span>
      </div>
    )
  }

  if (isEdit && !isLoadingOrder && !existingOrder) {
    return (
      <Alert variant="danger" className="small mb-0">
        ไม่พบเอกสารขายที่ต้องการ
      </Alert>
    )
  }

  const canEmailOrShare = isEdit && !!orderId
  const statusLabel = formatSalesOrderStatus(isEdit ? existingOrder?.status : 'draft')

  useDocumentKeyboardShortcuts({
    onSave: () => document.querySelector<HTMLFormElement>('#sales-order-form')?.requestSubmit(),
    onPrint: () => openPreviewWindow(),
  })

  return (
    <>
    <DocumentPageLayout
      title={isEdit ? 'แก้ไขใบเสนอราคา' : 'สร้างใบเสนอราคา'}
      subtitle={`${documentNumber} · ${statusLabel} · ${formData.lines.length} รายการ${!isEdit && draftSavedAt ? ` · autosaved ${formatDateTime(draftSavedAt)}` : ''}`}
      breadcrumb="รายรับ · ใบเสนอราคา"
      actions={
        <div className="d-flex flex-wrap align-items-center justify-content-end gap-2">
          <span className="badge text-bg-light border">
            {asCurrency(grandTotal, formData.currency)}
          </span>
          <Button type="button" size="sm" variant="secondary" onClick={openPreviewWindow}>
            <i className="bi bi-printer me-1" />
            พิมพ์
          </Button>
          {isEdit ? (
            <Button type="button" size="sm" variant="secondary" onClick={handleDownloadPdf}>
              <i className="bi bi-file-earmark-pdf me-1" />
              ดาวน์โหลด PDF
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="secondary" onClick={handleEmail} disabled={!canEmailOrShare}>
            <i className="bi bi-envelope me-1" />
            อีเมล
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={handleShareLink} disabled={!canEmailOrShare}>
            <i className="bi bi-link-45deg me-1" />
            แชร์ลิงก์
          </Button>
          <Button
            type="submit"
            form="sales-order-form"
            size="sm"
            isLoading={createMutation.isPending || updateMutation.isPending}
          >
            บันทึกข้อมูล
          </Button>
        </div>
      }
    >
    <form id="sales-order-form" onSubmit={handleSubmit} className="qf-so-page">

      {!isEdit && draftPendingRestore ? (
        <Alert variant="warning" className="small qf-so-banner">
          <div className="fw-semibold mb-1">พบ draft ที่บันทึกไว้</div>
          <div className="mb-2">เวลา: {formatDateTime(draftUpdatedAt, 'ไม่ทราบเวลา')}</div>
          <div className="d-flex gap-2 flex-wrap">
            <Button
              size="sm"
              type="button"
              onClick={() => {
                clearSalesOrderDraft(SALES_ORDER_DRAFT_KEY)
                setFormData(draftPendingRestore)
                setAttachmentItems(draftPendingRestoreAttachments.map((attachment) => toAttachmentDraft(attachment)))
                setDraftPendingRestore(null)
                setDraftPendingRestoreAttachments([])
                setDraftUpdatedAt(null)
                setDraftSavedAt(null)
                toast.info('กู้ draft สำเร็จ')
              }}
            >
              กู้ draft
            </Button>
            <Button
              size="sm"
              type="button"
              variant="secondary"
              onClick={() => {
                skipNextDraftSaveRef.current = true
                clearSalesOrderDraft(SALES_ORDER_DRAFT_KEY)
                setDraftPendingRestore(null)
                setDraftPendingRestoreAttachments([])
                setDraftUpdatedAt(null)
                setDraftSavedAt(null)
                setAttachmentItems([])
                toast.success('ลบ draft แล้ว')
              }}
            >
              ลบ draft
            </Button>
          </div>
        </Alert>
      ) : null}

      <div className="qf-so-grid">
        <div className="qf-so-main">
          <Card className="qf-so-panel">
            <div className="qf-so-section-title">ข้อมูลลูกค้าและเอกสาร</div>
            <div className="row g-3 align-items-start">
              <div className="col-lg-6">
                <Label htmlFor="partnerSearch">ลูกค้า</Label>
                <Combobox
                  id="partnerSearch"
                  value={partnerSearch}
                  onChange={setPartnerSearch}
                  placeholder="ค้นหาลูกค้า หรือปล่อยว่างเพื่อทำใบเสนอราคาเร็ว"
                  minChars={0}
                  menuZIndex={5000}
                  isLoading={partnerOptionsQuery.isFetching || selectedPartnerQuery.isFetching}
                  isLoadingMore={partnerOptionsQuery.isFetchingNextPage}
                  onLoadMore={() => {
                    if (partnerOptionsQuery.hasNextPage) partnerOptionsQuery.fetchNextPage()
                  }}
                  options={partnerItems.map<ComboboxOption>((p: PartnerSummary) => ({
                    id: p.id,
                    label: p.name,
                    meta:
                      [
                        p.vat ? `VAT: ${p.vat}` : '',
                        p.stateName || '',
                        !p.vat && !p.stateName ? p.email || `ID: ${p.id}` : '',
                      ]
                        .filter(Boolean)
                        .join(' • '),
                  }))}
                  total={partnerTotal}
                  emptyText="ไม่พบลูกค้า"
                  onPick={(opt) => {
                    const selected = partnerItems.find((item: PartnerSummary) => item.id === Number(opt.id))
                    setFormData((prev) => ({
                      ...prev,
                      partnerId: Number(opt.id),
                      customerNameText: prev.customerNameText.trim() ? prev.customerNameText : selected?.name || opt.label,
                      customerEmailText: prev.customerEmailText || selected?.email || '',
                    }))
                    setPartnerSearch(opt.label)
                  }}
                />
                <div className="d-flex gap-2 mt-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="ghost"
                    type="button"
                    onClick={() => {
                      setFormData((prev) => ({ ...prev, partnerId: null }))
                      setPartnerSearch('')
                    }}
                  >
                    ล้างลูกค้า
                  </Button>
                  <Button size="sm" variant="ghost" type="button" onClick={() => setQuickPartnerOpen(true)}>
                    + ผู้ติดต่อใหม่
                  </Button>
                </div>
                <div className="small text-muted mt-2">
                  ลูกค้าและรายการสินค้าไม่บังคับสำหรับ draft หรือการพิมพ์ด่วน
                </div>
                {fieldErrors?.partnerId ? <small className="text-danger">{fieldErrors.partnerId}</small> : null}
              </div>

              <div className="col-lg-6">
                <Label htmlFor="customerNameText">ชื่อลูกค้าแบบกรอกเอง</Label>
                <Input
                  id="customerNameText"
                  value={formData.customerNameText}
                  onChange={(e) => setFormData((prev) => ({ ...prev, customerNameText: e.target.value }))}
                  placeholder="เช่น บริษัท เอบีซี จำกัด"
                />
                <div className="form-check mt-2">
                  <input
                    id="saveCustomerInfoForNextTime"
                    className="form-check-input"
                    type="checkbox"
                    checked={formData.saveCustomerInfoForNextTime}
                    onChange={(e) => setFormData((prev) => ({ ...prev, saveCustomerInfoForNextTime: e.target.checked }))}
                  />
                  <label className="form-check-label small" htmlFor="saveCustomerInfoForNextTime">
                    บันทึกข้อมูลลูกค้านี้ไว้ใช้ครั้งหน้า
                  </label>
                </div>
                {selectedPartnerQuery.data ? (
                  <div className="small text-muted mt-2">
                    เลือกแล้ว: <span className="fw-semibold">{selectedPartnerQuery.data.displayName}</span> (ID: {formData.partnerId})
                  </div>
                ) : null}
              </div>

              <div className="col-lg-6">
                <Label htmlFor="customerAddressText">ที่อยู่ลูกค้า</Label>
                <textarea
                  id="customerAddressText"
                  className="form-control qf-so-textarea"
                  rows={4}
                  value={formData.customerAddressText}
                  onChange={(e) => setFormData((prev) => ({ ...prev, customerAddressText: e.target.value }))}
                  placeholder="กรอกที่อยู่สำหรับพิมพ์ใบเสนอราคา"
                />
              </div>

              <div className="col-lg-6">
                <div className="row g-3">
                  <div className="col-md-6">
                    <Label htmlFor="customerPhoneText">โทรศัพท์</Label>
                    <Input
                      id="customerPhoneText"
                      value={formData.customerPhoneText}
                      onChange={(e) => setFormData((prev) => ({ ...prev, customerPhoneText: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-6">
                    <Label htmlFor="customerEmailText">อีเมล</Label>
                    <Input
                      id="customerEmailText"
                      type="email"
                      value={formData.customerEmailText}
                      onChange={(e) => setFormData((prev) => ({ ...prev, customerEmailText: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-6">
                    <Label htmlFor="customerTaxIdText">เลขผู้เสียภาษี</Label>
                    <Input
                      id="customerTaxIdText"
                      value={formData.customerTaxIdText}
                      onChange={(e) => setFormData((prev) => ({ ...prev, customerTaxIdText: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-6">
                    <Label htmlFor="customerBranchText">สาขา</Label>
                    <Input
                      id="customerBranchText"
                      value={formData.customerBranchText}
                      onChange={(e) => setFormData((prev) => ({ ...prev, customerBranchText: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <div className="col-md-4">
                <Label htmlFor="orderDate" required>
                  วันที่เอกสาร
                </Label>
                <Input
                  id="orderDate"
                  type="date"
                  value={formData.orderDate}
                  onChange={(e) => setFormData((prev) => ({ ...prev, orderDate: e.target.value }))}
                  required
                />
              </div>

              <div className="col-md-4">
                <Label htmlFor="paymentTermText">เงื่อนไขชำระเงิน</Label>
                <Input
                  id="paymentTermText"
                  value={formData.paymentTermText}
                  onChange={(e) => setFormData((prev) => ({ ...prev, paymentTermText: e.target.value }))}
                  placeholder="เช่น 7 วัน / เงินสด"
                />
              </div>

              <div className="col-md-4">
                <Label htmlFor="validityDate">วันหมดอายุ / ครบกำหนด</Label>
                <Input
                  id="validityDate"
                  type="date"
                  value={formData.validityDate || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, validityDate: e.target.value || undefined }))}
                />
              </div>

              <div className="col-md-4">
                <Label htmlFor="currency" required>
                  สกุลเงิน
                </Label>
                <Input
                  id="currency"
                  value={formData.currency}
                  onChange={(e) => setFormData((prev) => ({ ...prev, currency: e.target.value }))}
                  placeholder="THB"
                  required
                />
              </div>

              <div className="col-md-4">
                <Label htmlFor="orderType">ประเภทเอกสาร</Label>
                <select
                  id="orderType"
                  className="form-select"
                  value={formData.orderType}
                  onChange={(e) => setFormData((prev) => ({ ...prev, orderType: e.target.value as SalesOrderType }))}
                >
                  <option value="quotation">ใบเสนอราคา</option>
                  <option value="sale">Sale Order</option>
                </select>
              </div>

              <div className="col-md-4">
                <Label htmlFor="taxMode">โหมดภาษี</Label>
                <select
                  id="taxMode"
                  className="form-select"
                  value={formData.vatEnabled ? 'vat' : 'no_vat'}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      vatEnabled: e.target.value !== 'no_vat',
                    }))
                  }
                >
                  <option value="vat">มี VAT</option>
                  <option value="no_vat">ไม่มี VAT</option>
                </select>
              </div>
            </div>
          </Card>

          <Card className="qf-so-panel qf-so-lines-panel mt-4">
            <div className="qf-so-section-title d-flex flex-wrap align-items-center justify-content-between gap-2">
              <span>รายการสินค้า</span>
              <span className="small text-muted">ลากลำดับได้ในเวอร์ชันถัดไป, ตอนนี้เพิ่ม/ลบ/กรอกได้ทันที</span>
            </div>
            <div className="qf-so-order-line-wrap">
              <table className="qf-so-order-line-table">
                <thead>
                  <tr>
                    <th className="qf-so-col-icon"></th>
                    <th className="qf-so-col-index">#</th>
                    <th className="qf-so-col-code">รหัสสินค้า</th>
                    <th className="qf-so-col-product">สินค้า</th>
                    <th className="qf-so-col-desc">รายละเอียด</th>
                    <th className="qf-so-col-qty">จำนวน</th>
                    <th className="qf-so-col-price">ราคาต่อหน่วย</th>
                    <th className="qf-so-col-discount">ส่วนลด (%)</th>
                    <th className="qf-so-col-tax">ภาษี</th>
                    <th className="qf-so-col-total">รวมเป็นเงิน</th>
                    <th className="qf-so-col-delete"></th>
                  </tr>
                </thead>
                <tbody>
                  {formData.lines.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="text-center text-muted py-4">
                        ยังไม่มีรายการสินค้า กด <strong>เพิ่มรายการ</strong> เพื่อเริ่มกรอก
                      </td>
                    </tr>
                  ) : null}
                  {formData.lines.map((line, idx) => {
                    const computed = renderedLineTotals[idx]
                    const lineType = line.lineType || 'normal'
                    if (lineType === 'section' || lineType === 'note') {
                      return (
                        <tr key={idx} className={lineType === 'section' ? 'qf-so-line-row--section' : 'qf-so-line-row--note'}>
                          <td className="text-center">
                            <i className={`bi ${lineType === 'section' ? 'bi-folder2-open' : 'bi-sticky'} text-muted`} />
                          </td>
                          <td className="text-center fw-semibold">{idx + 1}</td>
                          <td colSpan={8}>
                            <Input
                              value={line.description}
                              onChange={(e) => updateLine(idx, { description: e.target.value })}
                              placeholder={lineType === 'section' ? 'หัวข้อ' : 'หมายเหตุ'}
                              className={`qf-so-line-inline-input qf-so-line-inline-input--${lineType}`}
                            />
                          </td>
                          <td className="text-center">
                            <button
                              type="button"
                              className="btn btn-link text-danger qf-so-line-delete"
                              onClick={() => removeLine(idx)}
                              aria-label="ลบรายการ"
                              title="ลบรายการ"
                            >
                              <i className="bi bi-trash" />
                            </button>
                          </td>
                        </tr>
                      )
                    }
                    return (
                      <tr key={idx}>
                        <td className="text-center">
                          <i className="bi bi-grip-vertical text-muted" />
                        </td>
                        <td className="text-center fw-semibold">{idx + 1}</td>
                        <td>
                          <Input
                            value={line.productCode || ''}
                            onChange={(e) => updateLine(idx, { productCode: e.target.value })}
                            placeholder="รหัสสินค้า"
                            className="qf-so-line-code-input"
                            readOnly
                          />
                        </td>
                        <td>
                          <ProductCombobox
                            id={`so-product-${idx}`}
                            valueId={line.productId ?? null}
                            compact
                            onPick={(product) => {
                              const productTaxIds = Array.isArray(product.taxes)
                                ? product.taxes.map((t) => Number(t.id)).filter((n) => Number.isFinite(n) && n > 0)
                                : []
                              const productName = stripLeadingProductCode(product.name, product.defaultCode)
                              updateLine(idx, {
                                lineType: 'normal',
                                productId: product.id,
                                productCode: product.defaultCode || '',
                                description: line.description.trim() ? line.description : productName,
                                unitPrice: typeof product.listPrice === 'number' ? product.listPrice : line.unitPrice,
                                taxIds: productTaxIds.length > 0 ? productTaxIds : [],
                              })
                            }}
                          />
                        </td>
                        <td>
                          <textarea
                            className="form-control qf-so-textarea qf-so-line-desc"
                            value={line.description}
                            onChange={(e) => updateLine(idx, { description: e.target.value })}
                            rows={1}
                            placeholder="รายละเอียดสินค้า/บริการ"
                          />
                        </td>
                        <td>
                          <Input
                            type="number"
                            className="text-end"
                            value={toNumberLike(line.quantity, 1)}
                            min="0"
                            step="1"
                            onChange={(e) => updateLine(idx, { quantity: toNumberLike(e.target.value, 1) })}
                          />
                        </td>
                        <td>
                          <Input
                            type="number"
                            className="text-end"
                            value={toNumberLike(line.unitPrice)}
                            min="0"
                            step="0.01"
                            onChange={(e) => updateLine(idx, { unitPrice: toNumberLike(e.target.value) })}
                          />
                        </td>
                        <td>
                          <Input
                            type="number"
                            className="text-end"
                            value={toNumberLike(line.discountPercent ?? line.discount)}
                            min="0"
                            max="100"
                            step="0.1"
                            onChange={(e) => updateLine(idx, { discount: toNumberLike(e.target.value), discountPercent: toNumberLike(e.target.value) })}
                          />
                        </td>
                        <td>
                          <select
                            className="form-select"
                            value={line.taxIds?.[0] ?? ''}
                            onChange={(e) => {
                              const taxId = e.target.value ? Number(e.target.value) : null
                              updateLine(idx, { taxIds: taxId ? [taxId] : [] })
                            }}
                          >
                            <option value="">ไม่กำหนด</option>
                            {saleTaxOptions.map((tax) => (
                              <option key={tax.id} value={tax.id}>
                                {tax.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="text-end fw-semibold">
                          {computed.total.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="text-center">
                          <button
                            type="button"
                            className="btn btn-link text-danger qf-so-line-delete"
                            onClick={() => removeLine(idx)}
                            aria-label="ลบรายการ"
                            title="ลบรายการ"
                          >
                            <i className="bi bi-trash" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="qf-so-order-line-actions">
              <Button type="button" variant="secondary" size="sm" onClick={addLine}>
                + เพิ่มรายการ
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={addSectionLine}>
                + เพิ่มหัวข้อ
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={addNoteLine}>
                + เพิ่มหมายเหตุ
              </Button>
            </div>
          </Card>

          <Card className="qf-so-panel qf-so-bottom-panel mt-4">
            <div className="qf-so-section-title">หมายเหตุและเอกสารแนบ</div>
            <div className="row g-3">
              <div className="col-xl-7">
                <Label htmlFor="notes">หมายเหตุ</Label>
                <textarea
                  id="notes"
                  className="form-control qf-so-textarea"
                  rows={5}
                  value={formData.notes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="ข้อความที่จะพิมพ์ให้ลูกค้า"
                />
                {recentNotes.length > 0 ? (
                  <div className="mt-2">
                    <div className="small text-muted mb-1">หมายเหตุที่ใช้ล่าสุด</div>
                    <div className="d-flex flex-wrap gap-2">
                      {recentNotes.slice(0, 4).map((note, idx) => (
                        <div key={`${idx}-${note.slice(0, 12)}`} className="d-flex gap-1">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => applyRecentNote(note)}
                            title={note}
                          >
                            ใช้ล่าสุด {idx + 1}
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => appendRecentNote(note)}
                            title={note}
                          >
                            +
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="col-xl-5">
                <Label htmlFor="internalNotes">โน้ตภายในบริษัท</Label>
                <textarea
                  id="internalNotes"
                  className="form-control qf-so-textarea"
                  rows={5}
                  value={formData.internalNotes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, internalNotes: e.target.value }))}
                  placeholder="ข้อความภายในบริษัท ไม่พิมพ์ออกใบเสนอราคา"
                />
                {recentInternalNotes.length > 0 ? (
                  <div className="mt-2">
                    <div className="small text-muted mb-1">โน้ตภายในที่ใช้ล่าสุด</div>
                    <div className="d-flex flex-wrap gap-2">
                      {recentInternalNotes.slice(0, 4).map((note, idx) => (
                        <div key={`${idx}-${note.slice(0, 12)}`} className="d-flex gap-1">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => applyRecentInternalNote(note)}
                            title={note}
                          >
                            ใช้ล่าสุด {idx + 1}
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => appendRecentInternalNote(note)}
                            title={note}
                          >
                            +
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="col-12">
                <div
                  className="qf-so-dropzone"
                  role="button"
                  tabIndex={0}
                  onClick={() => window.document.getElementById('sales-order-attachments')?.click()}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      window.document.getElementById('sales-order-attachments')?.click()
                    }
                  }}
                  onDragOver={(event) => {
                    event.preventDefault()
                    event.dataTransfer.dropEffect = 'copy'
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    handleFilesPicked(event.dataTransfer.files)
                  }}
                >
                  <div className="qf-so-dropzone__title">เอกสารแนบ</div>
                  <div className="qf-so-dropzone__subtitle">ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์</div>
                  <input
                    id="sales-order-attachments"
                    key={attachmentPickerKey}
                    type="file"
                    className="d-none"
                    multiple
                    onChange={(e) => {
                      if (e.target.files) handleFilesPicked(e.target.files)
                      setAttachmentPickerKey((prev) => prev + 1)
                    }}
                  />
                </div>
                {attachmentItems.length > 0 ? (
                  <div className="qf-so-attachment-list">
                    {attachmentItems.map((attachment, index) => (
                      <div key={`${attachment.name}-${index}`} className="qf-so-attachment-item">
                        <div>
                          <div className="fw-semibold">{attachment.name}</div>
                          <div className="small text-muted">
                            {[attachment.type || 'file', attachment.size ? `${Math.round(attachment.size / 1024)} KB` : null]
                              .filter(Boolean)
                              .join(' · ')}
                          </div>
                          {attachment.file ? <div className="small text-warning">รออัปโหลดจริง</div> : attachment.url ? <div className="small text-success">มี URL จาก backend</div> : null}
                        </div>
                        <div className="d-flex align-items-center gap-1">
                          <button
                            type="button"
                            className="btn btn-sm btn-link"
                            onClick={() => previewAttachment(attachment)}
                            aria-label={`ดูตัวอย่าง ${attachment.name}`}
                            title="ดูตัวอย่าง"
                          >
                            <i className="bi bi-eye" />
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-link"
                            onClick={() => downloadAttachment(attachment)}
                            aria-label={`ดาวน์โหลด ${attachment.name}`}
                            title="ดาวน์โหลด"
                          >
                            <i className="bi bi-download" />
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-link text-danger"
                            onClick={() => void removeAttachment(index)}
                            aria-label={`ลบ ${attachment.name}`}
                            title="ลบ"
                          >
                            <i className="bi bi-x-lg" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="small text-warning mt-2">
                  ไฟล์แนบยังไม่ถูกอัปโหลดจริง จะเก็บเฉพาะชื่อไฟล์จนกว่า backend รองรับ
                </div>
              </div>
            </div>
          </Card>
        </div>

        <aside className="qf-so-summary">
          <Card className="qf-so-summary-card">
            <div className="qf-so-section-title">สรุปเอกสาร</div>
            <div className="qf-so-summary__row">
              <span>จำนวนรายการ</span>
              <strong>{formData.lines.length}</strong>
            </div>
            <div className="qf-so-summary__row">
              <span>ยอดก่อนส่วนลด</span>
              <strong>{asCurrency(grossSubtotalAmount, formData.currency)}</strong>
            </div>
            <div className="qf-so-summary__row">
              <span>ส่วนลด</span>
              <strong>{asCurrency(discountAmount, formData.currency)}</strong>
            </div>
            <div className="qf-so-summary__row">
              <span>หลังหักส่วนลด</span>
              <strong>{asCurrency(afterDiscountAmount, formData.currency)}</strong>
            </div>
            <div className="qf-so-summary__block">
              <div className="d-flex justify-content-between gap-2 align-items-center mb-2">
                <Label className="mb-0" htmlFor="vatEnabled">
                  VAT
                </Label>
                <div className="form-check form-switch m-0">
                  <input
                    id="vatEnabled"
                    className="form-check-input"
                    type="checkbox"
                    checked={formData.vatEnabled}
                    onChange={(e) => setFormData((prev) => ({ ...prev, vatEnabled: e.target.checked }))}
                  />
                </div>
              </div>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={formData.vatRate}
                onChange={(e) => setFormData((prev) => ({ ...prev, vatRate: toNumberLike(e.target.value, defaultSaleTaxRate) }))}
              />
              <div className="small text-muted mt-1">อัตราเริ่มต้น {defaultSaleTaxRate}%</div>
            </div>
            <div className="qf-so-summary__row">
              <span>VAT รวม</span>
              <strong>{asCurrency(vatAmount, formData.currency)}</strong>
            </div>
            <div className="qf-so-summary__block">
              <div className="d-flex justify-content-between gap-2 align-items-center mb-2">
                <Label className="mb-0" htmlFor="whtEnabled">
                  หัก ณ ที่จ่าย
                </Label>
                <div className="form-check form-switch m-0">
                  <input
                    id="whtEnabled"
                    className="form-check-input"
                    type="checkbox"
                    checked={formData.withholdingTaxEnabled}
                    onChange={(e) => setFormData((prev) => ({ ...prev, withholdingTaxEnabled: e.target.checked }))}
                  />
                </div>
              </div>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={formData.withholdingTaxRate}
                onChange={(e) => setFormData((prev) => ({ ...prev, withholdingTaxRate: toNumberLike(e.target.value, 3) }))}
              />
            </div>
            <div className="qf-so-summary__row">
              <span>หัก ณ ที่จ่าย</span>
              <strong>{asCurrency(withholdingAmount, formData.currency)}</strong>
            </div>
            <div className="qf-so-summary__row qf-so-summary__row--grand">
              <span>ยอดสุทธิ</span>
              <strong>{asCurrency(grandTotal, formData.currency)}</strong>
            </div>
            <div className="qf-so-summary__row">
              <span>ยอดคงค้าง</span>
              <strong>{asCurrency(grandTotal, formData.currency)}</strong>
            </div>
          </Card>

          <Card className="qf-so-summary-card qf-so-summary-card--hint mt-3">
            <div className="qf-so-section-title">ข้อมูลช่วยจำ</div>
            <div className="small text-muted">
              ระบบจะบันทึก draft อัตโนมัติ, จำค่าภาษี/สกุลเงิน/เงื่อนไขชำระเงิน และเก็บหมายเหตุล่าสุดไว้ให้ใช้ซ้ำได้
            </div>
          </Card>
        </aside>
      </div>

      <div className="small text-muted mt-3">
        หาก backend ยังไม่พร้อมรับข้อมูลแนบ ไฟล์จะถูกเก็บเป็น metadata ใน draft และพิมพ์/ดาวน์โหลดได้ตามข้อมูลปัจจุบัน
      </div>

      </form>
    </DocumentPageLayout>

      <Modal show={quickPartnerOpen} onHide={() => setQuickPartnerOpen(false)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>สร้างรายชื่อติดต่อใหม่ (Quick Create)</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="row g-3">
            <div className="col-12">
              <Label htmlFor="quick-partner-name" required>
                ชื่อรายชื่อติดต่อ
              </Label>
              <Input
                id="quick-partner-name"
                value={quickPartner.name}
                onChange={(e) => setQuickPartner((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="col-md-6">
              <Label htmlFor="quick-partner-vat">เลขผู้เสียภาษี</Label>
              <Input
                id="quick-partner-vat"
                value={quickPartner.vat || ''}
                inputMode="numeric"
                maxLength={13}
                onChange={(e) => setQuickPartner((prev) => ({ ...prev, vat: sanitizeVatNumber(e.target.value) }))}
              />
              {thaiVatValidationMessage(quickPartner.vat) ? (
                <div className="small text-danger mt-1">{thaiVatValidationMessage(quickPartner.vat)}</div>
              ) : null}
            </div>
            <div className="col-md-6">
              <Label htmlFor="quick-partner-phone">โทรศัพท์</Label>
              <Input
                id="quick-partner-phone"
                value={quickPartner.phone || ''}
                onChange={(e) => setQuickPartner((prev) => ({ ...prev, phone: e.target.value }))}
              />
            </div>
            <div className="col-md-6">
              <Label htmlFor="quick-partner-email">อีเมล</Label>
              <Input
                id="quick-partner-email"
                type="email"
                value={quickPartner.email || ''}
                onChange={(e) => setQuickPartner((prev) => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div className="col-md-6">
              <Label htmlFor="quick-partner-vat-mode">ประเภทราคา</Label>
              <select
                id="quick-partner-vat-mode"
                className="form-select"
                value={quickPartner.vatPriceMode || 'vat_excluded'}
                onChange={(e) =>
                  setQuickPartner((prev) => ({
                    ...prev,
                    vatPriceMode: e.target.value as PartnerUpsertPayload['vatPriceMode'],
                  }))
                }
              >
                <option value="no_vat">ไม่มี VAT</option>
                <option value="vat_included">รวม VAT</option>
                <option value="vat_excluded">แยก VAT</option>
              </select>
            </div>
            <div className="col-md-6">
              <Label htmlFor="quick-partner-branch">สาขา</Label>
              <Input
                id="quick-partner-branch"
                value={quickPartner.branchCode || ''}
                onChange={(e) => setQuickPartner((prev) => ({ ...prev, branchCode: e.target.value }))}
              />
            </div>
            <div className="col-md-6">
              <CountrySelector
                value={quickPartner.countryId}
                onChange={(value) =>
                  setQuickPartner((prev) => ({
                    ...prev,
                    countryId: value,
                    stateId: value === thailandId ? prev.stateId ?? null : null,
                    provinceId: value === thailandId ? prev.provinceId ?? null : null,
                    districtId: value === thailandId ? prev.districtId ?? null : null,
                    subDistrictId: value === thailandId ? prev.subDistrictId ?? null : null,
                  }))
                }
              />
            </div>
            {quickPartner.countryId === thailandId ? (
              <>
                <div className="col-md-6">
                <ThaiProvinceSelector
                  value={quickPartner.provinceId}
                  onChange={(value) => {
                      setQuickPartner((prev) => ({
                        ...prev,
                        provinceId: value,
                        districtId: null,
                        subDistrictId: null,
                        district: '',
                        city: '',
                        subDistrict: '',
                        zip: '',
                      }))
                    }}
                  />
                </div>
                <div className="col-md-6">
                  <ThaiDistrictSelector
                    provinceId={quickPartner.provinceId}
                    value={quickPartner.districtId}
                    onChange={(value) => {
                      setQuickPartner((prev) => ({
                        ...prev,
                        districtId: value,
                        subDistrictId: null,
                        district: '',
                        city: '',
                        subDistrict: '',
                        zip: '',
                      }))
                    }}
                  />
                </div>
                <div className="col-md-6">
                  <ThaiSubDistrictSelector
                    provinceId={quickPartner.provinceId}
                    districtId={quickPartner.districtId}
                    value={quickPartner.subDistrictId}
                    onChange={(value) => {
                      setQuickPartner((prev) => ({
                        ...prev,
                        subDistrictId: value,
                        subDistrict: '',
                        zip: '',
                      }))
                    }}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="col-md-6">
                  <StateSelector
                    countryId={quickPartner.countryId}
                    value={quickPartner.stateId}
                    onChange={(value) => setQuickPartner((prev) => ({ ...prev, stateId: value }))}
                  />
                </div>
                <div className="col-md-6">
                  <Label htmlFor="quick-partner-district">เขต/อำเภอ</Label>
                  <Input
                    id="quick-partner-district"
                    value={quickPartner.district || ''}
                    onBlur={() => {
                      resolveQuickPartnerThaiAddress().catch(() => undefined)
                    }}
                    onChange={(e) => setQuickPartner((prev) => ({ ...prev, district: e.target.value, city: e.target.value }))}
                  />
                </div>
                <div className="col-md-6">
                  <Label htmlFor="quick-partner-subDistrict">แขวง/ตำบล</Label>
                  <Input
                    id="quick-partner-subDistrict"
                    value={quickPartner.subDistrict || ''}
                    onBlur={() => {
                      resolveQuickPartnerThaiAddress().catch(() => undefined)
                    }}
                    onChange={(e) => setQuickPartner((prev) => ({ ...prev, subDistrict: e.target.value }))}
                  />
                </div>
              </>
            )}
            <div className="col-md-6">
              <Label htmlFor="quick-partner-zip">รหัสไปรษณีย์</Label>
              <Input
                id="quick-partner-zip"
                value={quickPartner.zip || ''}
                onBlur={() => {
                  resolveQuickPartnerThaiAddress().catch(() => undefined)
                }}
                onChange={(e) => setQuickPartner((prev) => ({ ...prev, zip: e.target.value }))}
              />
            </div>
            <div className="col-12">
              <Label htmlFor="quick-partner-street">ที่อยู่</Label>
              <Input
                id="quick-partner-street"
                value={quickPartner.street || ''}
                onChange={(e) => setQuickPartner((prev) => ({ ...prev, street: e.target.value }))}
              />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button size="sm" variant="secondary" type="button" onClick={() => setQuickPartnerOpen(false)}>
            ยกเลิก
          </Button>
          <Button size="sm" type="button" onClick={submitQuickPartner} isLoading={quickPartnerSaving}>
            บันทึกผู้ติดต่อ
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  )
}

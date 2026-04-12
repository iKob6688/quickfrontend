import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Modal, Spinner } from 'react-bootstrap'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Combobox, type ComboboxOption } from '@/components/ui/Combobox'
import { ProductCombobox } from '@/features/sales/ProductCombobox'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import { extractFieldErrors, type FieldErrors } from '@/lib/formErrors'
import { clearDraft, loadDraft, loadRecentNotes, pushRecentNote, saveDraft } from '@/lib/formDrafts'
import { toast } from '@/lib/toastStore'
import { createPartner, listPartners, getPartner, type PartnerUpsertPayload } from '@/api/services/partners.service'
import { getDefaultVatTaxId, listVatTaxes, type TaxAdminListItem } from '@/api/services/taxes.service'
import {
  createSalesOrder,
  getSalesOrder,
  updateSalesOrder,
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
import {
  listThaiDistricts,
  listThaiProvinces,
  resolveThaiAddress,
  listThaiSubDistricts,
} from '@/api/services/thai-address.service'
import { normalizeVatNumber, sanitizeVatNumber, thaiVatValidationMessage } from '@/lib/vat'
import { useAppDateTimeFormatter } from '@/lib/dateFormat'

const SALES_ORDER_DRAFT_KEY = 'qf:draft:sales-order-form:create:v1'
const SALES_ORDER_RECENT_NOTES_KEY = 'qf:recent-notes:sales-order:v1'

function toNumberLike(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value.replace(/,/g, '').trim())
    return Number.isFinite(parsed) ? parsed : fallback
  }
  return fallback
}

function normalizeSalesLine(line: SalesOrderLine): SalesOrderLine {
  return {
    ...line,
    quantity: toNumberLike(line.quantity),
    unitPrice: toNumberLike(line.unitPrice),
    discount: toNumberLike(line.discount),
    subtotal: toNumberLike(line.subtotal),
    totalTax: toNumberLike(line.totalTax),
    total: toNumberLike(line.total),
    taxIds: Array.isArray(line.taxIds)
      ? line.taxIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
      : [],
  }
}

export function SalesOrderFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const formatDateTime = useAppDateTimeFormatter()
  const [searchParams] = useSearchParams()

  const isEdit = !!id
  const orderId = id ? Number.parseInt(id, 10) : null
  const partnerIdRaw = searchParams.get('partnerId')
  const partnerIdPrefill = partnerIdRaw ? Number(partnerIdRaw) : null
  const orderTypeParam = searchParams.get('orderType')
  const initialOrderType: SalesOrderType = orderTypeParam === 'sale' ? 'sale' : 'quotation'

  const { data: existingOrder, isLoading: isLoadingOrder } = useQuery({
    queryKey: ['salesOrder', orderId],
    queryFn: () => getSalesOrder(orderId!),
    enabled: isEdit && !!orderId,
  })

  const [formData, setFormData] = useState<SalesOrderPayload>(() => ({
    partnerId:
      !isEdit && partnerIdPrefill && Number.isFinite(partnerIdPrefill) && partnerIdPrefill > 0
        ? partnerIdPrefill
        : 0,
    orderDate: new Date().toISOString().split('T')[0],
    validityDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    currency: 'THB',
    orderType: initialOrderType,
    lines: [],
    notes: '',
  }))

  useEffect(() => {
    if (!isEdit || !existingOrder) return
    const timer = window.setTimeout(() => {
      setFormData({
        partnerId: existingOrder.partnerId,
        orderDate: existingOrder.orderDate ? existingOrder.orderDate.split('T')[0] : new Date().toISOString().split('T')[0],
        validityDate: existingOrder.validityDate ? existingOrder.validityDate.split('T')[0] : undefined,
        currency: existingOrder.currency || 'THB',
        orderType: existingOrder.orderType || 'quotation',
        lines: (existingOrder.lines || []).map((line) => normalizeSalesLine(line)),
        notes: existingOrder.notes || '',
      })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [isEdit, existingOrder])

  const [partnerSearch, setPartnerSearch] = useState('')
  const [quickPartnerOpen, setQuickPartnerOpen] = useState(false)
  const [quickPartnerSaving, setQuickPartnerSaving] = useState(false)
  const thailandId = Number(import.meta.env.VITE_COUNTRY_TH_ID || 219)
  const [quickPartner, setQuickPartner] = useState<PartnerUpsertPayload>({
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

  const partnerOptionsQuery = useInfiniteQuery({
    queryKey: ['partner-selector-sales-order', debouncedPartnerSearch],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      listPartners({
        q: debouncedPartnerSearch || undefined,
        active: true,
        limit: partnerLimit,
        offset: pageParam,
      }),
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((acc, p) => acc + (p?.items?.length ?? 0), 0)
      if (loaded >= (lastPage?.total ?? 0)) return undefined
      if ((lastPage?.items?.length ?? 0) < partnerLimit) return undefined
      return loaded
    },
    staleTime: 30_000,
  })

  const partnerItems = useMemo(() => partnerOptionsQuery.data?.pages.flatMap((p) => p.items) ?? [], [partnerOptionsQuery.data?.pages])
  const partnerTotal = partnerOptionsQuery.data?.pages[0]?.total

  const selectedPartnerQuery = useQuery({
    queryKey: ['partner', formData.partnerId],
    enabled: formData.partnerId > 0,
    queryFn: () => getPartner(formData.partnerId),
    staleTime: 30_000,
  })

  useEffect(() => {
    if (!selectedPartnerQuery.data || partnerSearch.trim()) return
    setPartnerSearch(selectedPartnerQuery.data.displayName || selectedPartnerQuery.data.name)
  }, [selectedPartnerQuery.data, partnerSearch])

  const [fieldErrors, setFieldErrors] = useState<FieldErrors | null>(null)
  const [recentNotes, setRecentNotes] = useState<string[]>([])
  const [draftPendingRestore, setDraftPendingRestore] = useState<SalesOrderPayload | null>(null)
  const [draftUpdatedAt, setDraftUpdatedAt] = useState<string | null>(null)
  const [draftGateResolved, setDraftGateResolved] = useState(false)
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null)

  const salesTaxesQuery = useQuery({
    queryKey: ['tax-admin', 'sales-order-form', 'sale'],
    queryFn: () => listVatTaxes({ typeTaxUse: 'sale', activeOnly: true, limit: 500 }),
    staleTime: 60_000,
  })

  const saleTaxOptions = useMemo(() => salesTaxesQuery.data?.items ?? [], [salesTaxesQuery.data])
  const saleTaxMap = useMemo(() => new Map<number, TaxAdminListItem>(saleTaxOptions.map((tax) => [tax.id, tax])), [saleTaxOptions])
  const defaultSaleTaxId = useMemo(() => {
    return getDefaultVatTaxId(saleTaxOptions)
  }, [saleTaxOptions])

  useEffect(() => {
    setRecentNotes(loadRecentNotes(SALES_ORDER_RECENT_NOTES_KEY))
  }, [])

  useEffect(() => {
    if (isEdit) {
      setDraftGateResolved(true)
      return
    }
    const draft = loadDraft<SalesOrderPayload>(SALES_ORDER_DRAFT_KEY)
    if (draft?.data) {
      setDraftPendingRestore(draft.data)
      setDraftUpdatedAt(draft.updatedAt || null)
    }
    setDraftGateResolved(true)
  }, [isEdit])

  useEffect(() => {
    if (isEdit) return
    if (!draftGateResolved) return
    if (draftPendingRestore) return
    const timer = window.setTimeout(() => {
      saveDraft(SALES_ORDER_DRAFT_KEY, formData)
      setDraftSavedAt(new Date().toISOString())
    }, 700)
    return () => window.clearTimeout(timer)
  }, [isEdit, draftGateResolved, draftPendingRestore, formData])

  const applyRecentNote = (note: string) => {
    setFormData((prev) => ({ ...prev, notes: note }))
  }

  const appendRecentNote = (note: string) => {
    setFormData((prev) => ({
      ...prev,
      notes: prev.notes?.trim() ? `${prev.notes}\n${note}` : note,
    }))
  }

  const createMutation = useMutation({
    mutationFn: (payload: SalesOrderPayload) => createSalesOrder(payload),
    onSuccess: (data) => {
      clearDraft(SALES_ORDER_DRAFT_KEY)
      if (formData.notes?.trim()) {
        pushRecentNote(SALES_ORDER_RECENT_NOTES_KEY, formData.notes)
        setRecentNotes(loadRecentNotes(SALES_ORDER_RECENT_NOTES_KEY))
      }
      queryClient.invalidateQueries({ queryKey: ['salesOrders'] })
      toast.success('สร้างเอกสารขายสำเร็จ', data.number ? `เลขที่: ${data.number}` : undefined)
      navigate(`/sales/orders/${data.id}`)
    },
    onError: (err) => {
      const fe = extractFieldErrors(err)
      if (fe) setFieldErrors(fe)
      toast.error('สร้างเอกสารขายไม่สำเร็จ', err instanceof Error ? err.message : undefined)
    },
  })

  const updateMutation = useMutation({
    mutationFn: (payload: SalesOrderPayload) => updateSalesOrder(orderId!, payload),
    onSuccess: () => {
      if (formData.notes?.trim()) {
        pushRecentNote(SALES_ORDER_RECENT_NOTES_KEY, formData.notes)
        setRecentNotes(loadRecentNotes(SALES_ORDER_RECENT_NOTES_KEY))
      }
      queryClient.invalidateQueries({ queryKey: ['salesOrder', orderId] })
      queryClient.invalidateQueries({ queryKey: ['salesOrders'] })
      toast.success('บันทึกเอกสารขายสำเร็จ')
      navigate(`/sales/orders/${orderId}`)
    },
    onError: (err) => {
      const fe = extractFieldErrors(err)
      if (fe) setFieldErrors(fe)
      toast.error('บันทึกเอกสารขายไม่สำเร็จ', err instanceof Error ? err.message : undefined)
    },
  })

  const canSubmit = useMemo(() => {
    if (!formData.partnerId || formData.partnerId <= 0) return false
    if (!formData.orderDate) return false
    if (!formData.currency) return false
    if (!formData.lines.length) return false
    return true
  }, [formData])

  const updateLine = (index: number, updates: Partial<SalesOrderLine>) => {
    setFormData((prev) => {
      const lines = [...prev.lines]
      if (index < 0 || index >= lines.length) return prev
      const merged = { ...lines[index], ...updates }
      const quantity = merged.quantity || 0
      const unitPrice = merged.unitPrice || 0
      const discountPercent = merged.discount || 0
      const subtotalBeforeDiscount = quantity * unitPrice
      const discountedSubtotal = subtotalBeforeDiscount - (subtotalBeforeDiscount * discountPercent) / 100
      const firstTaxId = Array.isArray(merged.taxIds) ? Number(merged.taxIds[0] || 0) : 0
      const firstTax = firstTaxId > 0 ? saleTaxMap.get(firstTaxId) : undefined
      let subtotal = discountedSubtotal
      let totalTax = 0
      if (firstTax && String(firstTax.amountType || firstTax.type || 'percent') === 'percent') {
        const rate = Number(firstTax.amount || 0)
        if (rate > 0) {
          if (firstTax.priceInclude) {
            subtotal = discountedSubtotal / (1 + rate / 100)
            totalTax = discountedSubtotal - subtotal
          } else {
            totalTax = subtotal * (rate / 100)
          }
        }
      }
      lines[index] = {
        ...merged,
        subtotal,
        totalTax,
        total: subtotal + totalTax,
      }
      return { ...prev, lines }
    })
  }

  const addLine = () => {
    setFormData((prev) => ({
      ...prev,
      lines: [
        ...prev.lines,
        {
          productId: null,
          description: '',
          quantity: 1,
          unitPrice: 0,
          discount: 0,
          taxIds: defaultSaleTaxId ? [defaultSaleTaxId] : [],
          subtotal: 0,
          totalTax: 0,
          total: 0,
        },
      ],
    }))
  }

  useEffect(() => {
    if (!defaultSaleTaxId) return
    setFormData((prev) => {
      if (!prev.lines.some((line) => !Array.isArray(line.taxIds) || line.taxIds.length === 0)) return prev
      return {
        ...prev,
        lines: prev.lines.map((line) =>
          !Array.isArray(line.taxIds) || line.taxIds.length === 0
            ? { ...line, taxIds: [defaultSaleTaxId] }
            : line,
        ),
      }
    })
  }, [defaultSaleTaxId])

  const removeLine = (index: number) => {
    const ok = window.confirm('ยืนยันการลบรายการนี้?')
    if (!ok) return
    setFormData((prev) => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== index),
    }))
  }

  const totalTaxAmount = formData.lines.reduce((sum, line) => sum + (line.totalTax || 0), 0)
  const totalAmount = formData.lines.reduce((sum, line) => sum + (line.total || 0), 0)
  const isQuickPartnerThai = (quickPartner.countryId ?? thailandId) === thailandId
  const lastResolvedQuickPartnerZipRef = useRef<string>('')

  const handleQuickPartnerProvinceChange = async (provinceId: number | null) => {
    const selected = provinceId ? (await listThaiProvinces()).find((item) => item.id === provinceId) : null
    setQuickPartner((prev) => ({
      ...prev,
      provinceId,
      stateId: selected?.stateId ?? null,
      districtId: null,
      subDistrictId: null,
      district: '',
      city: '',
      subDistrict: '',
      zip: '',
    }))
  }

  const handleQuickPartnerDistrictChange = async (districtId: number | null) => {
    const selected = districtId
      ? (await listThaiDistricts({ provinceId: quickPartner.provinceId ?? null })).find((item) => item.id === districtId)
      : null
    setQuickPartner((prev) => ({
      ...prev,
      districtId,
      subDistrictId: null,
      district: selected?.name || '',
      city: selected?.name || '',
      subDistrict: '',
      zip: '',
    }))
  }

  const handleQuickPartnerSubDistrictChange = async (subDistrictId: number | null) => {
    if (!subDistrictId) {
      setQuickPartner((prev) => ({ ...prev, subDistrictId: null, subDistrict: '', zip: '' }))
      return
    }
    const selected = (await listThaiSubDistricts({ provinceId: quickPartner.provinceId ?? null, districtId: quickPartner.districtId ?? null })).find(
      (item) => item.id === subDistrictId,
    )
    setQuickPartner((prev) => ({
      ...prev,
      subDistrictId,
      subDistrict: selected?.name || '',
      zip: selected?.zipCode || '',
    }))
  }

  const resolveQuickPartnerThaiAddress = async () => {
    if (!isQuickPartnerThai) return
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
    if (!isQuickPartnerThai || zip.length !== 5 || !/^\d{5}$/.test(zip)) {
      if (!zip) lastResolvedQuickPartnerZipRef.current = ''
      return
    }
    if (lastResolvedQuickPartnerZipRef.current === zip) return
    lastResolvedQuickPartnerZipRef.current = zip
    resolveQuickPartnerThaiAddress().catch(() => {
      lastResolvedQuickPartnerZipRef.current = ''
    })
  }, [isQuickPartnerThai, quickPartner.zip])

  const submitQuickPartner = async () => {
    if (!quickPartner.name?.trim()) {
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
      setFormData((prev) => ({ ...prev, partnerId: created.id }))
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFieldErrors(null)
    if (!canSubmit) {
      toast.error('กรอกข้อมูลเอกสารขายให้ครบก่อนบันทึก')
      return
    }

    if (isEdit) updateMutation.mutate(formData)
    else createMutation.mutate(formData)
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

  return (
    <>
    <form onSubmit={handleSubmit} className="qf-so-page">
      <PageHeader
        title={isEdit ? 'แก้ไขใบเสนอราคา / Sale Order' : 'สร้างใบเสนอราคา / Sale Order'}
        subtitle={isEdit && existingOrder ? existingOrder.number || `#${existingOrder.id}` : 'รองรับการทำงานร่วมกับ Odoo18 (adt_th_api)'}
        breadcrumb="รายรับ · ใบเสนอราคา · Sale Order"
        actions={
          <div className="d-flex align-items-center gap-2 qf-so-actions">
            {!isEdit && draftSavedAt ? (
              <span className="small text-muted">
                autosaved {formatDateTime(draftSavedAt)}
              </span>
            ) : null}
            <Button size="sm" variant="ghost" onClick={() => navigate('/products')}>
              เมนูสินค้า
            </Button>
            <Button size="sm" variant="secondary" onClick={() => navigate(isEdit ? `/sales/orders/${orderId}` : '/sales/orders')}>
              ยกเลิก
            </Button>
            <Button size="sm" type="submit" isLoading={createMutation.isPending || updateMutation.isPending} disabled={!canSubmit}>
              บันทึก
            </Button>
          </div>
        }
      />

      <div className="row g-4">
        <div className="col-lg-8">
          {!isEdit && draftPendingRestore ? (
            <Alert variant="warning" className="small">
              <div className="fw-semibold mb-1">พบ draft ที่บันทึกไว้</div>
              <div className="mb-2">
                เวลา: {formatDateTime(draftUpdatedAt, 'ไม่ทราบเวลา')}
              </div>
              <div className="d-flex gap-2">
                <Button
                  size="sm"
                  type="button"
                  onClick={() => {
                    setFormData(draftPendingRestore)
                    setDraftPendingRestore(null)
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
                    clearDraft(SALES_ORDER_DRAFT_KEY)
                    setDraftPendingRestore(null)
                    setDraftUpdatedAt(null)
                  }}
                >
                  ลบ draft
                </Button>
              </div>
            </Alert>
          ) : null}
          <Card className="overflow-visible">
            <h5 className="h6 fw-semibold mb-3">ข้อมูลหลัก</h5>
            <div className="row g-3">
              <div className="col-md-6">
                <Label htmlFor="orderType" required>
                  ประเภทเอกสาร
                </Label>
                <select
                  id="orderType"
                  className="form-select"
                  value={formData.orderType || 'quotation'}
                  onChange={(e) => setFormData((prev) => ({ ...prev, orderType: e.target.value as SalesOrderType }))}
                >
                  <option value="quotation">ใบเสนอราคา</option>
                  <option value="sale">Sale Order</option>
                </select>
              </div>

              <div className="col-md-6">
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

              <div className="col-md-6">
                <Label htmlFor="partnerSearch" required>
                  ลูกค้า
                </Label>
                <Combobox
                  id="partnerSearch"
                  value={partnerSearch}
                  onChange={setPartnerSearch}
                  placeholder="พิมพ์เพื่อค้นหาลูกค้า (ชื่อ / VAT / อีเมล)"
                  minChars={1}
                  menuZIndex={5000}
                  isLoading={partnerOptionsQuery.isFetching || selectedPartnerQuery.isFetching}
                  isLoadingMore={partnerOptionsQuery.isFetchingNextPage}
                  onLoadMore={() => {
                    if (partnerOptionsQuery.hasNextPage) partnerOptionsQuery.fetchNextPage()
                  }}
                  options={partnerItems.map<ComboboxOption>((p) => ({
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
                    setFormData((prev) => ({ ...prev, partnerId: Number(opt.id) }))
                    setPartnerSearch(opt.label)
                  }}
                />
                {selectedPartnerQuery.data ? (
                  <div className="small text-muted mt-2">
                    เลือกแล้ว: <span className="fw-semibold">{selectedPartnerQuery.data.displayName}</span> (ID: {formData.partnerId})
                    <div className="d-flex gap-2 mt-2">
                      <Button size="sm" variant="ghost" type="button" onClick={() => navigate(`/customers/${formData.partnerId}`)}>
                        เปิดรายละเอียดลูกค้า
                      </Button>
                      <Button size="sm" variant="ghost" type="button" onClick={() => navigate(`/customers/${formData.partnerId}/edit`)}>
                        แก้ไขลูกค้า
                      </Button>
                      <Button size="sm" variant="ghost" type="button" onClick={() => setQuickPartnerOpen(true)}>
                        + ผู้ติดต่อใหม่
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2">
                    <Button size="sm" variant="ghost" type="button" onClick={() => setQuickPartnerOpen(true)}>
                      + สร้างผู้ติดต่อใหม่จากฟอร์มนี้
                    </Button>
                  </div>
                )}
                {fieldErrors?.partnerId ? <small className="text-danger">{fieldErrors.partnerId}</small> : null}
              </div>

              <div className="col-md-3">
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

              <div className="col-md-3">
                <Label htmlFor="validityDate">วันหมดอายุ</Label>
                <Input
                  id="validityDate"
                  type="date"
                  value={formData.validityDate || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, validityDate: e.target.value || undefined }))}
                />
              </div>
            </div>
          </Card>

          <Card className="mt-4 p-0 qf-so-lines-card">
            <div className="d-flex flex-column flex-sm-row align-items-sm-center justify-content-sm-between px-4 py-3 border-bottom gap-2 qf-so-list-header">
              <h5 className="h6 fw-semibold mb-0">รายการสินค้า</h5>
              <Button size="sm" onClick={addLine} className="qf-so-list-add-btn">
                + เพิ่มรายการ
              </Button>
            </div>

            <div className="p-3 p-sm-4">
              {formData.lines.length === 0 ? (
                <div className="text-center text-muted py-4 rounded-3 border bg-white">
                  ยังไม่มีรายการสินค้า กด “+ เพิ่มรายการ” เพื่อเริ่มต้น
                </div>
              ) : (
                <div className="qf-so-lines">
                  {formData.lines.map((line, idx) => (
                    <div key={idx} className="qf-so-line">
                      <div className="qf-so-line__head">
                        <span className="qf-so-line__index">รายการที่ {idx + 1}</span>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger qf-so-line__delete-btn"
                          onClick={() => removeLine(idx)}
                          title="ลบรายการ"
                        >
                          ลบรายการ
                        </button>
                      </div>

                      <div className="qf-so-line__main">
                        <div className="qf-so-line__field qf-so-line__field--product">
                          <Label htmlFor={`so-product-${idx}`}>สินค้า/บริการ</Label>
                          <ProductCombobox
                            id={`so-product-${idx}`}
                            valueId={line.productId ?? null}
                            onPick={(product) => {
                              const productTaxIds = Array.isArray(product.taxes)
                                ? product.taxes.map((t) => Number(t.id)).filter((n) => Number.isFinite(n) && n > 0)
                                : []
                              updateLine(idx, {
                                productId: product.id,
                                description: (line.description || '').trim() ? line.description : product.name,
                                unitPrice: typeof product.listPrice === 'number' ? product.listPrice : line.unitPrice,
                                taxIds: productTaxIds.length > 0 ? productTaxIds : defaultSaleTaxId ? [defaultSaleTaxId] : [],
                              })
                            }}
                          />
                        </div>

                        <div className="qf-so-line__field qf-so-line__field--description">
                          <Label htmlFor={`so-description-${idx}`}>รายละเอียด</Label>
                          <Input
                            id={`so-description-${idx}`}
                            value={line.description}
                            onChange={(e) => updateLine(idx, { description: e.target.value })}
                            placeholder="ชื่อสินค้า / รายละเอียด"
                          />
                        </div>
                      </div>

                      <div className="qf-so-line__tax-row">
                        <div className="qf-so-line__field qf-so-line__field--tax">
                          <Label htmlFor={`so-tax-${idx}`}>VAT/ภาษี</Label>
                          <select
                            id={`so-tax-${idx}`}
                            className="form-select"
                            value={line.taxIds?.[0] ?? ''}
                            onChange={(e) => {
                              const taxId = e.target.value ? Number(e.target.value) : null
                              updateLine(idx, { taxIds: taxId ? [taxId] : [] })
                            }}
                          >
                            <option value="">ไม่กำหนดภาษี</option>
                            {saleTaxOptions.map((tax) => (
                              <option key={`so-tax-option-${tax.id}`} value={tax.id}>
                                {tax.name} ({Number(tax.amount || 0)}%)
                              </option>
                            ))}
                          </select>
                          {salesTaxesQuery.isLoading ? (
                            <div className="small text-muted mt-1">กำลังโหลดรายการ VAT...</div>
                          ) : null}
                          {!salesTaxesQuery.isLoading && saleTaxOptions.length === 0 ? (
                            <div className="small text-danger mt-1">ไม่พบรายการ VAT จากระบบ กรุณาตรวจสอบการตั้งค่า taxes</div>
                          ) : null}
                        </div>
                      </div>

                      <div className="qf-so-line__meta">
                        <div className="qf-so-line__field qf-so-line__field--qty">
                          <Label htmlFor={`so-qty-${idx}`}>จำนวน</Label>
                          <Input
                            id={`so-qty-${idx}`}
                            type="number"
                            className="text-end"
                            value={toNumberLike(line.quantity)}
                            onChange={(e) => updateLine(idx, { quantity: toNumberLike(e.target.value) })}
                            onBlur={(e) => updateLine(idx, { quantity: toNumberLike(e.target.value) })}
                            min="0"
                            step="0.01"
                          />
                        </div>

                        <div className="qf-so-line__field qf-so-line__field--price">
                          <Label htmlFor={`so-price-${idx}`}>ราคาต่อหน่วย</Label>
                          <Input
                            id={`so-price-${idx}`}
                            type="number"
                            className="text-end"
                            value={toNumberLike(line.unitPrice)}
                            onChange={(e) => updateLine(idx, { unitPrice: toNumberLike(e.target.value) })}
                            onBlur={(e) => updateLine(idx, { unitPrice: toNumberLike(e.target.value) })}
                            min="0"
                            step="0.01"
                          />
                        </div>

                        <div className="qf-so-line__field qf-so-line__field--discount">
                          <Label htmlFor={`so-discount-${idx}`}>ส่วนลด %</Label>
                          <Input
                            id={`so-discount-${idx}`}
                            type="number"
                            className="text-end"
                            value={toNumberLike(line.discount)}
                            onChange={(e) => updateLine(idx, { discount: toNumberLike(e.target.value) })}
                            onBlur={(e) => updateLine(idx, { discount: toNumberLike(e.target.value) })}
                            min="0"
                            max="100"
                            step="0.01"
                          />
                        </div>

                        <div className="qf-so-line__field qf-so-line__field--line-total">
                          <Label htmlFor={`so-vat-amount-${idx}`}>จำนวน VAT</Label>
                          <div id={`so-vat-amount-${idx}`} className="qf-so-line__total-box">
                            {line.totalTax.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </div>

                        <div className="qf-so-line__field qf-so-line__field--line-total">
                          <Label htmlFor={`so-total-${idx}`}>ยอดรวมรายการ</Label>
                          <div id={`so-total-${idx}`} className="qf-so-line__total-box">
                            {line.total.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="col-lg-4">
          <Card>
            <h5 className="h6 fw-semibold mb-3">สรุปเอกสาร</h5>
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="text-muted">จำนวนรายการ</span>
              <span className="fw-semibold">{formData.lines.length}</span>
            </div>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <span className="text-muted">ยอดรวม</span>
              <span className="h5 fw-bold mb-0 font-monospace">
                {totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <span className="text-muted">VAT รวม</span>
              <span className="fw-semibold font-monospace">
                {totalTaxAmount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <Label htmlFor="notes">หมายเหตุ</Label>
            <textarea
              id="notes"
              className="form-control"
              rows={4}
              value={formData.notes || ''}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="เพิ่มหมายเหตุสำหรับลูกค้า"
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

            <div className="small text-muted mt-3">
              หาก backend ยังไม่รองรับ endpoint <code>/sales/orders</code> ระบบจะแจ้ง error เพื่อให้ตรวจสอบโมดูล <code>adt_th_api</code>
            </div>
          </Card>
        </div>
      </div>

    </form>
    <Modal show={quickPartnerOpen} onHide={() => setQuickPartnerOpen(false)} centered>
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
          {isQuickPartnerThai ? (
            <>
              <div className="col-md-6">
                <ThaiProvinceSelector
                  value={quickPartner.provinceId}
                  onChange={(value) => {
                    handleQuickPartnerProvinceChange(value).catch(() => {
                      setQuickPartner((prev) => ({ ...prev, provinceId: value }))
                    })
                  }}
                />
              </div>
              <div className="col-md-6">
                <ThaiDistrictSelector
                  provinceId={quickPartner.provinceId}
                  value={quickPartner.districtId}
                  onChange={(value) => {
                    handleQuickPartnerDistrictChange(value).catch(() => {
                      setQuickPartner((prev) => ({ ...prev, districtId: value }))
                    })
                  }}
                />
              </div>
              <div className="col-md-6">
                <ThaiSubDistrictSelector
                  provinceId={quickPartner.provinceId}
                  districtId={quickPartner.districtId}
                  value={quickPartner.subDistrictId}
                  onChange={(value) => {
                    handleQuickPartnerSubDistrictChange(value).catch(() => {
                      setQuickPartner((prev) => ({ ...prev, subDistrictId: value }))
                    })
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

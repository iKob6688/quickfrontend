import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import {
  getPurchaseOrder,
  createPurchaseOrder,
  updatePurchaseOrder,
  type PurchaseOrderPayload,
  type PurchaseOrderLine,
} from '@/api/services/purchases.service'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Alert, Modal, Spinner, Card as BootstrapCard } from 'react-bootstrap'
import { useEffect, useState, useMemo } from 'react'
import { extractFieldErrors, type FieldErrors } from '@/lib/formErrors'
import { clearDraft, loadDraft, loadRecentNotes, pushRecentNote, saveDraft } from '@/lib/formDrafts'
import { toast } from '@/lib/toastStore'
import { createPartner, listPartners, getPartner, type PartnerUpsertPayload } from '@/api/services/partners.service'
import { listTaxes, type TaxListItem } from '@/api/services/taxes.service'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import { Combobox, type ComboboxOption } from '@/components/ui/Combobox'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { ProductCombobox } from '@/features/sales/ProductCombobox'
import { CountrySelector } from '@/features/customers/CountrySelector'
import { StateSelector } from '@/features/customers/StateSelector'
import { normalizeVatNumber, sanitizeVatNumber, thaiVatValidationMessage } from '@/lib/vat'

const PURCHASE_ORDER_DRAFT_KEY = 'qf:draft:purchase-order-form:create:v1'
const PURCHASE_ORDER_RECENT_NOTES_KEY = 'qf:recent-notes:purchase-order:v1'

function roundAmount(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function computeLineTotals(
  line: PurchaseOrderLine,
  taxById: Map<number, TaxListItem>,
): PurchaseOrderLine {
  const quantity = Number.isFinite(line.quantity) ? Number(line.quantity) : 0
  const unitPrice = Number.isFinite(line.unitPrice) ? Number(line.unitPrice) : 0
  const subtotal = roundAmount(quantity * unitPrice)
  const applicableTaxes = (line.taxIds || [])
    .map((id) => taxById.get(id))
    .filter((tax): tax is TaxListItem => !!tax)
  const totalTax = roundAmount(
    applicableTaxes.reduce((sum, tax) => {
      if (tax.type === 'percent') return sum + subtotal * (Number(tax.amount || 0) / 100)
      if (tax.type === 'fixed') return sum + Number(tax.amount || 0)
      return sum
    }, 0),
  )

  return {
    ...line,
    quantity,
    unitPrice,
    subtotal,
    totalTax,
    total: roundAmount(subtotal + totalTax),
  }
}

export function PurchaseOrderFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const isEdit = !!id
  const orderId = id ? Number.parseInt(id, 10) : null
  const thailandId = Number(import.meta.env.VITE_COUNTRY_TH_ID || 219)
  const vendorIdFromQuery = searchParams.get('vendorId')
  const partnerIdFromQuery = searchParams.get('partnerId')
  const vendorIdPrefill = vendorIdFromQuery
    ? Number(vendorIdFromQuery)
    : partnerIdFromQuery
      ? Number(partnerIdFromQuery)
      : null

  const {
    data: existingOrder,
    isLoading: isLoadingOrder,
  } = useQuery({
    queryKey: ['purchaseOrder', orderId],
    queryFn: () => getPurchaseOrder(orderId!),
    enabled: isEdit && !!orderId,
  })

  const [formData, setFormData] = useState<PurchaseOrderPayload>(() => ({
    vendorId:
      !isEdit && vendorIdPrefill && Number.isFinite(vendorIdPrefill) && vendorIdPrefill > 0
        ? vendorIdPrefill
        : 0,
    orderDate: new Date().toISOString().split('T')[0],
    currency: 'THB',
    lines: [],
    notes: '',
  }))

  const [vendorSearch, setVendorSearch] = useState('')
  const [quickVendorOpen, setQuickVendorOpen] = useState(false)
  const [quickVendorSaving, setQuickVendorSaving] = useState(false)
  const [quickVendor, setQuickVendor] = useState<PartnerUpsertPayload>({
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
    vatPriceMode: 'vat_excluded',
    branchCode: 'สำนักงานใหญ่',
    active: true,
  })
  const debouncedVendorSearch = useDebouncedValue(vendorSearch, 250)
  const vendorLimit = 20

  const vendorOptionsQuery = useInfiniteQuery({
    queryKey: ['partner-selector', debouncedVendorSearch],
    enabled: debouncedVendorSearch.trim().length >= 0,
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      listPartners({
        q: debouncedVendorSearch || undefined,
        active: true,
        limit: vendorLimit,
        offset: pageParam,
      }),
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((acc, p) => acc + (p?.items?.length ?? 0), 0)
      if (loaded >= (lastPage?.total ?? 0)) return undefined
      if ((lastPage?.items?.length ?? 0) < vendorLimit) return undefined
      return loaded
    },
    staleTime: 30_000,
  })

  const vendorItems = useMemo(
    () => {
      const allItems = vendorOptionsQuery.data?.pages.flatMap((p) => p?.items ?? []) ?? []
      // Filter out any undefined/null items and ensure they have id
      return allItems.filter((item): item is NonNullable<typeof item> => 
        item != null && typeof item === 'object' && 'id' in item && typeof item.id === 'number'
      )
    },
    [vendorOptionsQuery.data?.pages],
  )
  const vendorTotal = vendorOptionsQuery.data?.pages[0]?.total

  const selectedVendorQuery = useQuery({
    queryKey: ['partner', formData.vendorId],
    enabled: formData.vendorId > 0, // Enable for both create and edit modes
    queryFn: () => getPartner(formData.vendorId),
    staleTime: 30_000,
  })

  const purchaseTaxesQuery = useQuery({
    queryKey: ['taxes', 'purchase-order', 'purchase'],
    queryFn: () => listTaxes({ type: 'purchase', active: true, includeVat: false, limit: 200 }),
    staleTime: 60_000,
  })

  const purchaseTaxes = purchaseTaxesQuery.data ?? []
  const purchaseTaxById = useMemo(
    () => new Map<number, TaxListItem>(purchaseTaxes.map((tax) => [tax.id, tax])),
    [purchaseTaxes],
  )

  // Hydrate form when editing order is loaded
  useEffect(() => {
    if (!isEdit || !existingOrder) return
    const timer = window.setTimeout(() => {
      setFormData({
        vendorId: existingOrder.vendorId || 0,
        orderDate: existingOrder.orderDate ? existingOrder.orderDate.split('T')[0] : new Date().toISOString().split('T')[0],
        expectedDate: existingOrder.expectedDate ? existingOrder.expectedDate.split('T')[0] : undefined,
        currency: existingOrder.currency || 'THB',
        lines: (existingOrder.lines || []).map((line) => computeLineTotals(line, purchaseTaxById)),
        notes: existingOrder.notes || '',
      })

      // Prefill vendor search text with vendor name for display in edit mode
      // This allows user to see the current vendor and optionally change it
      if (existingOrder.vendorName) {
        setVendorSearch(existingOrder.vendorName)
      }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [isEdit, existingOrder, purchaseTaxById])

  // Update vendor search text when selected vendor details are loaded (fallback if vendorName was not in existingOrder)
  useEffect(() => {
    if (isEdit && selectedVendorQuery.data && existingOrder) {
      const vendorName = selectedVendorQuery.data.displayName || selectedVendorQuery.data.name
      // Only update if vendorSearch is empty (not set by existingOrder.vendorName)
      if (!vendorSearch && vendorName) {
        const timer = window.setTimeout(() => setVendorSearch(vendorName), 0)
        return () => window.clearTimeout(timer)
      }
    }
    return undefined
  }, [isEdit, selectedVendorQuery.data, existingOrder, vendorSearch])

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [recentNotes, setRecentNotes] = useState<string[]>([])
  const [draftPendingRestore, setDraftPendingRestore] = useState<PurchaseOrderPayload | null>(null)
  const [draftUpdatedAt, setDraftUpdatedAt] = useState<string | null>(null)
  const [draftGateResolved, setDraftGateResolved] = useState(false)
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null)

  useEffect(() => {
    setRecentNotes(loadRecentNotes(PURCHASE_ORDER_RECENT_NOTES_KEY))
  }, [])

  useEffect(() => {
    if (isEdit) {
      setDraftGateResolved(true)
      return
    }
    const saved = loadDraft<PurchaseOrderPayload>(PURCHASE_ORDER_DRAFT_KEY)
    if (saved?.data) {
      setDraftPendingRestore(saved.data)
      setDraftUpdatedAt(saved.updatedAt || null)
    }
    setDraftGateResolved(true)
  }, [isEdit])

  useEffect(() => {
    if (isEdit) return
    if (!draftGateResolved) return
    if (draftPendingRestore) return
    const timer = window.setTimeout(() => {
      saveDraft(PURCHASE_ORDER_DRAFT_KEY, formData)
      setDraftSavedAt(new Date().toISOString())
    }, 700)
    return () => window.clearTimeout(timer)
  }, [isEdit, draftGateResolved, draftPendingRestore, formData])

  const createMutation = useMutation({
    mutationFn: (payload: PurchaseOrderPayload) => createPurchaseOrder(payload),
    onSuccess: (data) => {
      clearDraft(PURCHASE_ORDER_DRAFT_KEY)
      if ((formData.notes || '').trim()) {
        pushRecentNote(PURCHASE_ORDER_RECENT_NOTES_KEY, formData.notes || '')
        setRecentNotes(loadRecentNotes(PURCHASE_ORDER_RECENT_NOTES_KEY))
      }
      queryClient.setQueryData(['purchaseOrder', data.id], data)
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] })
      toast.success('สร้างใบสั่งซื้อสำเร็จ')
      navigate(`/purchases/orders/${data.id}`)
    },
    onError: (err: unknown) => {
      const errors = extractFieldErrors(err)
      setFieldErrors(errors || {})
      toast.error('สร้างใบสั่งซื้อไม่สำเร็จ', err instanceof Error ? err.message : undefined)
    },
  })

  const updateMutation = useMutation({
    mutationFn: (payload: PurchaseOrderPayload) => updatePurchaseOrder(orderId!, payload),
    onSuccess: (data) => {
      if ((formData.notes || '').trim()) {
        pushRecentNote(PURCHASE_ORDER_RECENT_NOTES_KEY, formData.notes || '')
        setRecentNotes(loadRecentNotes(PURCHASE_ORDER_RECENT_NOTES_KEY))
      }
      queryClient.setQueryData(['purchaseOrder', orderId], data)
      queryClient.invalidateQueries({ queryKey: ['purchaseOrder', orderId] })
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] })
      toast.success('อัปเดตใบสั่งซื้อสำเร็จ')
      navigate(`/purchases/orders/${orderId}`)
    },
    onError: (err: unknown) => {
      const errors = extractFieldErrors(err)
      setFieldErrors(errors || {})
      toast.error('อัปเดตใบสั่งซื้อไม่สำเร็จ', err instanceof Error ? err.message : undefined)
    },
  })

  const resetQuickVendor = () =>
    setQuickVendor({
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
      vatPriceMode: 'vat_excluded',
      branchCode: 'สำนักงานใหญ่',
      active: true,
    })

  const submitQuickVendor = async () => {
    if (!quickVendor.name?.trim()) {
      toast.error('กรุณากรอกชื่อผู้ขาย')
      return
    }

    const vatError = thaiVatValidationMessage(quickVendor.vat)
    if (vatError) {
      toast.error(vatError)
      return
    }

    try {
      setQuickVendorSaving(true)
      const created = await createPartner({
        ...quickVendor,
        name: quickVendor.name.trim(),
        email: quickVendor.email?.trim() || undefined,
        phone: quickVendor.phone?.trim() || undefined,
        vat: normalizeVatNumber(quickVendor.vat),
        street: quickVendor.street?.trim() || undefined,
        district: quickVendor.district?.trim() || undefined,
        subDistrict: quickVendor.subDistrict?.trim() || undefined,
        zip: quickVendor.zip?.trim() || undefined,
        stateId: quickVendor.stateId ?? undefined,
      })
      await queryClient.invalidateQueries({ queryKey: ['partner-selector'] })
      await queryClient.invalidateQueries({ queryKey: ['partners'] })
      await queryClient.invalidateQueries({ queryKey: ['partner', created.id] })
      setFormData((prev) => ({ ...prev, vendorId: created.id }))
      setVendorSearch(created.displayName || created.name)
      setQuickVendorOpen(false)
      resetQuickVendor()
      toast.success('สร้างผู้ขายใหม่สำเร็จ')
    } catch (err) {
      toast.error('สร้างผู้ขายไม่สำเร็จ', err instanceof Error ? err.message : undefined)
    } finally {
      setQuickVendorSaving(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFieldErrors({})

    if (formData.vendorId <= 0) {
      setFieldErrors({ vendorId: 'กรุณาเลือกผู้ขาย' })
      toast.error('กรุณาเลือกผู้ขาย')
      return
    }

    if (formData.lines.length === 0) {
      toast.error('กรุณาเพิ่มรายการสินค้า')
      return
    }

    if (isEdit) {
      updateMutation.mutate(formData)
    } else {
      createMutation.mutate(formData)
    }
  }

  const addLine = () => {
    setFormData((prev) => ({
      ...prev,
      lines: [
        ...(prev.lines || []),
        {
          productId: null,
          description: '',
          quantity: 1,
          unitPrice: 0,
          taxIds: [],
          subtotal: 0,
          totalTax: 0,
          total: 0,
        },
      ],
    }))
  }

  const removeLine = (index: number) => {
    const ok = window.confirm('ยืนยันการลบรายการนี้?')
    if (!ok) return
    setFormData((prev) => ({
      ...prev,
      lines: (prev.lines || []).filter((_, i) => i !== index),
    }))
  }

  const updateLine = (index: number, updates: Partial<PurchaseOrderLine>) => {
    setFormData((prev) => {
      const currentLines = prev.lines || []
      const newLines = [...currentLines]
      if (index >= 0 && index < newLines.length) {
        newLines[index] = computeLineTotals({ ...newLines[index], ...updates }, purchaseTaxById)
      }
      return { ...prev, lines: newLines }
    })
  }

  const lineRows = (formData.lines || []).map((line, idx) => ({
    id: idx,
    ...line,
  }))

  const lineColumns: Column<(typeof lineRows)[number]>[] = [
    {
      key: 'product',
      header: 'สินค้า/บริการ',
      className: 'qf-so-col-product',
      cell: (r) => (
        <ProductCombobox
          id={`po-product-${r.id}`}
          valueId={r.productId ?? null}
          onPick={(product) =>
            updateLine(r.id, {
              productId: product.id,
              description: (r.description || '').trim() ? r.description : product.name,
              unitPrice: typeof product.listPrice === 'number' ? product.listPrice : r.unitPrice,
            })
          }
        />
      ),
    },
    {
      key: 'description',
      header: 'รายละเอียด',
      className: 'qf-so-col-description',
      cell: (r) => (
        <input
          type="text"
          className="form-control form-control-sm"
          value={r.description}
          onChange={(e) => updateLine(r.id, { description: e.target.value })}
          placeholder="ชื่อสินค้า / รายละเอียด"
        />
      ),
    },
    {
      key: 'quantity',
      header: 'จำนวน',
      className: 'text-end qf-so-col-qty',
      cell: (r) => (
        <input
          type="number"
          className="form-control form-control-sm text-end"
          value={r.quantity}
          onChange={(e) => updateLine(r.id, { quantity: parseFloat(e.target.value) || 0 })}
          min="0"
          step="0.01"
        />
      ),
    },
    {
      key: 'unitPrice',
      header: 'ราคาต่อหน่วย',
      className: 'text-end qf-so-col-price',
      cell: (r) => (
        <input
          type="number"
          className="form-control form-control-sm text-end"
          value={r.unitPrice}
          onChange={(e) => updateLine(r.id, { unitPrice: parseFloat(e.target.value) || 0 })}
          min="0"
          step="0.01"
        />
      ),
    },
    {
      key: 'taxes',
      header: 'VAT/ภาษี',
      className: 'qf-so-col-tax',
      cell: (r) => (
        <select
          className="form-select form-select-sm"
          multiple
          value={(r.taxIds || []).map(String)}
          onChange={(e) =>
            updateLine(
              r.id,
              {
                taxIds: Array.from(e.target.selectedOptions)
                  .map((option) => Number(option.value))
                  .filter((value) => Number.isFinite(value) && value > 0),
              },
            )
          }
          title="เลือกภาษีจาก backend"
        >
          {purchaseTaxes.map((tax) => (
            <option key={tax.id} value={tax.id}>
              {tax.name} ({Number(tax.amount || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 })}%)
            </option>
          ))}
        </select>
      ),
    },
    {
      key: 'total',
      header: 'ยอดรวม',
      className: 'text-end qf-so-col-total',
      cell: (r) => (
        <span className="font-monospace">
          {r.total.toLocaleString('th-TH', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-end qf-so-col-action',
      cell: (r) => (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => removeLine(r.id)}
          className="text-danger-emphasis"
        >
          <i className="bi bi-trash me-1"></i>
          ลบ
        </Button>
      ),
    },
  ]

  const totalUntaxed = (formData.lines || []).reduce((sum, line) => sum + (line.subtotal || 0), 0)
  const totalTaxAmount = (formData.lines || []).reduce((sum, line) => sum + (line.totalTax || 0), 0)
  const totalAmount = roundAmount(totalUntaxed + totalTaxAmount)
  const applyRecentNote = (note: string) => setFormData((prev) => ({ ...prev, notes: note }))
  const appendRecentNote = (note: string) =>
    setFormData((prev) => ({ ...prev, notes: (prev.notes || '').trim() ? `${prev.notes}\n${note}` : note }))

  if (isEdit && isLoadingOrder) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
        <Spinner animation="border" role="status">
          <span className="visually-hidden">กำลังโหลด...</span>
        </Spinner>
      </div>
    )
  }

  return (
    <>
    <form onSubmit={handleSubmit}>
      <PageHeader
        title={isEdit ? 'แก้ไขใบสั่งซื้อ' : 'สร้างใบสั่งซื้อ'}
        subtitle={isEdit && existingOrder ? existingOrder.number || `ใบสั่งซื้อ #${existingOrder.id}` : ''}
        breadcrumb="รายจ่าย · ใบสั่งซื้อ"
        actions={
          <div className="d-flex align-items-center gap-2">
            {!isEdit && draftSavedAt ? (
              <span className="small text-muted">
                autosaved {new Date(draftSavedAt).toLocaleTimeString('th-TH')}
              </span>
            ) : null}
            <Button
              size="sm"
              variant="secondary"
              type="button"
              onClick={() => navigate('/purchases/orders')}
            >
              ยกเลิก
            </Button>
            <Button
              size="sm"
              variant="primary"
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'กำลังบันทึก...'
                : isEdit
                  ? 'บันทึกการแก้ไข'
                  : 'สร้างใบสั่งซื้อ'}
            </Button>
          </div>
        }
      />

      {!isEdit && draftPendingRestore ? (
        <div className="alert alert-warning small">
          <div className="fw-semibold mb-1">พบ draft ใบสั่งซื้อที่บันทึกไว้</div>
          <div className="mb-2">
            เวลา: {draftUpdatedAt ? new Date(draftUpdatedAt).toLocaleString('th-TH') : 'ไม่ทราบเวลา'}
          </div>
          <div className="d-flex gap-2">
            <Button
              size="sm"
              type="button"
              onClick={() => {
                setFormData(draftPendingRestore)
                setDraftPendingRestore(null)
              }}
            >
              กู้ draft
            </Button>
            <Button
              size="sm"
              variant="secondary"
              type="button"
              onClick={() => {
                clearDraft(PURCHASE_ORDER_DRAFT_KEY)
                setDraftPendingRestore(null)
              }}
            >
              ลบ draft
            </Button>
          </div>
        </div>
      ) : null}

      <div className="row g-3 mb-4">
        <div className="col-md-8">
          <BootstrapCard>
            <BootstrapCard.Header>
              <h5 className="mb-0">ข้อมูลใบสั่งซื้อ</h5>
            </BootstrapCard.Header>
            <BootstrapCard.Body>
              <div className="row g-3">
                <div className="col-md-6">
                  <Label htmlFor="vendorId" required>
                    ผู้ขาย
                  </Label>
                  <Combobox
                    id="vendorSearch"
                    value={vendorSearch}
                    onChange={setVendorSearch}
                    placeholder="พิมพ์เพื่อค้นหาผู้ขาย (ชื่อ / VAT / อีเมล)"
                    leftAdornment={<i className="bi bi-search"></i>}
                    minChars={1}
                    isLoading={vendorOptionsQuery.isFetching || selectedVendorQuery.isFetching}
                    isLoadingMore={vendorOptionsQuery.isFetchingNextPage}
                    onLoadMore={() => {
                      if (vendorOptionsQuery.hasNextPage) vendorOptionsQuery.fetchNextPage()
                    }}
                    options={vendorItems
                      .filter((p) => p && typeof p === 'object' && 'id' in p && 'name' in p)
                      .map<ComboboxOption>((p) => ({
                        id: p.id,
                        label: p.name || `Partner #${p.id}`,
                        meta:
                          [
                            p.vat ? `VAT: ${p.vat}` : '',
                            p.stateName || '',
                            !p.vat && !p.stateName ? p.email || `ID: ${p.id}` : '',
                          ]
                            .filter(Boolean)
                            .join(' • '),
                      }))}
                    total={vendorTotal}
                    emptyText="ไม่พบผู้ขาย (ลองพิมพ์คำอื่น)"
                    onPick={(opt) => {
                      setFormData((prev) => ({ ...prev, vendorId: Number(opt.id) }))
                      setVendorSearch(opt.label)
                    }}
                  />
                  <div className="small text-muted mt-2">
                    Tip: พิมพ์อย่างน้อย 1 ตัวอักษรเพื่อค้นหา • ใช้ ↑/↓ และ Enter เพื่อเลือก • Esc เพื่อปิด
                  </div>
                  <div className="d-flex gap-2 mt-2">
                    <Button size="sm" variant="ghost" type="button" onClick={() => setQuickVendorOpen(true)}>
                      + สร้างผู้ขายใหม่
                    </Button>
                  </div>

                  {selectedVendorQuery.data ? (
                    <div className="small text-muted mt-2">
                      เลือกแล้ว:{' '}
                      <span className="fw-semibold">
                        {selectedVendorQuery.data.displayName || selectedVendorQuery.data.name}
                      </span>{' '}
                      (ID: {formData.vendorId})
                      <div className="d-flex gap-2 mt-2">
                        <Button size="sm" variant="ghost" type="button" onClick={() => navigate(`/customers/${formData.vendorId}`)}>
                          เปิดรายละเอียดผู้ขาย
                        </Button>
                        <Button size="sm" variant="ghost" type="button" onClick={() => navigate(`/customers/${formData.vendorId}/edit`)}>
                          แก้ไขผู้ขาย
                        </Button>
                      </div>
                    </div>
                  ) : isEdit && existingOrder?.vendorName ? (
                    <div className="small text-muted mt-2">
                      ผู้ขาย:{' '}
                      <span className="fw-semibold">
                        {existingOrder.vendorName}
                      </span>{' '}
                      (ID: {formData.vendorId})
                    </div>
                  ) : null}

                  {vendorOptionsQuery.isError ? (
                    <div className="small text-danger mt-2">
                      {vendorOptionsQuery.error instanceof Error
                        ? vendorOptionsQuery.error.message
                        : 'โหลดรายชื่อผู้ขายไม่สำเร็จ'}
                    </div>
                  ) : null}
                  {fieldErrors.vendorId && (
                    <div className="text-danger small mt-1">{fieldErrors.vendorId}</div>
                  )}
                </div>
                <div className="col-md-3">
                  <Label htmlFor="orderDate" required>
                    วันที่สั่งซื้อ
                  </Label>
                  <Input
                    id="orderDate"
                    type="date"
                    value={formData.orderDate}
                    onChange={(e) => setFormData((prev) => ({ ...prev, orderDate: e.target.value }))}
                    error={!!fieldErrors.orderDate}
                  />
                </div>
                <div className="col-md-3">
                  <Label htmlFor="expectedDate">วันที่ส่งมอบ</Label>
                  <Input
                    id="expectedDate"
                    type="date"
                    value={formData.expectedDate || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, expectedDate: e.target.value || undefined }))
                    }
                  />
                </div>
                <div className="col-md-6">
                  <Label htmlFor="currency">สกุลเงิน</Label>
                  <Input
                    id="currency"
                    value={formData.currency}
                    onChange={(e) => setFormData((prev) => ({ ...prev, currency: e.target.value }))}
                    placeholder="THB"
                  />
                </div>
                <div className="col-12">
                  <Label htmlFor="notes">หมายเหตุ</Label>
                  <textarea
                    id="notes"
                    className="form-control"
                    rows={3}
                    value={formData.notes || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder="หมายเหตุเพิ่มเติม..."
                  />
                  {recentNotes.length > 0 ? (
                    <div className="mt-2">
                      <div className="small text-muted mb-1">หมายเหตุล่าสุด</div>
                      <div className="d-flex flex-wrap gap-2">
                        {recentNotes.slice(0, 4).map((note, idx) => (
                          <div key={`${idx}-${note}`} className="d-inline-flex align-items-center gap-1">
                            <Button size="sm" variant="secondary" type="button" onClick={() => applyRecentNote(note)}>
                              ใช้ล่าสุด
                            </Button>
                            <Button size="sm" variant="ghost" type="button" onClick={() => appendRecentNote(note)} title={note}>
                              +
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </BootstrapCard.Body>
          </BootstrapCard>

          <BootstrapCard className="mt-3">
            <BootstrapCard.Header className="d-flex justify-content-between align-items-center">
              <h5 className="mb-0">รายการสินค้า</h5>
              <Button size="sm" variant="primary" type="button" onClick={addLine}>
                <i className="bi bi-plus me-1"></i>
                เพิ่มรายการ
              </Button>
            </BootstrapCard.Header>
            <BootstrapCard.Body>
              {(formData.lines || []).length === 0 ? (
                <div className="text-center text-muted py-4">
                  <p>ยังไม่มีรายการสินค้า</p>
                  <Button size="sm" variant="secondary" onClick={addLine}>
                    เพิ่มรายการแรก
                  </Button>
                </div>
              ) : (
                <DataTable allowMenuOverflow columns={lineColumns} rows={lineRows} />
              )}
            </BootstrapCard.Body>
          </BootstrapCard>
        </div>

        <div className="col-md-4">
          <BootstrapCard>
            <BootstrapCard.Header>
              <h5 className="mb-0">สรุปยอด</h5>
            </BootstrapCard.Header>
            <BootstrapCard.Body>
              {purchaseTaxesQuery.isError ? (
                <div className="alert alert-warning small py-2">
                  โหลดรายการภาษีจาก backend ไม่สำเร็จ ระบบจะแสดงยอดประมาณการจากรายการปัจจุบันเท่านั้น
                </div>
              ) : null}
              <div className="d-flex justify-content-between">
                <span className="text-muted">ก่อนภาษี</span>
                <span className="font-monospace">
                  {totalUntaxed.toLocaleString('th-TH', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{' '}
                  {formData.currency}
                </span>
              </div>
              <div className="d-flex justify-content-between mt-2">
                <span className="text-muted">ภาษี</span>
                <span className="font-monospace">
                  {totalTaxAmount.toLocaleString('th-TH', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{' '}
                  {formData.currency}
                </span>
              </div>
              <hr />
              <div className="d-flex justify-content-between">
                <span className="fw-semibold">ยอดรวมทั้งสิ้น</span>
                <span className="fw-semibold font-monospace">
                  {totalAmount.toLocaleString('th-TH', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{' '}
                  {formData.currency}
                </span>
              </div>
            </BootstrapCard.Body>
          </BootstrapCard>

          <BootstrapCard className="mt-3">
            <BootstrapCard.Body className="d-grid gap-2">
              <Button
                variant="primary"
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending
                  ? 'กำลังบันทึก...'
                  : isEdit
                    ? 'บันทึกการแก้ไข'
                    : 'สร้างใบสั่งซื้อ'}
              </Button>
              <Button
                variant="secondary"
                type="button"
                onClick={() => navigate('/purchases/orders')}
              >
                ยกเลิก
              </Button>
            </BootstrapCard.Body>
          </BootstrapCard>
        </div>
      </div>
    </form>
    <Modal show={quickVendorOpen} onHide={() => setQuickVendorOpen(false)} centered>
      <Modal.Header closeButton>
        <Modal.Title>สร้างผู้ขายใหม่ (Quick Create)</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="row g-3">
          <div className="col-12">
            <Label htmlFor="quick-vendor-name" required>
              ชื่อผู้ขาย
            </Label>
            <Input
              id="quick-vendor-name"
              value={quickVendor.name}
              onChange={(e) => setQuickVendor((prev) => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div className="col-md-6">
            <Label htmlFor="quick-vendor-vat">เลขผู้เสียภาษี</Label>
            <Input
              id="quick-vendor-vat"
              value={quickVendor.vat || ''}
              inputMode="numeric"
              maxLength={13}
              onChange={(e) => setQuickVendor((prev) => ({ ...prev, vat: sanitizeVatNumber(e.target.value) }))}
            />
            {thaiVatValidationMessage(quickVendor.vat) ? (
              <div className="small text-danger mt-1">{thaiVatValidationMessage(quickVendor.vat)}</div>
            ) : null}
          </div>
          <div className="col-md-6">
            <Label htmlFor="quick-vendor-phone">โทรศัพท์</Label>
            <Input
              id="quick-vendor-phone"
              value={quickVendor.phone || ''}
              onChange={(e) => setQuickVendor((prev) => ({ ...prev, phone: e.target.value }))}
            />
          </div>
          <div className="col-md-6">
            <Label htmlFor="quick-vendor-email">อีเมล</Label>
            <Input
              id="quick-vendor-email"
              type="email"
              value={quickVendor.email || ''}
              onChange={(e) => setQuickVendor((prev) => ({ ...prev, email: e.target.value }))}
            />
          </div>
          <div className="col-md-6">
            <Label htmlFor="quick-vendor-vat-mode">ประเภทราคา</Label>
            <select
              id="quick-vendor-vat-mode"
              className="form-select"
              value={quickVendor.vatPriceMode || 'vat_excluded'}
              onChange={(e) =>
                setQuickVendor((prev) => ({
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
            <Label htmlFor="quick-vendor-branch">สาขา</Label>
            <Input
              id="quick-vendor-branch"
              value={quickVendor.branchCode || ''}
              onChange={(e) => setQuickVendor((prev) => ({ ...prev, branchCode: e.target.value }))}
            />
          </div>
          <div className="col-md-6">
            <CountrySelector
              value={quickVendor.countryId}
              onChange={(value) => setQuickVendor((prev) => ({ ...prev, countryId: value, stateId: value ? prev.stateId ?? null : null }))}
            />
          </div>
          <div className="col-md-6">
            <StateSelector
              countryId={quickVendor.countryId}
              value={quickVendor.stateId}
              onChange={(value) => setQuickVendor((prev) => ({ ...prev, stateId: value }))}
            />
          </div>
          <div className="col-md-6">
            <Label htmlFor="quick-vendor-subDistrict">แขวง/ตำบล</Label>
            <Input
              id="quick-vendor-subDistrict"
              value={quickVendor.subDistrict || ''}
              onChange={(e) => setQuickVendor((prev) => ({ ...prev, subDistrict: e.target.value }))}
            />
          </div>
          <div className="col-md-6">
            <Label htmlFor="quick-vendor-district">เขต/อำเภอ</Label>
            <Input
              id="quick-vendor-district"
              value={quickVendor.district || ''}
              onChange={(e) => setQuickVendor((prev) => ({ ...prev, district: e.target.value, city: e.target.value }))}
            />
          </div>
          <div className="col-md-6">
            <Label htmlFor="quick-vendor-zip">รหัสไปรษณีย์</Label>
            <Input
              id="quick-vendor-zip"
              value={quickVendor.zip || ''}
              onChange={(e) => setQuickVendor((prev) => ({ ...prev, zip: e.target.value }))}
            />
          </div>
          <div className="col-12">
            <Label htmlFor="quick-vendor-street">ที่อยู่</Label>
            <Input
              id="quick-vendor-street"
              value={quickVendor.street || ''}
              onChange={(e) => setQuickVendor((prev) => ({ ...prev, street: e.target.value }))}
            />
          </div>
        </div>
        <Alert variant="info" className="small mt-3 mb-0">
          ใช้สำหรับสร้างผู้ขายอย่างรวดเร็วจากหน้า PO โดยยังคงบันทึกเป็น <code>res.partner</code> ใน Odoo ตาม flow เดิม
        </Alert>
      </Modal.Body>
      <Modal.Footer>
        <Button size="sm" variant="secondary" type="button" onClick={() => setQuickVendorOpen(false)}>
          ยกเลิก
        </Button>
        <Button size="sm" type="button" onClick={submitQuickVendor} isLoading={quickVendorSaving}>
          บันทึกผู้ขาย
        </Button>
      </Modal.Footer>
    </Modal>
    </>
  )
}

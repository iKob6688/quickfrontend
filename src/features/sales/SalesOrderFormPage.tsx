import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Spinner } from 'react-bootstrap'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Combobox, type ComboboxOption } from '@/components/ui/Combobox'
import { ProductCombobox } from '@/features/sales/ProductCombobox'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import { extractFieldErrors, type FieldErrors } from '@/lib/formErrors'
import { toast } from '@/lib/toastStore'
import { listPartners, getPartner } from '@/api/services/partners.service'
import {
  createSalesOrder,
  getSalesOrder,
  updateSalesOrder,
  type SalesOrderLine,
  type SalesOrderPayload,
  type SalesOrderType,
} from '@/api/services/sales-orders.service'

export function SalesOrderFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
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
        lines: existingOrder.lines || [],
        notes: existingOrder.notes || '',
      })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [isEdit, existingOrder])

  const [partnerSearch, setPartnerSearch] = useState('')
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

  const createMutation = useMutation({
    mutationFn: (payload: SalesOrderPayload) => createSalesOrder(payload),
    onSuccess: (data) => {
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
      const subtotal = subtotalBeforeDiscount - (subtotalBeforeDiscount * discountPercent) / 100
      lines[index] = {
        ...merged,
        subtotal,
        totalTax: merged.totalTax || 0,
        total: subtotal + (merged.totalTax || 0),
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
          taxIds: [],
          subtotal: 0,
          totalTax: 0,
          total: 0,
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

  const totalAmount = formData.lines.reduce((sum, line) => sum + (line.total || 0), 0)

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
    <form onSubmit={handleSubmit} className="qf-so-page">
      <PageHeader
        title={isEdit ? 'แก้ไขใบเสนอราคา / Sale Order' : 'สร้างใบเสนอราคา / Sale Order'}
        subtitle={isEdit && existingOrder ? existingOrder.number || `#${existingOrder.id}` : 'รองรับการทำงานร่วมกับ Odoo18 (adt_th_api)'}
        breadcrumb="รายรับ · ใบเสนอราคา · Sale Order"
        actions={
          <div className="d-flex align-items-center gap-2 qf-so-actions">
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
          <Card>
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
                  isLoading={partnerOptionsQuery.isFetching || selectedPartnerQuery.isFetching}
                  isLoadingMore={partnerOptionsQuery.isFetchingNextPage}
                  onLoadMore={() => {
                    if (partnerOptionsQuery.hasNextPage) partnerOptionsQuery.fetchNextPage()
                  }}
                  options={partnerItems.map<ComboboxOption>((p) => ({
                    id: p.id,
                    label: p.name,
                    meta: p.vat ? `VAT: ${p.vat}` : p.email ? p.email : `ID: ${p.id}`,
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
                  </div>
                ) : null}
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
                              updateLine(idx, {
                                productId: product.id,
                                description: (line.description || '').trim() ? line.description : product.name,
                                unitPrice: typeof product.listPrice === 'number' ? product.listPrice : line.unitPrice,
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

                      <div className="qf-so-line__meta">
                        <div className="qf-so-line__field qf-so-line__field--qty">
                          <Label htmlFor={`so-qty-${idx}`}>จำนวน</Label>
                          <Input
                            id={`so-qty-${idx}`}
                            type="number"
                            className="text-end"
                            value={line.quantity}
                            onChange={(e) => updateLine(idx, { quantity: parseFloat(e.target.value) || 0 })}
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
                            value={line.unitPrice}
                            onChange={(e) => updateLine(idx, { unitPrice: parseFloat(e.target.value) || 0 })}
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
                            value={line.discount || 0}
                            onChange={(e) => updateLine(idx, { discount: parseFloat(e.target.value) || 0 })}
                            min="0"
                            max="100"
                            step="0.01"
                          />
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

            <Label htmlFor="notes">หมายเหตุ</Label>
            <textarea
              id="notes"
              className="form-control"
              rows={4}
              value={formData.notes || ''}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="เพิ่มหมายเหตุสำหรับลูกค้า"
            />

            <div className="small text-muted mt-3">
              หาก backend ยังไม่รองรับ endpoint <code>/sales/orders</code> ระบบจะแจ้ง error เพื่อให้ตรวจสอบโมดูล <code>adt_th_api</code>
            </div>
          </Card>
        </div>
      </div>

    </form>
  )
}

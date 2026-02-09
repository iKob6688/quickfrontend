import { useParams, useNavigate } from 'react-router-dom'
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
import { Spinner, Card as BootstrapCard } from 'react-bootstrap'
import { useEffect, useState, useMemo } from 'react'
import { extractFieldErrors, type FieldErrors } from '@/lib/formErrors'
import { toast } from '@/lib/toastStore'
import { listPartners, getPartner } from '@/api/services/partners.service'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import { Combobox, type ComboboxOption } from '@/components/ui/Combobox'
import { DataTable, type Column } from '@/components/ui/DataTable'

export function PurchaseOrderFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isEdit = !!id
  const orderId = id ? Number.parseInt(id, 10) : null

  const {
    data: existingOrder,
    isLoading: isLoadingOrder,
  } = useQuery({
    queryKey: ['purchaseOrder', orderId],
    queryFn: () => getPurchaseOrder(orderId!),
    enabled: isEdit && !!orderId,
  })

  const [formData, setFormData] = useState<PurchaseOrderPayload>(() => ({
    vendorId: 0,
    orderDate: new Date().toISOString().split('T')[0],
    currency: 'THB',
    lines: [],
    notes: '',
  }))

  const [vendorSearch, setVendorSearch] = useState('')
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

  // Hydrate form when editing order is loaded
  useEffect(() => {
    if (!isEdit || !existingOrder) return
    const timer = window.setTimeout(() => {
      setFormData({
        vendorId: existingOrder.vendorId || 0,
        orderDate: existingOrder.orderDate ? existingOrder.orderDate.split('T')[0] : new Date().toISOString().split('T')[0],
        expectedDate: existingOrder.expectedDate ? existingOrder.expectedDate.split('T')[0] : undefined,
        currency: existingOrder.currency || 'THB',
        lines: existingOrder.lines || [],
        notes: existingOrder.notes || '',
      })

      // Prefill vendor search text with vendor name for display in edit mode
      // This allows user to see the current vendor and optionally change it
      if (existingOrder.vendorName) {
        setVendorSearch(existingOrder.vendorName)
      }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [isEdit, existingOrder])

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

  const createMutation = useMutation({
    mutationFn: (payload: PurchaseOrderPayload) => createPurchaseOrder(payload),
    onSuccess: (data) => {
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
    onSuccess: () => {
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
        newLines[index] = { ...newLines[index], ...updates }
        // Recalculate totals (simplified - backend will calculate properly)
        const quantity = newLines[index].quantity || 0
        const unitPrice = newLines[index].unitPrice || 0
        newLines[index].subtotal = quantity * unitPrice
        newLines[index].totalTax = 0 // Simplified - should calculate from taxIds
        newLines[index].total = newLines[index].subtotal + newLines[index].totalTax
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
      key: 'description',
      header: 'รายละเอียด',
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
      className: 'text-end',
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
      className: 'text-end',
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
      key: 'total',
      header: 'ยอดรวม',
      className: 'text-end',
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
      className: 'text-end',
      cell: (r) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => removeLine(r.id)}
          className="text-danger"
        >
          <i className="bi bi-trash"></i>
        </Button>
      ),
    },
  ]

  const totalAmount = (formData.lines || []).reduce((sum, line) => sum + (line.total || 0), 0)

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
    <form onSubmit={handleSubmit}>
      <PageHeader
        title={isEdit ? 'แก้ไขใบสั่งซื้อ' : 'สร้างใบสั่งซื้อ'}
        subtitle={isEdit && existingOrder ? existingOrder.number || `ใบสั่งซื้อ #${existingOrder.id}` : ''}
        breadcrumb="รายจ่าย · ใบสั่งซื้อ"
        actions={
          <div className="d-flex align-items-center gap-2">
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
                        meta: p.vat ? `VAT: ${p.vat}` : p.email ? p.email : `ID: ${p.id}`,
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

                  {selectedVendorQuery.data ? (
                    <div className="small text-muted mt-2">
                      เลือกแล้ว:{' '}
                      <span className="fw-semibold">
                        {selectedVendorQuery.data.displayName || selectedVendorQuery.data.name}
                      </span>{' '}
                      (ID: {formData.vendorId})
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
                <DataTable columns={lineColumns} rows={lineRows} />
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
        </div>
      </div>
    </form>
  )
}

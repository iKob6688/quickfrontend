import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getInvoice, createInvoice, updateInvoice, type InvoicePayload } from '@/api/services/invoices.service'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Spinner, Alert } from 'react-bootstrap'
import { useEffect, useMemo, useState } from 'react'
import { extractFieldErrors, type FieldErrors } from '@/lib/formErrors'
import { toast } from '@/lib/toastStore'
import { listPartners, getPartner } from '@/api/services/partners.service'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import { Combobox, type ComboboxOption } from '@/components/ui/Combobox'
import { ProductCombobox } from '@/features/sales/ProductCombobox'

export function InvoiceFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const isEdit = !!id
  const invoiceId = id ? Number.parseInt(id, 10) : null
  const customerIdFromQuery = searchParams.get('customerId')
  const customerIdPrefill = customerIdFromQuery ? Number(customerIdFromQuery) : null

  const {
    data: existingInvoice,
    isLoading: isLoadingInvoice,
  } = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: () => getInvoice(invoiceId!),
    enabled: isEdit && !!invoiceId,
  })

  const [formData, setFormData] = useState<InvoicePayload>(() => ({
    customerId: 0,
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: new Date().toISOString().split('T')[0],
    currency: 'THB',
    lines: [],
    notes: '',
  }))

  // Prefill customerId when coming from CustomerDetailPage
  useEffect(() => {
    if (isEdit) return
    if (!customerIdPrefill || !Number.isFinite(customerIdPrefill) || customerIdPrefill <= 0) return
    setFormData((prev) => (prev.customerId ? prev : { ...prev, customerId: customerIdPrefill }))
  }, [customerIdPrefill, isEdit])

  const [customerSearch, setCustomerSearch] = useState('')
  const debouncedCustomerSearch = useDebouncedValue(customerSearch, 250)
  const customerLimit = 20

  const customerOptionsQuery = useInfiniteQuery({
    queryKey: ['partner-selector', debouncedCustomerSearch],
    enabled: !isEdit && debouncedCustomerSearch.trim().length >= 0,
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      listPartners({
        q: debouncedCustomerSearch || undefined,
        active: true,
        limit: customerLimit,
        offset: pageParam,
      }),
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((acc, p) => acc + (p?.items?.length ?? 0), 0)
      if (loaded >= (lastPage?.total ?? 0)) return undefined
      if ((lastPage?.items?.length ?? 0) < customerLimit) return undefined
      return loaded
    },
    staleTime: 30_000,
  })

  const customerItems = useMemo(
    () => customerOptionsQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [customerOptionsQuery.data?.pages],
  )
  const customerTotal = customerOptionsQuery.data?.pages[0]?.total

  const selectedCustomerQuery = useQuery({
    queryKey: ['partner', formData.customerId],
    enabled: !isEdit && formData.customerId > 0,
    queryFn: () => getPartner(formData.customerId),
    staleTime: 30_000,
  })

  // Hydrate form when editing invoice is loaded (avoid stale initial state)
  useEffect(() => {
    if (!isEdit || !existingInvoice) return
    setFormData({
      customerId: existingInvoice.customerId,
      invoiceDate: existingInvoice.invoiceDate || new Date().toISOString().split('T')[0],
      dueDate: existingInvoice.dueDate || new Date().toISOString().split('T')[0],
      currency: existingInvoice.currency || 'THB',
      lines: existingInvoice.lines || [],
      notes: existingInvoice.notes || '',
    })
  }, [existingInvoice, isEdit])

  const canSubmit = useMemo(() => {
    if (!formData.customerId) return false
    if (!formData.invoiceDate || !formData.dueDate) return false
    if (!formData.currency) return false
    if (!formData.lines || formData.lines.length === 0) return false
    return true
  }, [formData])

  const createMutation = useMutation({
    mutationFn: (payload: InvoicePayload) => createInvoice(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      toast.success('สร้างใบแจ้งหนี้สำเร็จ', data.number ? `เลขที่: ${data.number}` : undefined)
      navigate(`/sales/invoices/${data.id}`)
    },
    onError: (err) => {
      const fe = extractFieldErrors(err)
      if (fe) setFieldErrors(fe)
      toast.error('สร้างใบแจ้งหนี้ไม่สำเร็จ', err instanceof Error ? err.message : undefined)
    },
  })

  const updateMutation = useMutation({
    mutationFn: (payload: InvoicePayload) => updateInvoice(invoiceId!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      toast.success('บันทึกสำเร็จ')
      navigate(`/sales/invoices/${invoiceId}`)
    },
    onError: (err) => {
      const fe = extractFieldErrors(err)
      if (fe) setFieldErrors(fe)
      toast.error('บันทึกไม่สำเร็จ', err instanceof Error ? err.message : undefined)
    },
  })

  const [fieldErrors, setFieldErrors] = useState<FieldErrors | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFieldErrors(null)
    if (isEdit) {
      updateMutation.mutate(formData)
    } else {
      createMutation.mutate(formData)
    }
  }

  if (isEdit && isLoadingInvoice) {
    return (
      <div className="d-flex justify-content-center align-items-center py-5">
        <Spinner animation="border" />
        <span className="ms-3">กำลังโหลดข้อมูล...</span>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={isEdit ? 'แก้ไขใบแจ้งหนี้' : 'สร้างใบแจ้งหนี้ใหม่'}
        subtitle={isEdit ? `แก้ไข ${existingInvoice?.number || `#${invoiceId}`}` : 'กรอกข้อมูลใบแจ้งหนี้'}
        breadcrumb="รายรับ · ใบแจ้งหนี้"
        actions={
          <div className="d-flex align-items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => navigate(isEdit ? `/sales/invoices/${invoiceId}` : '/sales/invoices')}
            >
              ยกเลิก
            </Button>
          </div>
        }
      />

      <form onSubmit={handleSubmit}>
        <div className="row g-4">
          <div className="col-lg-8">
            <Card>
              <h5 className="h6 fw-semibold mb-3">ข้อมูลหลัก</h5>
              <div className="row g-3">
                <div className="col-md-6">
                  <Label htmlFor="customerId" required>
                    ลูกค้า
                  </Label>
                  <Combobox
                    id="customerSearch"
                    value={customerSearch}
                    onChange={setCustomerSearch}
                    placeholder="พิมพ์เพื่อค้นหาลูกค้า (ชื่อ / VAT / อีเมล)"
                    leftAdornment={<i className="bi bi-search"></i>}
                    minChars={1}
                    isLoading={customerOptionsQuery.isFetching || selectedCustomerQuery.isFetching}
                    isLoadingMore={customerOptionsQuery.isFetchingNextPage}
                    onLoadMore={() => {
                      if (customerOptionsQuery.hasNextPage) customerOptionsQuery.fetchNextPage()
                    }}
                    options={customerItems.map<ComboboxOption>((p) => ({
                      id: p.id,
                      label: p.name,
                      meta: p.vat ? `VAT: ${p.vat}` : p.email ? p.email : `ID: ${p.id}`,
                    }))}
                    total={customerTotal}
                    emptyText="ไม่พบลูกค้า (ลองพิมพ์คำอื่น)"
                    onPick={(opt) => {
                      setFormData((prev) => ({ ...prev, customerId: Number(opt.id) }))
                      setCustomerSearch(opt.label)
                    }}
                  />
                  <div className="small text-muted mt-2">
                    Tip: พิมพ์อย่างน้อย 1 ตัวอักษรเพื่อค้นหา • ใช้ ↑/↓ และ Enter เพื่อเลือก • Esc เพื่อปิด
                  </div>

                  {selectedCustomerQuery.data ? (
                    <div className="small text-muted mt-2">
                      เลือกแล้ว:{' '}
                      <span className="fw-semibold">
                        {selectedCustomerQuery.data.displayName}
                      </span>{' '}
                      (ID: {formData.customerId})
                    </div>
                  ) : null}

                  {customerOptionsQuery.isError ? (
                    <div className="small text-danger mt-2">
                      {customerOptionsQuery.error instanceof Error
                        ? customerOptionsQuery.error.message
                        : 'โหลดรายชื่อลูกค้าไม่สำเร็จ'}
                    </div>
                  ) : null}

                  {fieldErrors?.customerId ? (
                    <small className="text-danger">{fieldErrors.customerId}</small>
                  ) : null}
                </div>
                <div className="col-md-6">
                  <Label htmlFor="currency" required>
                    สกุลเงิน
                  </Label>
                  <Input
                    id="currency"
                    value={formData.currency}
                    onChange={(e) =>
                      setFormData({ ...formData, currency: e.target.value })
                    }
                    placeholder="THB"
                    required
                  />
                  {fieldErrors?.currency ? (
                    <small className="text-danger">{fieldErrors.currency}</small>
                  ) : null}
                </div>
                <div className="col-md-6">
                  <Label htmlFor="invoiceDate" required>
                    วันที่เอกสาร
                  </Label>
                  <Input
                    id="invoiceDate"
                    type="date"
                    value={formData.invoiceDate}
                    onChange={(e) =>
                      setFormData({ ...formData, invoiceDate: e.target.value })
                    }
                    required
                  />
                  {fieldErrors?.invoiceDate ? (
                    <small className="text-danger">{fieldErrors.invoiceDate}</small>
                  ) : null}
                </div>
                <div className="col-md-6">
                  <Label htmlFor="dueDate" required>
                    วันครบกำหนด
                  </Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) =>
                      setFormData({ ...formData, dueDate: e.target.value })
                    }
                    required
                  />
                  {fieldErrors?.dueDate ? (
                    <small className="text-danger">{fieldErrors.dueDate}</small>
                  ) : null}
                </div>
                <div className="col-12">
                  <Label htmlFor="notes">หมายเหตุ</Label>
                  <textarea
                    id="notes"
                    className="form-control"
                    rows={3}
                    value={formData.notes || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
                  />
                </div>
              </div>
            </Card>

            <Card className="mt-4">
              <div className="d-flex align-items-center justify-content-between gap-3 mb-2">
                <div>
                  <h5 className="h6 fw-semibold mb-0">รายการสินค้า/บริการ</h5>
                  <div className="small text-muted">
                    Odoo จะคำนวณยอด/ภาษี/รวมทั้งหมดหลังบันทึก (Quickfront แสดงผลเท่านั้น)
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="primary"
                  type="button"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      lines: [
                        ...formData.lines,
                        {
                          productId: null,
                          description: '',
                          quantity: 1,
                          unitPrice: 0,
                          taxRate: 0,
                          subtotal: 0,
                        },
                      ],
                    })
                  }
                >
                  <i className="bi bi-plus-lg me-1" />
                  เพิ่มรายการ
                </Button>
              </div>
              <div className="d-flex justify-content-between align-items-center mb-2">
                <div />
              </div>

              {formData.lines.length === 0 ? (
                <div className="alert alert-warning small mb-0">
                  กรุณาเพิ่มอย่างน้อย 1 รายการ
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm table-hover align-middle mb-0" style={{ tableLayout: 'fixed' }}>
                    <thead className="table-light">
                      <tr className="text-muted small fw-semibold">
                        <th style={{ width: 260 }}>สินค้า/บริการ</th>
                        <th>รายละเอียด</th>
                        <th style={{ width: 110 }} className="text-end">
                          จำนวน
                        </th>
                        <th style={{ width: 140 }} className="text-end">
                          ราคาต่อหน่วย
                        </th>
                        <th style={{ width: 110 }} className="text-end">
                          VAT%
                        </th>
                        <th style={{ width: 60 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.lines.map((line, idx) => (
                        <tr key={idx}>
                          <td>
                            <ProductCombobox
                              valueId={line.productId ?? null}
                              onPick={(p) => {
                                const next = [...formData.lines]
                                const prev = next[idx]
                                next[idx] = {
                                  ...prev,
                                  productId: p.id,
                                  // If description is empty, auto-fill with product name
                                  description: (prev.description || '').trim() ? prev.description : p.name,
                                }
                                setFormData({ ...formData, lines: next })
                              }}
                            />
                          </td>
                          <td>
                            <input
                              className="form-control form-control-sm"
                              value={line.description || ''}
                              onChange={(e) => {
                                const next = [...formData.lines]
                                next[idx] = { ...next[idx], description: e.target.value }
                                setFormData({ ...formData, lines: next })
                              }}
                              placeholder="เช่น ค่าบริการ / สินค้า"
                            />
                          </td>
                          <td className="text-end">
                            <input
                              className="form-control form-control-sm text-end"
                              type="number"
                              value={line.quantity ?? 1}
                              onChange={(e) => {
                                const next = [...formData.lines]
                                next[idx] = {
                                  ...next[idx],
                                  quantity: Number.parseFloat(e.target.value || '0'),
                                }
                                setFormData({ ...formData, lines: next })
                              }}
                              min={0}
                              step="0.01"
                            />
                          </td>
                          <td className="text-end">
                            <input
                              className="form-control form-control-sm text-end"
                              type="number"
                              value={line.unitPrice ?? 0}
                              onChange={(e) => {
                                const next = [...formData.lines]
                                next[idx] = {
                                  ...next[idx],
                                  unitPrice: Number.parseFloat(e.target.value || '0'),
                                }
                                setFormData({ ...formData, lines: next })
                              }}
                              min={0}
                              step="0.01"
                            />
                          </td>
                          <td className="text-end">
                            <input
                              className="form-control form-control-sm text-end"
                              type="number"
                              value={line.taxRate ?? 0}
                              onChange={(e) => {
                                const next = [...formData.lines]
                                next[idx] = {
                                  ...next[idx],
                                  taxRate: Number.parseFloat(e.target.value || '0'),
                                }
                                setFormData({ ...formData, lines: next })
                              }}
                              min={0}
                              step="0.01"
                            />
                          </td>
                          <td className="text-end">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => {
                                const next = [...formData.lines]
                                next.splice(idx, 1)
                                setFormData({ ...formData, lines: next })
                              }}
                              title="ลบรายการ"
                            >
                              <i className="bi bi-trash"></i>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>

          <div className="col-lg-4">
            <Card>
              <h5 className="h6 fw-semibold mb-3">การดำเนินการ</h5>
              {(createMutation.error || updateMutation.error) && (
                <Alert variant="danger" className="small mb-3">
                  {createMutation.error instanceof Error
                    ? createMutation.error.message
                    : updateMutation.error instanceof Error
                      ? updateMutation.error.message
                      : 'เกิดข้อผิดพลาด'}
                </Alert>
              )}
              <div className="d-grid gap-2">
                <Button
                  type="submit"
                  isLoading={createMutation.isPending || updateMutation.isPending}
                  disabled={!canSubmit || createMutation.isPending || updateMutation.isPending}
                >
                  {isEdit ? 'บันทึกการแก้ไข' : 'สร้างใบแจ้งหนี้'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    navigate(isEdit ? `/sales/invoices/${invoiceId}` : '/sales/invoices')
                  }
                >
                  ยกเลิก
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </form>
    </div>
  )
}


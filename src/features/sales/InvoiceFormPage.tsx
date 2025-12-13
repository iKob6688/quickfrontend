import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
import { hasScope, isScopesConfigured } from '@/lib/scopes'

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

  const canUseContacts = hasScope('contacts')
  const [customerSearch, setCustomerSearch] = useState('')
  const debouncedCustomerSearch = useDebouncedValue(customerSearch, 250)

  const customerOptionsQuery = useQuery({
    queryKey: ['partner-selector', debouncedCustomerSearch],
    enabled: !isEdit && canUseContacts && debouncedCustomerSearch.trim().length >= 0,
    queryFn: () =>
      listPartners({
        q: debouncedCustomerSearch || undefined,
        active: true,
        limit: 10,
        offset: 0,
      }),
    staleTime: 30_000,
  })

  const selectedCustomerQuery = useQuery({
    queryKey: ['partner', formData.customerId],
    enabled: !isEdit && canUseContacts && formData.customerId > 0,
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
                  {canUseContacts ? (
                    <>
                      <Input
                        id="customerSearch"
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        placeholder="ค้นหาชื่อลูกค้า / VAT / อีเมล"
                        leftAdornment={<i className="bi bi-search"></i>}
                      />
                      <div className="mt-2">
                        {selectedCustomerQuery.data ? (
                          <div className="small text-muted">
                            เลือกแล้ว: <span className="fw-semibold">{selectedCustomerQuery.data.displayName}</span> (ID: {formData.customerId})
                          </div>
                        ) : null}
                      </div>
                      <div className="mt-2">
                        <div className="list-group">
                          {(customerOptionsQuery.data?.items ?? []).map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              className="list-group-item list-group-item-action d-flex align-items-center justify-content-between"
                              onClick={() => {
                                setFormData((prev) => ({ ...prev, customerId: p.id }))
                                setCustomerSearch(p.name)
                              }}
                            >
                              <span className="fw-semibold">{p.name}</span>
                              <span className="text-muted small">ID: {p.id}</span>
                            </button>
                          ))}
                        </div>
                        {customerOptionsQuery.isError ? (
                          <div className="small text-danger mt-2">
                            {customerOptionsQuery.error instanceof Error ? customerOptionsQuery.error.message : 'โหลดรายชื่อลูกค้าไม่สำเร็จ'}
                          </div>
                        ) : null}
                      </div>
                      {!isScopesConfigured() ? (
                        <div className="small text-muted mt-2">
                          หมายเหตุ: ยังไม่ได้ตั้งค่า <code>VITE_ALLOWED_SCOPES</code> — ระบบจะลองเรียก backend โดยตรง (backend จะเป็นคน enforce สิทธิ์)
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <Input
                        id="customerId"
                        type="number"
                        value={formData.customerId || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            customerId: Number.parseInt(e.target.value, 10),
                          })
                        }
                        placeholder="Customer ID"
                        required
                      />
                      <small className="text-muted">
                        ฟีเจอร์ค้นหาลูกค้าต้องใช้ scope <code>contacts</code>
                      </small>
                    </>
                  )}
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
              <h5 className="h6 fw-semibold mb-3">รายการสินค้า/บริการ</h5>
              <div className="d-flex justify-content-between align-items-center mb-2">
                <p className="small text-muted mb-0">
                  Odoo จะคำนวณยอด/ภาษี/รวมทั้งหมดหลังบันทึก (Quickfront แสดงผลเท่านั้น)
                </p>
                <Button
                  size="sm"
                  variant="secondary"
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
                  + เพิ่มรายการ
                </Button>
              </div>

              {formData.lines.length === 0 ? (
                <div className="alert alert-warning small mb-0">
                  กรุณาเพิ่มอย่างน้อย 1 รายการ
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm align-middle mb-0">
                    <thead>
                      <tr className="text-muted small">
                        <th style={{ width: 140 }}>Product (vNext)</th>
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
                            <input
                              className="form-control form-control-sm"
                              type="number"
                              value={line.productId ?? ''}
                              onChange={(e) => {
                                const next = [...formData.lines]
                                next[idx] = {
                                  ...next[idx],
                                  productId: e.target.value ? Number.parseInt(e.target.value, 10) : null,
                                }
                                setFormData({ ...formData, lines: next })
                              }}
                              min={0}
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


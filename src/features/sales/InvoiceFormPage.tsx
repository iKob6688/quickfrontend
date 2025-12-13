import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getInvoice, createInvoice, updateInvoice, type InvoicePayload } from '@/api/endpoints/invoices'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Spinner, Alert } from 'react-bootstrap'
import { useState } from 'react'

export function InvoiceFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isEdit = !!id
  const invoiceId = id ? Number.parseInt(id, 10) : null

  const {
    data: existingInvoice,
    isLoading: isLoadingInvoice,
  } = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: () => getInvoice(invoiceId!),
    enabled: isEdit && !!invoiceId,
  })

  const [formData, setFormData] = useState<InvoicePayload>({
    customerId: existingInvoice?.customerId || 0,
    invoiceDate: existingInvoice?.invoiceDate || new Date().toISOString().split('T')[0],
    dueDate: existingInvoice?.dueDate || new Date().toISOString().split('T')[0],
    currency: existingInvoice?.currency || 'THB',
    lines: existingInvoice?.lines || [],
    notes: existingInvoice?.notes || '',
  })

  const createMutation = useMutation({
    mutationFn: (payload: InvoicePayload) => createInvoice(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      navigate(`/sales/invoices/${data.id}`)
    },
  })

  const updateMutation = useMutation({
    mutationFn: (payload: InvoicePayload) => updateInvoice(invoiceId!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      navigate(`/sales/invoices/${invoiceId}`)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
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
                    TODO: Replace with customer selector
                  </small>
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
              <Alert variant="info" className="small">
                <i className="bi bi-info-circle me-2"></i>
                TODO: Implement invoice lines editor
              </Alert>
              <div className="text-muted small">
                Current lines: {formData.lines.length} item(s)
              </div>
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


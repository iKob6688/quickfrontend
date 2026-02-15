import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert } from 'react-bootstrap'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { ProductCombobox } from '@/features/sales/ProductCombobox'
import { toast } from '@/lib/toastStore'
import {
  createPurchaseRequest,
  getPurchaseRequest,
  updatePurchaseRequest,
  type PurchaseRequestLine,
  type PurchaseRequestPayload,
} from '@/api/services/purchase-requests.service'

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

function nextWeekISO() {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
}

const EMPTY_LINE: PurchaseRequestLine = {
  productId: null,
  description: '',
  quantity: 1,
  estimatedCost: 0,
}

export function PurchaseRequestFormPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const requestId = id ? Number(id) : null

  const [errorText, setErrorText] = useState<string | null>(null)
  const [draft, setDraft] = useState<Partial<PurchaseRequestPayload>>({})

  const requestQuery = useQuery({
    queryKey: ['purchaseRequest', requestId],
    enabled: isEdit && Boolean(requestId),
    queryFn: () => getPurchaseRequest(requestId!),
    staleTime: 30_000,
  })

  const formData = useMemo<PurchaseRequestPayload>(() => {
    if (isEdit && requestQuery.data) {
      return {
        requestedDate: requestQuery.data.requestedDate || todayISO(),
        requiredDate: requestQuery.data.requiredDate || nextWeekISO(),
        notes: requestQuery.data.notes || '',
        lines: requestQuery.data.lines || [EMPTY_LINE],
        ...draft,
      }
    }
    return {
      requestedDate: todayISO(),
      requiredDate: nextWeekISO(),
      notes: '',
      lines: [EMPTY_LINE],
      ...draft,
    }
  }, [draft, isEdit, requestQuery.data])

  const saveMutation = useMutation({
    mutationFn: async (payload: PurchaseRequestPayload) => {
      if (isEdit && requestId) return updatePurchaseRequest(requestId, payload)
      return createPurchaseRequest(payload)
    },
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['purchaseRequests'] })
      await queryClient.invalidateQueries({ queryKey: ['purchaseRequest', res.id] })
      toast.success(isEdit ? 'บันทึกคำขอซื้อสำเร็จ' : 'สร้างคำขอซื้อสำเร็จ')
      navigate(`/purchases/requests/${res.id}`, { replace: true })
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : 'บันทึกคำขอซื้อไม่สำเร็จ'
      setErrorText(msg)
      toast.error(msg)
    },
  })

  const updateLine = (index: number, patch: Partial<PurchaseRequestLine>) => {
    setDraft((prev) => {
      const lines = [...(prev.lines || formData.lines || [])]
      if (index < 0 || index >= lines.length) return prev
      lines[index] = { ...lines[index], ...patch }
      return { ...prev, lines }
    })
  }

  const addLine = () => {
    setDraft((prev) => ({ ...prev, lines: [...(prev.lines || formData.lines || []), { ...EMPTY_LINE }] }))
  }

  const removeLine = (index: number) => {
    setDraft((prev) => {
      const lines = (prev.lines || formData.lines || []).filter((_, i) => i !== index)
      return { ...prev, lines: lines.length ? lines : [{ ...EMPTY_LINE }] }
    })
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrorText(null)
    const lines = (formData.lines || []).filter((l) => l.productId || (l.description || '').trim())
    if (!lines.length) {
      setErrorText('กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ')
      return
    }
    const invalidQty = lines.find((l) => Number(l.quantity || 0) <= 0)
    if (invalidQty) {
      setErrorText('จำนวนสินค้าต้องมากกว่า 0')
      return
    }

    await saveMutation.mutateAsync({
      requestedDate: formData.requestedDate,
      requiredDate: formData.requiredDate,
      notes: (formData.notes || '').trim(),
      lines: lines.map((l) => ({
        productId: l.productId,
        description: (l.description || '').trim(),
        quantity: Number(l.quantity || 0),
        estimatedCost: Number(l.estimatedCost || 0),
      })),
    })
  }

  return (
    <form onSubmit={onSubmit}>
      <PageHeader
        title={isEdit ? 'แก้ไขคำขอซื้อ' : 'สร้างคำขอซื้อ'}
        subtitle="จัดการคำขอซื้อให้พร้อมส่งอนุมัติ"
        breadcrumb={`รายจ่าย · คำขอซื้อ · ${isEdit ? 'แก้ไข' : 'สร้าง'}`}
        actions={
          <div className="d-flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => navigate('/purchases/requests')}>
              ยกเลิก
            </Button>
            <Button size="sm" type="submit" isLoading={saveMutation.isPending}>
              บันทึก
            </Button>
          </div>
        }
      />

      {errorText ? (
        <Alert variant="danger" className="small">
          {errorText}
        </Alert>
      ) : null}

      {isEdit && requestQuery.isLoading ? <div className="small text-muted">กำลังโหลดข้อมูลคำขอซื้อ...</div> : null}
      {isEdit && requestQuery.isError ? (
        <Alert variant="danger" className="small">
          {requestQuery.error instanceof Error ? requestQuery.error.message : 'โหลดคำขอซื้อไม่สำเร็จ'}
        </Alert>
      ) : null}

      <div className="row g-4">
        <div className="col-lg-8">
          <Card className="p-4">
            <div className="qf-section-title mb-3">ข้อมูลหลัก</div>
            <div className="row g-3">
              <div className="col-md-6">
                <Label htmlFor="requestedDate" required>
                  วันที่ขอ
                </Label>
                <Input
                  id="requestedDate"
                  type="date"
                  value={formData.requestedDate}
                  onChange={(e) => setDraft((p) => ({ ...p, requestedDate: e.target.value }))}
                />
              </div>
              <div className="col-md-6">
                <Label htmlFor="requiredDate">วันที่ต้องการ</Label>
                <Input
                  id="requiredDate"
                  type="date"
                  value={formData.requiredDate || ''}
                  onChange={(e) => setDraft((p) => ({ ...p, requiredDate: e.target.value }))}
                />
              </div>
              <div className="col-12">
                <Label htmlFor="notes">หมายเหตุ</Label>
                <Input
                  id="notes"
                  value={formData.notes || ''}
                  onChange={(e) => setDraft((p) => ({ ...p, notes: e.target.value }))}
                />
              </div>
            </div>
          </Card>

          <Card className="p-4 mt-4">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <div className="qf-section-title mb-0">รายการสินค้า</div>
              <Button size="sm" onClick={addLine}>
                + เพิ่มรายการ
              </Button>
            </div>
            <div className="d-flex flex-column gap-3">
              {(formData.lines || []).map((line, idx) => (
                <div key={idx} className="border rounded p-3">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <div className="fw-semibold">รายการที่ {idx + 1}</div>
                    <Button size="sm" variant="ghost" onClick={() => removeLine(idx)}>
                      ลบ
                    </Button>
                  </div>
                  <div className="row g-2">
                    <div className="col-md-5">
                      <Label>สินค้า/บริการ</Label>
                      <ProductCombobox
                        valueId={line.productId || null}
                        onPick={(product) =>
                          updateLine(idx, {
                            productId: product.id,
                            description: (line.description || '').trim() ? line.description : product.name,
                            estimatedCost: typeof product.listPrice === 'number' ? product.listPrice : line.estimatedCost,
                          })
                        }
                      />
                    </div>
                    <div className="col-md-4">
                      <Label>รายละเอียด</Label>
                      <Input value={line.description || ''} onChange={(e) => updateLine(idx, { description: e.target.value })} />
                    </div>
                    <div className="col-md-1">
                      <Label>จำนวน</Label>
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={line.quantity}
                        onChange={(e) => updateLine(idx, { quantity: Number(e.target.value || 0) })}
                      />
                    </div>
                    <div className="col-md-2">
                      <Label>ราคาโดยประมาณ</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.estimatedCost || 0}
                        onChange={(e) => updateLine(idx, { estimatedCost: Number(e.target.value || 0) })}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </form>
  )
}

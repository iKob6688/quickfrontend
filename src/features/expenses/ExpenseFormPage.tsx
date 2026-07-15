import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Alert, Spinner } from 'react-bootstrap'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { createExpense, type ExpensePayload } from '@/api/services/expenses.service'
import { listProducts } from '@/api/services/products.service'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import { toast } from '@/lib/toastStore'
import {
  DocumentLineTable,
  DocumentPageLayout,
  DocumentSectionCard,
  DocumentSummary,
  DocumentToolbar,
  useDocumentKeyboardShortcuts,
} from '@/features/document'
import type { Column } from '@/components/ui/DataTable'

interface ExpenseLineForm {
  productId: number | null
  description: string
  quantity: number
  unitPrice: number
  subtotal?: number
  totalTax?: number
  total?: number
}

export function ExpenseFormPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [productSearch, setProductSearch] = useState('')
  const productSearchDebounced = useDebouncedValue(productSearch, 250)
  const [formData, setFormData] = useState<ExpensePayload>({
    expenseDate: new Date().toISOString().slice(0, 10),
    currency: 'THB',
    notes: '',
    lines: [],
  })
  const [line, setLine] = useState<ExpenseLineForm>({
    productId: null,
    description: '',
    quantity: 1,
    unitPrice: 0,
  })

  const productsQuery = useQuery({
    queryKey: ['expense-form-products', productSearchDebounced],
    queryFn: () =>
      listProducts({
        q: productSearchDebounced || undefined,
        limit: 25,
        offset: 0,
        active: true,
      }),
    staleTime: 30_000,
  })

  const productOptions = productsQuery.data?.items ?? []

  const total = useMemo(
    () =>
      (formData.lines || []).reduce(
        (sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0),
        0,
      ),
    [formData.lines],
  )

  const lineRows = useMemo(
    () =>
      (formData.lines || []).map((l, idx) => ({
        id: idx,
        ...l,
        subtotal: Number(l.quantity || 0) * Number(l.unitPrice || 0),
      })),
    [formData.lines],
  )

  const canAddLine = Boolean(
    ((line.productId && line.productId > 0) || line.description.trim()) &&
      line.quantity > 0 &&
      line.unitPrice >= 0,
  )
  const canSubmit = Boolean(formData.expenseDate && formData.currency && formData.lines.length === 1)

  const createMutation = useMutation({
    mutationFn: (payload: ExpensePayload) => createExpense(payload),
    onSuccess: (expense) => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['expenses-counts'] })
      toast.success('สร้างรายจ่ายสำเร็จ', expense.number ? `เลขที่: ${expense.number}` : undefined)
      navigate(`/expenses/${expense.id}`)
    },
    onError: (err) => {
      toast.error('สร้างรายจ่ายไม่สำเร็จ', err instanceof Error ? err.message : undefined)
    },
  })

  const addLine = () => {
    if (!canAddLine) return
    const nextLine = {
      productId: line.productId,
      description: line.description.trim(),
      quantity: Number(line.quantity) || 1,
      unitPrice: Number(line.unitPrice) || 0,
      subtotal: Number(line.quantity || 0) * Number(line.unitPrice || 0),
      totalTax: 0,
      total: Number(line.quantity || 0) * Number(line.unitPrice || 0),
    }
    setFormData((prev) => ({ ...prev, lines: [...prev.lines, nextLine] }))
    setLine({
      productId: null,
      description: '',
      quantity: 1,
      unitPrice: 0,
    })
    setProductSearch('')
  }

  const removeLine = (index: number) => {
    if (!window.confirm('ยืนยันการลบรายการนี้ใช่หรือไม่?')) return
    setFormData((prev) => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== index),
    }))
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    createMutation.mutate(formData)
  }

  useDocumentKeyboardShortcuts({
    onSave: () => document.querySelector<HTMLFormElement>('#expense-form')?.requestSubmit(),
    onPrint: () => window.print(),
  })

  const summaryRows = [
    { label: 'จำนวนรายการ', value: `${formData.lines.length}` },
    { label: 'สกุลเงิน', value: formData.currency },
  ]

  const lineColumns: Column<(typeof lineRows)[number]>[] = [
    {
      key: 'description',
      header: 'รายการ',
      className: 'qf-document-line__description',
      cell: (row) => (
        <div className="small">
          <div className="fw-semibold">{row.description || 'ยังไม่มีรายละเอียด'}</div>
          <div className="text-muted">
            {row.quantity} x {Number(row.unitPrice || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'ยอด',
      className: 'text-end qf-document-line__price',
      cell: (row) => (
        <span className="font-monospace">
          {Number(row.subtotal || 0).toLocaleString('th-TH', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-end qf-document-line__action',
      cell: (row) => (
        <div className="d-flex justify-content-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              const duplicate = {
                ...formData.lines[row.id],
                description: `${formData.lines[row.id]?.description || 'รายการ'} (สำเนา)`,
              }
              setFormData((prev) => {
                const next = [...prev.lines]
                next.splice(row.id + 1, 0, duplicate)
                return { ...prev, lines: next }
              })
            }}
          >
            <i className="bi bi-files me-1"></i>
            สำเนา
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => removeLine(row.id)}>
            <i className="bi bi-trash me-1"></i>
            ลบ
          </Button>
        </div>
      ),
    },
  ]

  return (
    <DocumentPageLayout
      title="สร้างรายจ่ายใหม่"
      subtitle="บันทึกรายจ่ายและรายการสินค้า/บริการ"
      breadcrumb="รายจ่าย · สร้างรายจ่าย"
      actions={
        <div className="d-flex align-items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => navigate('/expenses')}>
            ยกเลิก
          </Button>
        </div>
      }
    >
      <form id="expense-form" onSubmit={submit} className="qf-document-form">
        <div className="qf-document-form__stack">
          <DocumentSectionCard title="ข้อมูลหลัก">
            <div className="row g-3">
              <div className="col-md-4">
                <Label htmlFor="expenseDate" required>
                  วันที่รายจ่าย
                </Label>
                <Input
                  id="expenseDate"
                  type="date"
                  value={formData.expenseDate}
                  onChange={(e) => setFormData((prev) => ({ ...prev, expenseDate: e.target.value }))}
                />
              </div>
              <div className="col-md-4">
                <Label htmlFor="currency" required>
                  สกุลเงิน
                </Label>
                <Input
                  id="currency"
                  value={formData.currency}
                  onChange={(e) => setFormData((prev) => ({ ...prev, currency: e.target.value.toUpperCase() }))}
                />
              </div>
              <div className="col-md-12">
                <Label htmlFor="notes">หมายเหตุ</Label>
                <textarea
                  id="notes"
                  className="form-control"
                  rows={3}
                  value={formData.notes || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                />
              </div>
            </div>
          </DocumentSectionCard>

          <DocumentSectionCard
            title="เพิ่มรายการ"
            description="ใช้แบบฟอร์มนี้เพื่อเตรียมรายการก่อนลงในเอกสารรายจ่าย"
          >
            <div className="row g-3">
              <div className="col-md-6">
                <Label htmlFor="line-product-search">ค้นหาสินค้า/บริการ</Label>
                <Input
                  id="line-product-search"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="พิมพ์ชื่อสินค้า"
                />
              </div>
              <div className="col-md-6">
                <Label htmlFor="line-product">สินค้า/บริการ</Label>
                <select
                  id="line-product"
                  className="form-select"
                  value={line.productId ?? ''}
                  onChange={(e) => {
                    const nextId = e.target.value ? Number(e.target.value) : null
                    const selected = productOptions.find((p) => p.id === nextId)
                    setLine((prev) => ({
                      ...prev,
                      productId: nextId,
                      description: selected?.name || prev.description,
                      unitPrice: selected?.listPrice ?? prev.unitPrice,
                    }))
                  }}
                >
                  <option value="">เลือกสินค้า/บริการ</option>
                  {productsQuery.isLoading ? <option>กำลังโหลด...</option> : null}
                  {productOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.defaultCode ? `[${p.defaultCode}] ` : ''}
                      {p.name}
                    </option>
                  ))}
                </select>
                <div className="form-text">เลือกสินค้าเดิมหรือกรอกรายละเอียด 1 รายการต่อ 1 เอกสารรายจ่าย</div>
              </div>
              <div className="col-md-6">
                <Label htmlFor="line-description">รายละเอียด</Label>
                <Input
                  id="line-description"
                  value={line.description}
                  onChange={(e) => setLine((prev) => ({ ...prev, description: e.target.value }))}
                />
              </div>
              <div className="col-md-3">
                <Label htmlFor="line-qty">จำนวน</Label>
                <Input
                  id="line-qty"
                  type="number"
                  min={0}
                  step="0.01"
                  value={String(line.quantity)}
                  onChange={(e) => setLine((prev) => ({ ...prev, quantity: Number(e.target.value || '0') }))}
                />
              </div>
              <div className="col-md-3">
                <Label htmlFor="line-price">ราคาต่อหน่วย</Label>
                <Input
                  id="line-price"
                  type="number"
                  min={0}
                  step="0.01"
                  value={String(line.unitPrice)}
                  onChange={(e) => setLine((prev) => ({ ...prev, unitPrice: Number(e.target.value || '0') }))}
                />
              </div>
            </div>
            <div className="d-flex justify-content-end mt-3">
              <Button type="button" size="sm" onClick={addLine} disabled={!canAddLine}>
                <i className="bi bi-plus-lg me-1" />
                เพิ่มรายการ
              </Button>
            </div>
          </DocumentSectionCard>

          <DocumentLineTable
            title="รายการในเอกสาร"
            description="รายการที่เพิ่มแล้วจะแสดงในสรุปด้านล่าง"
            rows={lineRows}
            columns={lineColumns}
            empty={<div className="alert alert-warning small mb-0">ยังไม่มีรายการรายจ่าย</div>}
          />

          {formData.lines.length > 1 ? (
            <Alert variant="warning" className="small">
              API ปัจจุบันรองรับ 1 รายการต่อรายจ่าย กรุณาแยกบันทึกทีละรายการ
            </Alert>
          ) : null}

          <DocumentSummary
            rows={summaryRows}
            totalLabel="ยอดรวมโดยประมาณ"
            totalValue={`${total.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${formData.currency}`}
            note="สรุปนี้แสดงยอดประมาณการก่อนยืนยันบันทึก"
          />

          <DocumentToolbar>
            <Button
              type="submit"
              isLoading={createMutation.isPending}
              disabled={!canSubmit || createMutation.isPending}
            >
              บันทึก
            </Button>
            <Button type="button" variant="secondary" onClick={() => navigate('/expenses')}>
              ยกเลิก
            </Button>
          </DocumentToolbar>
        </div>
      </form>

      {createMutation.isError ? (
        <Alert variant="danger" className="mt-3">
          <div className="fw-semibold mb-1">สร้างรายจ่ายไม่สำเร็จ</div>
          <div className="small">{createMutation.error instanceof Error ? createMutation.error.message : 'Unknown error'}</div>
        </Alert>
      ) : null}

      {productsQuery.isLoading && productSearchDebounced ? (
        <div className="d-flex align-items-center gap-2 mt-3 small text-muted">
          <Spinner size="sm" animation="border" />
          กำลังโหลดสินค้า...
        </div>
      ) : null}
    </DocumentPageLayout>
  )
}

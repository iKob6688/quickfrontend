import { useEffect, useMemo, useState } from 'react'
import { Modal, Form } from 'react-bootstrap'
import { Button } from '@/components/ui/Button'
import type { RegisterPaymentPayload, UpdatePaymentPayload } from '@/api/services/invoices.service'

interface Props {
  open: boolean
  onClose: () => void
  onSubmit: (payload: RegisterPaymentPayload | UpdatePaymentPayload) => Promise<void> | void
  defaultAmount?: number
  maxAmount?: number
  currency?: string
  title?: string
  submitLabel?: string
  initialDate?: string
  initialMethod?: string
  initialReference?: string
  allowAmountEdit?: boolean
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function RegisterPaymentModal({
  open,
  onClose,
  onSubmit,
  defaultAmount,
  maxAmount,
  currency,
  title,
  submitLabel,
  initialDate,
  initialMethod,
  initialReference,
  allowAmountEdit = true,
}: Props) {
  const [amount, setAmount] = useState<string>('')
  const [date, setDate] = useState<string>(todayIso())
  const [method, setMethod] = useState<string>('manual')
  const [reference, setReference] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setIsSubmitting(false)
    setDate(initialDate || todayIso())
    setMethod(initialMethod || 'cash')
    setReference(initialReference || '')
    // Format amount to 2 decimal places if provided
    setAmount(
      defaultAmount != null
        ? defaultAmount.toFixed(2)
        : ''
    )
  }, [open, defaultAmount, initialDate, initialMethod, initialReference])

  const parsedAmount = useMemo(() => {
    const n = Number.parseFloat(amount)
    return Number.isFinite(n) ? n : NaN
  }, [amount])

  const handleSubmit = async () => {
    setError(null)
    if (allowAmountEdit && (!Number.isFinite(parsedAmount) || parsedAmount <= 0)) {
      setError('กรุณาระบุจำนวนเงินที่ถูกต้อง')
      return
    }
    if (allowAmountEdit && maxAmount != null && parsedAmount - maxAmount > 0.00001) {
      setError('จำนวนเงินรับชำระต้องไม่เกินยอดคงเหลือ')
      return
    }
    if (!date) {
      setError('กรุณาระบุวันที่ชำระเงิน')
      return
    }

    setIsSubmitting(true)
    try {
      if (allowAmountEdit) {
        await onSubmit({
          amount: parsedAmount,
          date,
          method,
          reference: reference.trim() || undefined,
        })
      } else {
        await onSubmit({
          date,
          method,
          reference: reference.trim() || undefined,
        })
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal show={open} onHide={onClose} centered>
      <Modal.Header closeButton>
        <Modal.Title className="h6 fw-semibold mb-0">
          {title || `รับชำระเงิน ${currency ? `(${currency})` : ''}`}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && (
          <div className="alert alert-danger small mb-3">
            {error}
          </div>
        )}

        <Form>
          {allowAmountEdit ? (
            <div className="mb-3">
              <Form.Label className="small fw-semibold">จำนวนเงิน</Form.Label>
              <Form.Control
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                min={0}
                step="0.01"
              />
              {maxAmount != null ? (
                <div className="form-text">
                  ยอดคงเหลือ {maxAmount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency || ''}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mb-3">
            <Form.Label className="small fw-semibold">วันที่ชำระเงิน</Form.Label>
            <Form.Control
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="mb-3">
            <Form.Label className="small fw-semibold">วิธีชำระเงิน</Form.Label>
            <Form.Select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="cash">เงินสด</option>
              <option value="bank">โอนเงิน</option>
              <option value="card">บัตร</option>
              <option value="manual">อื่นๆ</option>
            </Form.Select>
            <div className="form-text">
              ระบบจะพยายามเลือก journal ฝั่ง Odoo ให้สอดคล้องกับวิธีที่เลือกมากที่สุด
            </div>
          </div>

          <div className="mb-0">
            <Form.Label className="small fw-semibold">อ้างอิง (ถ้ามี)</Form.Label>
            <Form.Control
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="เช่น เลขที่สลิป/Ref ธนาคาร"
            />
          </div>
        </Form>
      </Modal.Body>
      <Modal.Footer className="d-flex gap-2">
        <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
          ยกเลิก
        </Button>
        <Button onClick={handleSubmit} isLoading={isSubmitting}>
          {submitLabel || 'บันทึกการชำระเงิน'}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}

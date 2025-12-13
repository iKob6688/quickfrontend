import { useEffect, useMemo, useState } from 'react'
import { Modal, Form } from 'react-bootstrap'
import { Button } from '@/components/ui/Button'
import type { RegisterPaymentPayload } from '@/api/services/invoices.service'

interface Props {
  open: boolean
  onClose: () => void
  onSubmit: (payload: RegisterPaymentPayload) => Promise<void> | void
  defaultAmount?: number
  currency?: string
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function RegisterPaymentModal({
  open,
  onClose,
  onSubmit,
  defaultAmount,
  currency,
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
    setDate(todayIso())
    setMethod('manual')
    setReference('')
    setAmount(defaultAmount != null ? String(defaultAmount) : '')
  }, [open, defaultAmount])

  const parsedAmount = useMemo(() => {
    const n = Number.parseFloat(amount)
    return Number.isFinite(n) ? n : NaN
  }, [amount])

  const handleSubmit = async () => {
    setError(null)
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('กรุณาระบุจำนวนเงินที่ถูกต้อง')
      return
    }
    if (!date) {
      setError('กรุณาระบุวันที่ชำระเงิน')
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit({
        amount: parsedAmount,
        date,
        method,
        reference: reference.trim() || undefined,
      })
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
          รับชำระเงิน {currency ? `(${currency})` : ''}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && (
          <div className="alert alert-danger small mb-3">
            {error}
          </div>
        )}

        <Form>
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
          </div>

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
              <option value="manual">Manual</option>
              <option value="cash">Cash</option>
              <option value="bank">Bank Transfer</option>
              <option value="card">Card</option>
            </Form.Select>
            <div className="form-text">
              ฝั่ง Odoo จะเป็นผู้ตัดสินใจ workflow การชำระเงินจริง
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
          บันทึกการชำระเงิน
        </Button>
      </Modal.Footer>
    </Modal>
  )
}



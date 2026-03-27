import { useEffect, useMemo, useState } from 'react'
import { Modal, Form } from 'react-bootstrap'
import { Button } from '@/components/ui/Button'
import type { RegisterPaymentPayload, UpdatePaymentPayload, WhtOption } from '@/api/services/invoices.service'

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
  enableWht?: boolean
  whtOptions?: WhtOption[]
  defaultWhtCode?: string | null
  currencyPrecision?: number
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
  enableWht = false,
  whtOptions = [],
  defaultWhtCode,
  currencyPrecision = 2,
}: Props) {
  const [amount, setAmount] = useState<string>('')
  const [date, setDate] = useState<string>(todayIso())
  const [method, setMethod] = useState<string>('manual')
  const [reference, setReference] = useState<string>('')
  const [whtCode, setWhtCode] = useState<string>('none')
  const [isCustomWhtAmount, setIsCustomWhtAmount] = useState(false)
  const [customWhtAmount, setCustomWhtAmount] = useState<string>('0')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setIsSubmitting(false)
    setDate(initialDate || todayIso())
    setMethod(initialMethod || 'cash')
    setReference(initialReference || '')
    setWhtCode(defaultWhtCode || whtOptions[0]?.code || 'none')
    setIsCustomWhtAmount(false)
    setCustomWhtAmount('0')
    // Format amount to 2 decimal places if provided
    setAmount(
      defaultAmount != null
        ? defaultAmount.toFixed(2)
        : ''
    )
  }, [open, defaultAmount, initialDate, initialMethod, initialReference, defaultWhtCode, whtOptions])

  const parsedAmount = useMemo(() => {
    const n = Number.parseFloat(amount)
    return Number.isFinite(n) ? n : NaN
  }, [amount])

  const selectedWht = useMemo(
    () => whtOptions.find((option) => option.code === whtCode),
    [whtCode, whtOptions],
  )

  const whtRate = enableWht && selectedWht ? selectedWht.rate : 0
  const autoWhtAmount = Number.isFinite(parsedAmount) && parsedAmount > 0 ? (parsedAmount * whtRate) / 100 : 0
  const parsedCustomWhtAmount = Number.parseFloat(customWhtAmount)
  const whtAmount = isCustomWhtAmount
    ? Number.isFinite(parsedCustomWhtAmount)
      ? parsedCustomWhtAmount
      : NaN
    : autoWhtAmount
  const netAmount =
    Number.isFinite(parsedAmount) && Number.isFinite(whtAmount)
      ? Math.max(0, parsedAmount - whtAmount)
      : NaN

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
    if (allowAmountEdit && enableWht) {
      if (!Number.isFinite(whtAmount) || whtAmount < 0) {
        setError('ยอดหัก ณ ที่จ่ายไม่ถูกต้อง')
        return
      }
      if (whtAmount - parsedAmount > 0.00001) {
        setError('ยอดหัก ณ ที่จ่ายต้องไม่เกินยอดก่อนหัก')
        return
      }
      if (!Number.isFinite(netAmount) || netAmount < 0) {
        setError('ยอดรับสุทธิไม่ถูกต้อง')
        return
      }
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
          grossAmount: parsedAmount,
          netAmount: enableWht ? netAmount : parsedAmount,
          whtCode: enableWht && selectedWht && selectedWht.code !== 'none' ? selectedWht.code : undefined,
          whtRate: enableWht && selectedWht ? selectedWht.rate : undefined,
          whtAmount: enableWht ? whtAmount : undefined,
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
              <Form.Label className="small fw-semibold">ยอดก่อนหัก</Form.Label>
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

          {allowAmountEdit && enableWht ? (
            <>
              <div className="mb-3">
                <Form.Label className="small fw-semibold">WHT code / อัตรา</Form.Label>
                <Form.Select value={whtCode} onChange={(e) => setWhtCode(e.target.value)}>
                  {whtOptions.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label} ({option.rate}%)
                    </option>
                  ))}
                </Form.Select>
                {selectedWht?.description ? <div className="form-text">{selectedWht.description}</div> : null}
              </div>

              <div className="mb-3">
                <Form.Label className="small fw-semibold">ยอดหัก ณ ที่จ่าย</Form.Label>
                <Form.Control
                  type="number"
                  value={isCustomWhtAmount ? customWhtAmount : autoWhtAmount.toFixed(currencyPrecision)}
                  onChange={(e) => setCustomWhtAmount(e.target.value)}
                  placeholder="0.00"
                  min={0}
                  step="0.01"
                  disabled={!isCustomWhtAmount}
                />
                <Form.Check
                  className="mt-2"
                  type="switch"
                  id="wht-custom-amount"
                  label="ปรับยอดหักเอง (Custom)"
                  checked={isCustomWhtAmount}
                  onChange={(e) => setIsCustomWhtAmount(e.target.checked)}
                />
              </div>

              <div className="mb-3 rounded border bg-light p-2">
                <div className="d-flex justify-content-between small">
                  <span className="text-muted">ยอดก่อนหัก</span>
                  <span className="font-monospace">
                    {Number.isFinite(parsedAmount) ? parsedAmount.toLocaleString('th-TH', { minimumFractionDigits: currencyPrecision, maximumFractionDigits: currencyPrecision }) : '0.00'} {currency || ''}
                  </span>
                </div>
                <div className="d-flex justify-content-between small">
                  <span className="text-muted">ยอดหัก ณ ที่จ่าย</span>
                  <span className="font-monospace text-danger">
                    {Number.isFinite(whtAmount) ? whtAmount.toLocaleString('th-TH', { minimumFractionDigits: currencyPrecision, maximumFractionDigits: currencyPrecision }) : '0.00'} {currency || ''}
                  </span>
                </div>
                <div className="d-flex justify-content-between small fw-semibold border-top pt-2 mt-2">
                  <span>ยอดรับสุทธิ</span>
                  <span className="font-monospace text-success">
                    {Number.isFinite(netAmount) ? netAmount.toLocaleString('th-TH', { minimumFractionDigits: currencyPrecision, maximumFractionDigits: currencyPrecision }) : '0.00'} {currency || ''}
                  </span>
                </div>
              </div>
            </>
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

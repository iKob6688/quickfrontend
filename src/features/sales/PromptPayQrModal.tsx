import { useEffect, useMemo, useState } from 'react'
import { Form, Modal } from 'react-bootstrap'
import { Button } from '@/components/ui/Button'
import { buildPromptPayPayload, buildPromptPayQrImageUrl, validatePromptPayTarget } from '@/lib/promptpay'
import { toast } from '@/lib/toastStore'

const STORAGE_KEY = 'qf:payments:promptpay-target'

interface Props {
  open: boolean
  onClose: () => void
  defaultAmount?: number
  reference?: string
  customerName?: string
}

export function PromptPayQrModal({ open, onClose, defaultAmount, reference, customerName }: Props) {
  const [target, setTarget] = useState('')
  const [amount, setAmount] = useState('')

  useEffect(() => {
    if (!open) return
    const saved = localStorage.getItem(STORAGE_KEY) || ''
    setTarget(saved)
    setAmount(typeof defaultAmount === 'number' && Number.isFinite(defaultAmount) ? defaultAmount.toFixed(2) : '')
  }, [open, defaultAmount])

  const amountNumber = useMemo(() => {
    const n = Number.parseFloat(amount)
    return Number.isFinite(n) && n > 0 ? n : undefined
  }, [amount])

  const targetError = validatePromptPayTarget(target)
  const payload = !targetError ? buildPromptPayPayload({ target, amount: amountNumber }) : null
  const qrUrl = payload ? buildPromptPayQrImageUrl(payload, 320) : null

  const handleSave = () => {
    if (targetError || !payload) {
      toast.error('สร้าง PromptPay QR ไม่สำเร็จ', targetError || 'ข้อมูลไม่ถูกต้อง')
      return
    }
    localStorage.setItem(STORAGE_KEY, target)
    toast.success('พร้อมใช้งาน PromptPay QR')
  }

  const copyPayload = async () => {
    if (!payload) return
    await navigator.clipboard.writeText(payload)
    toast.success('คัดลอก payload แล้ว')
  }

  return (
    <Modal show={open} onHide={onClose} centered size="lg">
      <Modal.Header closeButton>
        <Modal.Title className="h6 fw-semibold mb-0">PromptPay QR รับชำระเงิน</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="row g-3">
          <div className="col-lg-5">
            <Form.Group className="mb-3">
              <Form.Label className="small fw-semibold">PromptPay (มือถือ / เลขผู้เสียภาษี)</Form.Label>
              <Form.Control
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="เช่น 08x-xxx-xxxx หรือ 010xxxxxxxxxx"
              />
              {targetError ? <div className="text-danger small mt-1">{targetError}</div> : null}
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label className="small fw-semibold">จำนวนเงิน</Form.Label>
              <Form.Control
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
              <div className="form-text">ปล่อยว่างเพื่อสร้าง QR แบบระบุยอดภายหลัง</div>
            </Form.Group>

            <div className="small text-muted">
              <div>อ้างอิง: {reference || '—'}</div>
              <div>ลูกค้า: {customerName || '—'}</div>
            </div>

            {payload ? (
              <div className="mt-3">
                <div className="small text-muted mb-1">EMV Payload</div>
                <textarea className="form-control form-control-sm font-monospace" rows={4} value={payload} readOnly />
              </div>
            ) : null}
          </div>

          <div className="col-lg-7">
            <div className="border rounded p-3 h-100 d-flex flex-column align-items-center justify-content-center bg-light-subtle">
              {qrUrl ? (
                <>
                  <img src={qrUrl} alt="PromptPay QR" style={{ width: 320, height: 320, objectFit: 'contain' }} />
                  <div className="small text-muted mt-2">ให้ลูกค้าสแกน QR เพื่อชำระเงิน</div>
                </>
              ) : (
                <div className="text-muted small">กรอก PromptPay และจำนวนเงินเพื่อสร้าง QR</div>
              )}
            </div>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer className="d-flex gap-2">
        <Button variant="secondary" onClick={onClose}>ปิด</Button>
        <Button variant="secondary" onClick={() => void copyPayload()} disabled={!payload}>คัดลอก Payload</Button>
        <Button onClick={handleSave} disabled={!payload}>บันทึกค่า/ใช้งาน</Button>
      </Modal.Footer>
    </Modal>
  )
}


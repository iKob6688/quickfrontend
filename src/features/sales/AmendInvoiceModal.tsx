import { useEffect, useState, type FormEvent } from 'react'
import { Modal, Form, Alert } from 'react-bootstrap'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Label'
import { Input } from '@/components/ui/Input'

interface Props {
  open: boolean
  onClose: () => void
  onSubmit: (reason: string) => Promise<void>
  isSubmitting?: boolean
}

export function AmendInvoiceModal({ open, onClose, onSubmit, isSubmitting }: Props) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setReason('')
      setError(null)
    }
  }, [open])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!reason.trim()) {
      setError('กรุณาระบุเหตุผลในการแก้ไข (Audit trail)')
      return
    }
    try {
      await onSubmit(reason.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ทำรายการไม่สำเร็จ')
    }
  }

  return (
    <Modal show={open} onHide={onClose} centered>
      <Modal.Header closeButton>
        <Modal.Title className="h6 fw-semibold mb-0">แก้ไขใบแจ้งหนี้ (Amend)</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="small text-muted mb-3">
          ใบแจ้งหนี้ที่ “ยืนยันแล้ว” แก้ไขตรง ๆ ไม่ได้ตามหลักบัญชี ระบบจะสร้าง <b>credit note</b> และสร้าง <b>ใบใหม่ (draft)</b> ให้คุณแก้ไขแทน
        </p>

        {error ? (
          <Alert variant="danger" className="small py-2">
            {error}
          </Alert>
        ) : null}

        <Form onSubmit={submit}>
          <div className="mb-3">
            <Label htmlFor="amendReason" required>
              เหตุผลในการแก้ไข
            </Label>
            <Input
              id="amendReason"
              value={reason}
              onChange={(e) => setReason(String(e.target.value))}
              placeholder="เช่น แก้ชื่อสินค้า/แก้จำนวน/แก้ราคาผิด"
            />
          </div>

          <div className="d-flex justify-content-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
              ยกเลิก
            </Button>
            <Button type="submit" isLoading={Boolean(isSubmitting)}>
              สร้างฉบับแก้ไข
            </Button>
          </div>
        </Form>
      </Modal.Body>
    </Modal>
  )
}



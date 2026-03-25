import { useEffect, useMemo, useState } from 'react'
import { Modal, Alert } from 'react-bootstrap'
import { Button } from '@/components/ui/Button'
import { NoteLinesEditor, type NoteLineInput } from '@/components/notes/NoteLinesEditor'

export type CreateNoteMode = 'full' | 'delta'

export function CreateNoteModal({
  open,
  onClose,
  kind,
  initialReason = '',
  initialMode,
  initialLines,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  kind: 'credit' | 'debit'
  initialReason?: string
  initialMode?: CreateNoteMode
  initialLines?: NoteLineInput[]
  onSubmit: (payload: { reason: string; mode: CreateNoteMode; lines: NoteLineInput[] }) => Promise<void>
}) {
  const defaultMode: CreateNoteMode = useMemo(() => {
    if (kind === 'debit') return 'delta'
    return initialMode ?? 'full'
  }, [initialMode, kind])

  const [reason, setReason] = useState(initialReason)
  const [mode, setMode] = useState<CreateNoteMode>(defaultMode)
  const [lines, setLines] = useState<NoteLineInput[]>(initialLines || [])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setReason(initialReason)
    setMode(defaultMode)
    setLines(initialLines || [])
    setSubmitting(false)
    setError(null)
  }, [open, initialReason, defaultMode, initialLines])

  const mustHaveLines = kind === 'debit' || mode === 'delta'

  const title =
    kind === 'credit'
      ? 'สร้าง Credit Note (ใบลดหนี้)'
      : 'สร้าง Debit Note (ใบเพิ่มหนี้)'

  return (
    <Modal show={open} onHide={onClose} centered size="lg">
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error ? (
          <Alert variant="danger" className="small">
            {error}
          </Alert>
        ) : null}

        <div className="mb-3">
          <label className="form-label small text-muted">เหตุผล (Reason)</label>
          <input
            className="form-control"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="เช่น แก้ไขยอด / ค่าบริการเพิ่ม / คืนสินค้า"
          />
        </div>

        {kind === 'credit' ? (
          <div className="mb-3">
            <label className="form-label small text-muted">รูปแบบ</label>
            <div className="d-flex gap-2 flex-wrap">
              <button
                type="button"
                className={`btn btn-sm ${mode === 'full' ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => setMode('full')}
              >
                Full (ย้อนทั้งใบ)
              </button>
              <button
                type="button"
                className={`btn btn-sm ${mode === 'delta' ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => setMode('delta')}
              >
                Delta (ระบุรายการ)
              </button>
            </div>
            <div className="small text-muted mt-1">
              แนะนำ: Full สำหรับแก้ไขทั้งใบ, Delta สำหรับลดหนี้บางรายการ
            </div>
          </div>
        ) : null}

        {mustHaveLines ? (
          <div className="mt-3">
            <NoteLinesEditor lines={lines} setLines={setLines} />
          </div>
        ) : (
          <div className="alert alert-info small mb-0">
            Full credit note จะสร้างใบลดหนี้จากข้อมูลในใบต้นฉบับโดยอัตโนมัติ
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          ยกเลิก
        </Button>
        <Button
          onClick={async () => {
            const r = (reason || '').trim()
            if (!r) {
              setError('กรุณาระบุเหตุผล')
              return
            }
            if (mustHaveLines && (!lines || lines.length === 0)) {
              setError('กรุณาเพิ่มอย่างน้อย 1 รายการ')
              return
            }
            setSubmitting(true)
            setError(null)
            try {
              await onSubmit({ reason: r, mode, lines })
              onClose()
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e))
            } finally {
              setSubmitting(false)
            }
          }}
          isLoading={submitting}
        >
          สร้างเอกสาร
        </Button>
      </Modal.Footer>
    </Modal>
  )
}


import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import type { EtaxInvoiceSummary } from '@/api/services/etax.service'

type Props = {
  summary?: EtaxInvoiceSummary | null
  submitting?: boolean
  onSubmit?: () => void | Promise<void>
  onOpenPrimary?: () => void
  onPoll?: () => void | Promise<void>
  onSendEmail?: () => void | Promise<void>
  primaryLabel?: string
}

function statusTone(summary?: EtaxInvoiceSummary | null) {
  const state = summary?.document?.state
  if (state === 'done') return 'green'
  if (state === 'error') return 'red'
  if (state === 'processing') return 'amber'
  if (state === 'submitted' || state === 'queued') return 'blue'
  return 'gray'
}

function statusLabel(summary?: EtaxInvoiceSummary | null) {
  const state = summary?.document?.state
  if (state === 'done') return 'Done'
  if (state === 'error') return 'Error'
  if (state === 'processing') return 'Processing'
  if (state === 'submitted') return 'Submitted'
  if (state === 'queued') return 'Queued'
  if (summary?.currentStep === 'not_configured') return 'Not configured'
  if (summary?.currentStep === 'ready_to_submit') return 'Ready'
  return 'Draft'
}

function buildPrimaryHint(summary?: EtaxInvoiceSummary | null) {
  const step = summary?.currentStep
  if (step === 'not_configured') return 'ยังไม่มี active e-Tax configuration ให้เริ่มจาก Settings ก่อน'
  if (step === 'needs_configuration') return 'มี configuration แล้ว แต่ยังไม่พร้อมส่ง e-Tax ต้องตรวจ readiness ใน Settings ก่อน'
  if (step === 'needs_source_posting') return 'เอกสารต้นทางยังไม่ถูกโพสต์ จึงยังส่ง e-Tax ไม่ได้'
  if (step === 'ready_to_submit') return 'พร้อมสร้างและส่ง e-Tax จากใบงานนี้แล้ว'
  if (step === 'completed') return 'เอกสาร e-Tax สำเร็จแล้ว เปิดไฟล์ลงนามหรือส่งอีเมลต่อได้'
  if (step === 'needs_attention') return 'มี e-Tax document แล้ว แต่ต้องเข้า workspace เพื่อตรวจสอบและแก้ไข'
  return 'มี e-Tax document อยู่แล้ว สามารถติดตามต่อจาก workspace ได้'
}

function nextStepLabel(summary?: EtaxInvoiceSummary | null) {
  const action = summary?.nextRecommendedAction
  if (action === 'open_settings') return 'เปิด Settings เพื่อตรวจ config'
  if (action === 'submit') return 'กด Submit e-Tax จากใบงานนี้'
  if (action === 'open_workspace') return 'เปิด Workspace เพื่อติดตามสถานะและจัดการเอกสาร'
  if (action === 'post_source_document') return 'โพสต์เอกสารต้นทางก่อน'
  return 'ตรวจสอบสถานะเอกสาร'
}

export function EtaxWorkflowCard({
  summary,
  submitting,
  onSubmit,
  onOpenPrimary,
  onPoll,
  onSendEmail,
  primaryLabel,
}: Props) {
  const document = summary?.document
  const available = document?.availableNextActions || []
  const canSubmit = Boolean(summary?.canSubmit && !submitting && (!document || available.includes('submit')))
  const canPoll = Boolean(document && available.includes('poll'))
  const canSendEmail = Boolean(
    document &&
      document.hasPdfAttachment &&
      document.state === 'done' &&
      onSendEmail,
  )
  const label =
    primaryLabel ||
    (summary?.currentStep === 'not_configured' || summary?.currentStep === 'needs_configuration'
      ? 'Open e-Tax Settings'
      : 'Open e-Tax Workspace')

  return (
    <Card className="p-4 mb-4">
      <div className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3">
        <div>
          <div className="qf-section-title mb-2">e-Tax</div>
          <div className="d-flex align-items-center gap-2 flex-wrap mb-2">
            <Badge tone={statusTone(summary)}>{statusLabel(summary)}</Badge>
            <span className="text-muted small">
              {summary?.documentTypeLabel || 'เอกสารนี้'} · {buildPrimaryHint(summary)}
            </span>
          </div>
          <div className="small text-muted">
            {document
              ? `ETax ${document.name} · INET ${document.inetStatus || '—'} · Email ${document.emailState || 'not_applicable'}`
              : summary?.currentStep === 'not_configured'
                ? 'ยังไม่มี config สำหรับสร้าง ETax document'
                : 'ยังไม่มี ETax document สำหรับเอกสารนี้'}
          </div>
          {document?.addressValidationMessage ? (
            <div className="small text-warning mt-1">{document.addressValidationMessage}</div>
          ) : null}
          {document?.emailLastError ? (
            <div className="small text-danger mt-1">{document.emailLastError}</div>
          ) : null}
        </div>
        <div className="d-flex align-items-center gap-2 flex-wrap justify-content-lg-end">
          {canSubmit ? (
            <Button size="sm" className="text-nowrap" onClick={onSubmit} isLoading={submitting} disabled={!canSubmit}>
              Submit e-Tax
            </Button>
          ) : null}
          <Button size="sm" variant="secondary" className="text-nowrap" onClick={onOpenPrimary}>
            {label}
          </Button>
          {canPoll ? (
            <Button size="sm" variant="ghost" className="text-nowrap" onClick={onPoll}>
              Poll Status
            </Button>
          ) : null}
          {canSendEmail ? (
            <Button size="sm" variant="ghost" className="text-nowrap" onClick={onSendEmail}>
              {document?.emailState === 'sent' ? 'Resend Email' : 'Send Email'}
            </Button>
          ) : null}
        </div>
      </div>
      <div className="small text-muted mt-3">
        Next step: <span className="fw-semibold">{nextStepLabel(summary)}</span>
      </div>
    </Card>
  )
}

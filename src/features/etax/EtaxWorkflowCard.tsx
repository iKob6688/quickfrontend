import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import type { EtaxInvoiceSummary, EtaxRuntimeConfig } from '@/api/services/etax.service'

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
  if (summary?.currentStep === 'ready_to_submit') return 'green'
  if (summary?.currentStep === 'not_configured' || summary?.currentStep === 'needs_configuration') return 'gray'
  return 'gray'
}

function statusLabel(summary?: EtaxInvoiceSummary | null) {
  const state = summary?.document?.state
  if (state === 'done') return 'สำเร็จแล้ว'
  if (state === 'error') return 'ต้องตรวจสอบ'
  if (state === 'processing') return 'กำลังดำเนินการ'
  if (state === 'submitted' || state === 'queued') return 'กำลังดำเนินการ'
  if (summary?.currentStep === 'ready_to_submit') return 'พร้อมส่ง'
  if (summary?.currentStep === 'not_configured' || summary?.currentStep === 'needs_configuration') return 'ยังไม่ตั้งค่า'
  if (summary?.currentStep === 'needs_source_posting') return 'ต้องโพสต์เอกสารก่อน'
  return 'ร่าง'
}

function buildPrimaryHint(summary?: EtaxInvoiceSummary | null) {
  const step = summary?.currentStep
  const label = summary?.documentTypeLabel || 'เอกสารนี้'
  if (step === 'not_configured') return `${label} ยังไม่พร้อม เพราะยังไม่มี active e-Tax configuration`
  if (step === 'needs_configuration') return `${label} ยังต้องตรวจสอบความพร้อมของ e-Tax configuration ก่อนส่ง`
  if (step === 'needs_source_posting') return `${label} ต้องโพสต์เอกสารต้นทางก่อน จึงจะส่ง e-Tax ได้`
  if (step === 'ready_to_submit') return `${label} พร้อมสร้างและส่ง e-Tax แล้ว`
  if (step === 'completed') return `${label} ส่ง e-Tax สำเร็จแล้ว สามารถติดตามไฟล์ลงนามหรือส่งอีเมลต่อได้`
  if (step === 'needs_attention') return `${label} มี e-Tax document แล้ว แต่ควรเข้า workspace เพื่อตรวจสอบต่อ`
  return `${label} มี e-Tax document แล้ว และกำลังอยู่ในขั้นตอนติดตามผล`
}

function nextStepLabel(summary?: EtaxInvoiceSummary | null) {
  const action = summary?.nextRecommendedAction
  if (action === 'open_settings') return 'เปิดหน้า Settings เพื่อตรวจสอบการตั้งค่า e-Tax'
  if (action === 'submit') return 'กดส่ง e-Tax จากเอกสารนี้'
  if (action === 'open_workspace') return 'เปิด e-Tax Workspace เพื่อติดตามสถานะและจัดการเอกสาร'
  if (action === 'post_source_document') return 'โพสต์เอกสารต้นทางก่อน'
  return 'ตรวจสอบสถานะเอกสาร'
}

function formatRuntime(runtime?: EtaxRuntimeConfig | null) {
  if (!runtime) return '—'
  const parts = [runtime.submissionMode, runtime.csvPayloadStyle].filter(Boolean)
  return parts.length ? parts.join(' · ') : '—'
}

function documentMetaLine(summary?: EtaxInvoiceSummary | null) {
  const document = summary?.document
  if (!document) {
    if (summary?.currentStep === 'not_configured' || summary?.currentStep === 'needs_configuration') {
      return 'ยังไม่มี ETax document สำหรับเอกสารนี้'
    }
    return 'ยังไม่มี ETax document ให้เริ่มจากปุ่มหลักของการ์ดนี้'
  }
  return `ETax ${document.name} · INET ${document.inetStatus || '—'} · อีเมล ${document.emailState || 'not_applicable'}`
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
  const canPoll = Boolean(document && available.includes('poll') && onPoll)
  const canSendEmail = Boolean(
    document &&
      document.hasPdfAttachment &&
      document.state === 'done' &&
      onSendEmail &&
      (document.canSendEmail || document.canResendEmail),
  )
  const label =
    primaryLabel ||
    (summary?.currentStep === 'not_configured' || summary?.currentStep === 'needs_configuration'
      ? 'ตั้งค่า e-Tax'
      : summary?.currentStep === 'completed' || summary?.currentStep === 'in_progress' || summary?.currentStep === 'needs_attention'
        ? 'ติดตามเอกสาร e-Tax'
        : 'เปิด e-Tax Workspace')

  const effectiveRuntime = summary?.effectiveRuntime || document?.effectiveRuntime || null
  const storedConfig = summary?.storedConfig || document?.storedConfig || null
  const runtimeOverrideActive = Boolean(summary?.runtimeOverrideActive || document?.runtimeOverrideActive)

  return (
    <Card className="p-4 mb-4">
      <div className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3">
        <div>
          <div className="qf-section-title mb-2">e-Tax</div>
          <div className="d-flex align-items-center gap-2 flex-wrap mb-2">
            <Badge tone={statusTone(summary)}>{statusLabel(summary)}</Badge>
            {runtimeOverrideActive ? <Badge tone="amber">Runtime override active</Badge> : null}
            <span className="text-muted small">{buildPrimaryHint(summary)}</span>
          </div>
          <div className="small text-muted">{documentMetaLine(summary)}</div>
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
              ส่ง e-Tax
            </Button>
          ) : null}
          <Button size="sm" variant={canSubmit ? 'secondary' : 'primary'} className="text-nowrap" onClick={onOpenPrimary}>
            {label}
          </Button>
          {canPoll ? (
            <Button size="sm" variant="ghost" className="text-nowrap" onClick={onPoll}>
              อัปเดตสถานะ
            </Button>
          ) : null}
          {canSendEmail ? (
            <Button size="sm" variant="ghost" className="text-nowrap" onClick={onSendEmail}>
              {document?.emailState === 'sent' ? 'ส่งอีเมลอีกครั้ง' : 'ส่งอีเมลเอกสาร'}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="small text-muted mt-3">
        ขั้นตอนถัดไป: <span className="fw-semibold">{nextStepLabel(summary)}</span>
      </div>

      <div className="mt-3 rounded-3 border bg-light p-3">
        <div className="small fw-semibold mb-2">ข้อมูลการทำงานจริงของระบบ</div>
        <div className="small text-muted">
          Effective runtime: <span className="font-monospace">{formatRuntime(effectiveRuntime)}</span>
        </div>
        {runtimeOverrideActive ? (
          <div className="small text-muted mt-1">
            Stored configuration: <span className="font-monospace">{formatRuntime(storedConfig)}</span>
          </div>
        ) : null}
        {runtimeOverrideActive ? (
          <div className="small text-muted mt-2">
            ระบบ production บังคับใช้ runtime ที่ปลอดภัยกว่าในการส่งจริง แม้ค่าที่เก็บไว้ใน config จะยังเป็นค่าเดิม
          </div>
        ) : null}
      </div>
    </Card>
  )
}

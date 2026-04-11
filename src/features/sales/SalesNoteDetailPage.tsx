import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Spinner } from 'react-bootstrap'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { toast } from '@/lib/toastStore'
import { useSettingsStore as useStudioSettingsStore } from '@/app/core/storage/settingsStore'
import { cancelSalesNote, getSalesNote, postSalesNote, type SalesNoteDetail } from '@/api/services/sales-notes.service'
import { EtaxWorkflowCard } from '@/features/etax/EtaxWorkflowCard'
import { getInvoiceEtax, pollEtaxDocument, resendEtaxDocumentEmail, sendEtaxDocumentEmail, submitInvoiceEtax } from '@/api/services/etax.service'

const FALLBACK_TPL_SALES_CREDIT = 'sales_credit_note_default_v1'
const FALLBACK_TPL_SALES_DEBIT = 'sales_debit_note_default_v1'

export function SalesNoteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const studioSettings = useStudioSettingsStore((s) => s.settings)
  const noteId = id ? Number.parseInt(id, 10) : null

  const { data: note, isLoading, error } = useQuery({
    queryKey: ['salesNote', noteId],
    queryFn: () => getSalesNote(noteId!),
    enabled: !!noteId,
  })

  const etaxQuery = useQuery({
    queryKey: ['sales-note-etax', noteId],
    queryFn: () => getInvoiceEtax(noteId!),
    enabled: !!noteId,
    staleTime: 10_000,
  })

  const postMutation = useMutation({
    mutationFn: () => postSalesNote(noteId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salesNote', noteId] })
      queryClient.invalidateQueries({ queryKey: ['salesNotes'] })
      toast.success('โพสต์เอกสารสำเร็จ')
    },
    onError: (err) => toast.error('โพสต์เอกสารไม่สำเร็จ', err instanceof Error ? err.message : undefined),
  })

  const cancelMutation = useMutation({
    mutationFn: () => cancelSalesNote(noteId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salesNote', noteId] })
      queryClient.invalidateQueries({ queryKey: ['salesNotes'] })
      toast.success('ยกเลิกเอกสารสำเร็จ')
    },
    onError: (err) => toast.error('ยกเลิกเอกสารไม่สำเร็จ', err instanceof Error ? err.message : undefined),
  })

  const etaxSubmitMutation = useMutation({
    mutationFn: async () => {
      if (!noteId) throw new Error('Missing note id')
      return await submitInvoiceEtax(noteId)
    },
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['salesNote', noteId] })
      await queryClient.invalidateQueries({ queryKey: ['sales-note-etax', noteId] })
      await queryClient.invalidateQueries({ queryKey: ['etax'] })
      toast.success(
        'Submit e-Tax สำเร็จ',
        res.document?.name ? `ETax document: ${res.document.name}` : undefined,
      )
    },
    onError: (err) => {
      toast.error('Submit e-Tax ไม่สำเร็จ', err instanceof Error ? err.message : undefined)
    },
  })

  const templateId =
    (note?.noteType === 'credit'
      ? studioSettings.defaultTemplateIdByDocType?.sales_credit_note
      : studioSettings.defaultTemplateIdByDocType?.sales_debit_note) ||
    (note?.noteType === 'credit' ? FALLBACK_TPL_SALES_CREDIT : FALLBACK_TPL_SALES_DEBIT)

  const etaxDocument = etaxQuery.data?.document
  const etaxCurrentStep = etaxQuery.data?.currentStep || (etaxDocument ? 'in_progress' : 'not_configured')
  const etaxNextRoute =
    etaxQuery.data?.nextRecommendedRoute ||
    (etaxDocument?.id ? `/accounting/etax?documentId=${etaxDocument.id}` : '/accounting/etax')

  const openPrint = (mode: 'print' | 'pdf' | 'edit') => {
    if (!note) return
    if (mode === 'edit') {
      window.open(`/reports-studio/editor/${templateId}`, '_blank', 'noopener,noreferrer')
      return
    }
    if (mode === 'print') {
      window.open(`/reports-studio/print/${templateId}?recordId=${encodeURIComponent(String(note.id))}`, '_blank', 'noopener,noreferrer')
      return
    }
    window.open(`/reports-studio/preview/${templateId}?recordId=${encodeURIComponent(String(note.id))}&auto=pdf`, '_blank', 'noopener,noreferrer')
  }

  const lineColumns: Column<SalesNoteDetail['lines'][number]>[] = useMemo(
    () => [
      { key: 'description', header: 'รายละเอียด', cell: (l) => <span>{l.description}</span> },
      {
        key: 'qty',
        header: 'จำนวน',
        className: 'text-end',
        cell: (l) => <span className="font-monospace">{(l.quantity ?? 0).toLocaleString('th-TH')}</span>,
      },
      {
        key: 'unit',
        header: 'ราคาต่อหน่วย',
        className: 'text-end',
        cell: (l) => (
          <span className="font-monospace">
            {(l.unitPrice ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        ),
      },
      {
        key: 'subtotal',
        header: 'รวม',
        className: 'text-end',
        cell: (l) => (
          <span className="fw-semibold font-monospace">
            {(l.subtotal ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        ),
      },
    ],
    [],
  )

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center py-5">
        <Spinner animation="border" role="status" />
        <span className="ms-3">กำลังโหลดข้อมูล...</span>
      </div>
    )
  }

  if (error || !note) {
    return (
      <div>
        <PageHeader title="ไม่พบข้อมูล" subtitle="ไม่สามารถโหลดข้อมูลใบเพิ่ม/ลดหนี้ได้" />
        <Alert variant="danger" className="small">
          {error instanceof Error ? error.message : 'Unknown error'}
        </Alert>
        <Button onClick={() => navigate('/notes?domain=sales')}>กลับไปหน้ารายการ</Button>
      </div>
    )
  }

  const statusTone = note.status === 'paid' ? 'green' : note.status === 'posted' ? 'blue' : note.status === 'draft' ? 'gray' : 'red'
  const statusLabel = note.status === 'paid' ? 'รับชำระแล้ว' : note.status === 'posted' ? 'ยืนยันแล้ว' : note.status === 'draft' ? 'ร่าง' : 'ยกเลิก'

  return (
    <div>
      <PageHeader
        title={`${note.noteType === 'credit' ? 'Credit Note' : 'Debit Note'} ${note.number || `#${note.id}`}`}
        subtitle={note.partner?.name || '—'}
        breadcrumb="รายรับ · ใบเพิ่ม/ลดหนี้"
        actions={
          <div className="d-flex align-items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => navigate('/notes?domain=sales')}>
              กลับ
            </Button>
          </div>
        }
      />

      <Card className="p-4 mb-4">
        <div className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3">
          <div>
            <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
              <Badge tone={statusTone as any}>{statusLabel}</Badge>
              {note.noteType === 'credit' ? <Badge tone="red">Credit</Badge> : <Badge tone="blue">Debit</Badge>}
              <span className="text-muted small">อ้างอิง:</span>
              <span className="font-monospace">{note.originalMoveNumber || '—'}</span>
            </div>
            <div className="qf-kpi-value font-monospace">
              {(note.amountTotal ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
              <span className="qf-kpi-currency">{note.currency || 'THB'}</span>
            </div>
            <div className="small text-muted mt-2">
              ก่อนภาษี {(note.amountUntaxed ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} • ภาษี{' '}
              {(note.amountTax ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div className="d-flex gap-2 flex-wrap justify-content-lg-end">
            {note.status === 'draft' ? (
              <Button size="sm" onClick={() => postMutation.mutate()} isLoading={postMutation.isPending}>
                โพสต์
              </Button>
            ) : null}
            {note.status !== 'cancelled' ? (
              <Button size="sm" variant="secondary" onClick={() => cancelMutation.mutate()} isLoading={cancelMutation.isPending}>
                ยกเลิก
              </Button>
            ) : null}
            <Button size="sm" variant="secondary" onClick={() => openPrint('print')}>
              พิมพ์
            </Button>
            <Button size="sm" variant="secondary" onClick={() => openPrint('pdf')}>
              PDF
            </Button>
            <Button size="sm" variant="secondary" onClick={() => openPrint('edit')}>
              Template
            </Button>
          </div>
        </div>
      </Card>

      <EtaxWorkflowCard
        summary={etaxQuery.data}
        submitting={etaxSubmitMutation.isPending}
        onSubmit={async () => {
          await etaxSubmitMutation.mutateAsync()
        }}
        onOpenPrimary={() => navigate(etaxCurrentStep === 'not_configured' || etaxCurrentStep === 'needs_configuration' ? '/accounting/etax-settings' : etaxNextRoute)}
        onPoll={
          etaxDocument?.availableNextActions?.includes('poll')
            ? async () => {
                try {
                  await pollEtaxDocument(etaxDocument.id)
                  await queryClient.invalidateQueries({ queryKey: ['sales-note-etax', noteId] })
                  await queryClient.invalidateQueries({ queryKey: ['etax'] })
                  toast.success('Poll e-Tax สำเร็จ')
                } catch (err) {
                  toast.error('Poll e-Tax ไม่สำเร็จ', err instanceof Error ? err.message : undefined)
                }
              }
            : undefined
        }
        onSendEmail={
          etaxDocument
            ? async () => {
                try {
                  const res = etaxDocument.emailState === 'sent'
                    ? await resendEtaxDocumentEmail(etaxDocument.id)
                    : await sendEtaxDocumentEmail(etaxDocument.id)
                  await queryClient.invalidateQueries({ queryKey: ['sales-note-etax', noteId] })
                  await queryClient.invalidateQueries({ queryKey: ['etax'] })
                  toast.success(
                    res.emailState === 'sent' ? 'ส่ง e-Tax email สำเร็จ' : 'ส่ง e-Tax email แล้ว',
                    res.emailRecipient || undefined,
                  )
                } catch (err) {
                  toast.error('ส่ง e-Tax email ไม่สำเร็จ', err instanceof Error ? err.message : undefined)
                }
              }
            : undefined
        }
      />

      <DataTable title="รายการ" columns={lineColumns} rows={note.lines || []} />
    </div>
  )
}

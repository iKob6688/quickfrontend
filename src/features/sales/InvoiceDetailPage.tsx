import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getInvoice, postInvoice, registerPayment, updatePayment, openInvoicePdf, amendInvoice, getInvoicePaymentMeta, type RegisterPaymentPayload, type PaymentRecord, type UpdatePaymentPayload } from '@/api/services/invoices.service'
import { createSalesCreditNote, createSalesDebitNote } from '@/api/services/sales-notes.service'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Spinner, Alert, OverlayTrigger, Tooltip, Modal, ButtonGroup, Button as BootstrapButton } from 'react-bootstrap'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { RegisterPaymentModal } from '@/features/sales/RegisterPaymentModal'
import { AmendInvoiceModal } from '@/features/sales/AmendInvoiceModal'
import { PromptPayQrModal } from '@/features/sales/PromptPayQrModal'
import { CreateNoteModal } from '@/components/notes/CreateNoteModal'
import { useEffect, useState } from 'react'
import { toast } from '@/lib/toastStore'
import { useSettingsStore as useStudioSettingsStore } from '@/app/core/storage/settingsStore'
import { useAppDateFormatter } from '@/lib/dateFormat'

const FALLBACK_RS_TPL_TAX_FULL = 'receipt_full_default_v1'
const FALLBACK_RS_TPL_TAX_SHORT = 'receipt_short_default_v1'
const FALLBACK_RS_TPL_INVOICE = 'invoice_default_v1'

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [editingPayment, setEditingPayment] = useState<PaymentRecord | null>(null)
  const [amendOpen, setAmendOpen] = useState(false)
  const [creditNoteOpen, setCreditNoteOpen] = useState(false)
  const [debitNoteOpen, setDebitNoteOpen] = useState(false)
  const [promptPayOpen, setPromptPayOpen] = useState(false)
  const [printMenuOpen, setPrintMenuOpen] = useState(false)
  const studioSettings = useStudioSettingsStore((s) => s.settings)
  const formatDate = useAppDateFormatter()

  const invoiceId = id ? Number.parseInt(id, 10) : null
  const requestedAction = searchParams.get('action')
  const rsTplFull = studioSettings.defaultTemplateIdByDocType?.receipt_full || FALLBACK_RS_TPL_TAX_FULL
  const rsTplShort = studioSettings.defaultTemplateIdByDocType?.receipt_short || FALLBACK_RS_TPL_TAX_SHORT
  const rsTplInvoice = (studioSettings.defaultTemplateIdByDocType as any)?.invoice || FALLBACK_RS_TPL_INVOICE

  // When defaults are changed in another tab (e.g., Reports Studio editor),
  // Zustand in this tab won't update automatically. Rehydrate on focus/open.
  useEffect(() => {
    const rehydrate = () => {
      try {
        void (useStudioSettingsStore as any).persist?.rehydrate?.()
      } catch {
        // ignore
      }
    }
    const onFocus = () => rehydrate()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  useEffect(() => {
    if (!printMenuOpen) return
    try {
      void (useStudioSettingsStore as any).persist?.rehydrate?.()
    } catch {
      // ignore
    }
  }, [printMenuOpen])

  const {
    data: invoice,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: () => getInvoice(invoiceId!),
    enabled: !!invoiceId,
  })

  const paymentMetaQuery = useQuery({
    queryKey: ['invoicePaymentMeta', invoiceId],
    queryFn: () => getInvoicePaymentMeta(invoiceId || undefined),
    enabled: !!invoiceId && (invoice?.status === 'posted' || invoice?.status === 'paid'),
    staleTime: 60_000,
  })

  const invoicePayments = invoice?.payments || []
  const invoiceTotal = invoice?.total ?? 0
  const invoiceMarkedPaid = invoice?.paymentState === 'paid' || invoice?.status === 'paid'
  const invoiceAmountPaid =
    invoice?.amountPaid && invoice.amountPaid > 0
      ? invoice.amountPaid
      : invoicePayments.length > 0
        ? invoicePayments.reduce((sum, p) => sum + Number((p.appliedAmount ?? p.amount) || 0), 0)
        : invoiceMarkedPaid
          ? invoiceTotal
          : 0
  const invoiceAmountDue = Math.max(
    0,
    invoice?.amountDue !== undefined && invoice.amountDue >= 0
      ? invoice.amountDue
      : invoiceMarkedPaid
        ? 0
        : invoiceTotal - invoiceAmountPaid,
  )

  useEffect(() => {
    if (!requestedAction || !invoice) return
    if (
      requestedAction === 'payment' &&
      invoice.status === 'posted' &&
      invoiceAmountDue > 0
    ) {
      setPaymentOpen(true)
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.delete('action')
          return next
        },
        { replace: true },
      )
      return
    }
    if (requestedAction === 'receipt' && ((invoice.hasPaymentReceipt || invoice.hasFinalReceipt) || invoiceAmountPaid > 0)) {
      setPrintMenuOpen(true)
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.delete('action')
          return next
        },
        { replace: true },
      )
    }
  }, [
    requestedAction,
    invoice,
    invoiceAmountDue,
    invoiceAmountPaid,
    setSearchParams,
  ])

  const postMutation = useMutation({
    mutationFn: () => postInvoice(invoiceId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['invoices', 'receipts'] })
      toast.success('โพสต์ใบแจ้งหนี้สำเร็จ')
    },
    onError: (err) => {
      toast.error('โพสต์ใบแจ้งหนี้ไม่สำเร็จ', err instanceof Error ? err.message : undefined)
    },
  })

  const receiptRecordId = invoice && invoiceAmountPaid > 0 ? `invoice:${invoice.id}` : null

  const openReportsStudioPrint = (templateId: string) => {
    if (!receiptRecordId) {
      toast.error('ยังพิมพ์ใบเสร็จไม่ได้', 'ต้องมีรายการรับชำระเงินก่อน')
      return
    }
    toast.info('เปิดหน้าพิมพ์ (Reports Studio)', `Template: ${templateId}`)
    const url = `/reports-studio/print/${templateId}?recordId=${encodeURIComponent(receiptRecordId)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const openReportsStudioPdf = (templateId: string) => {
    if (!receiptRecordId) {
      toast.error('ยังสร้าง PDF ใบเสร็จไม่ได้', 'ต้องมีรายการรับชำระเงินก่อน')
      return
    }
    toast.info('เปิด PDF (Reports Studio)', `Template: ${templateId}`)
    // Open the print page directly to avoid the preview -> print double-tab hop.
    const url = `/reports-studio/print/${templateId}?recordId=${encodeURIComponent(receiptRecordId)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const openReportsStudioEdit = (templateId: string) => {
    const url = `/reports-studio/editor/${templateId}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const paymentMutation = useMutation({
    mutationFn: (payload: RegisterPaymentPayload) =>
      registerPayment(invoiceId!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['invoices', 'receipts'] })
      queryClient.invalidateQueries({ queryKey: ['taxReports'] })
      toast.success('บันทึกรับชำระเงินสำเร็จ')
    },
    onError: (err) => {
      toast.error('รับชำระเงินไม่สำเร็จ', err instanceof Error ? err.message : undefined)
    },
  })

  const paymentUpdateMutation = useMutation({
    mutationFn: ({ paymentId, payload }: { paymentId: number; payload: UpdatePaymentPayload }) =>
      updatePayment(invoiceId!, paymentId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['invoices', 'receipts'] })
      toast.success('แก้ไขข้อมูลการชำระเงินสำเร็จ')
    },
    onError: (err) => {
      toast.error('แก้ไขข้อมูลการชำระเงินไม่สำเร็จ', err instanceof Error ? err.message : undefined)
    },
  })

  const amendMutation = useMutation({
    mutationFn: async (reason: string) => {
      if (!invoiceId) throw new Error('Missing invoice id')
      if (!invoice) throw new Error('Missing invoice data')
      const today = new Date().toISOString().slice(0, 10)
      const newInvoice = {
        customerId: invoice.customerId,
        invoiceDate: invoice.invoiceDate || today,
        dueDate: invoice.dueDate || today,
        currency: invoice.currency || 'THB',
        notes: invoice.notes || '',
        lines: (invoice.lines || []).map((l) => ({
          productId: l.productId ?? null,
          description: l.description,
          quantity: l.quantity ?? 0,
          unitPrice: l.unitPrice ?? 0,
          taxRate: l.taxRate ?? 0,
          subtotal: l.subtotal ?? 0,
        })),
      }
      return await amendInvoice(invoiceId, { reason, mode: 'replace', newInvoice })
    },
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['invoices'] })
      toast.success('สร้างฉบับแก้ไขสำเร็จ')
      if (res.newInvoiceId) {
        navigate(`/sales/invoices/${res.newInvoiceId}/edit`)
      }
    },
    onError: (err) => {
      toast.error('สร้างฉบับแก้ไขไม่สำเร็จ', err instanceof Error ? err.message : undefined)
    },
  })

  const createCreditNoteMutation = useMutation({
    mutationFn: async (payload: { reason: string; mode: 'full' | 'delta'; lines: any[] }) => {
      if (!invoiceId) throw new Error('Missing invoice id')
      return await createSalesCreditNote(invoiceId, {
        reason: payload.reason,
        mode: payload.mode,
        ...(payload.mode === 'delta' ? { lines: payload.lines } : {}),
      })
    },
    onSuccess: async (res) => {
      const noteId = res.noteId
      toast.success('สร้าง Credit Note สำเร็จ')
      if (noteId) navigate(`/sales/notes/${noteId}`)
    },
    onError: (err) => toast.error('สร้าง Credit Note ไม่สำเร็จ', err instanceof Error ? err.message : undefined),
  })

  const createDebitNoteMutation = useMutation({
    mutationFn: async (payload: { reason: string; lines: any[] }) => {
      if (!invoiceId) throw new Error('Missing invoice id')
      return await createSalesDebitNote(invoiceId, {
        reason: payload.reason,
        lines: payload.lines,
      })
    },
    onSuccess: async (res) => {
      const noteId = res.noteId
      toast.success('สร้าง Debit Note สำเร็จ')
      if (noteId) navigate(`/sales/notes/${noteId}`)
    },
    onError: (err) => toast.error('สร้าง Debit Note ไม่สำเร็จ', err instanceof Error ? err.message : undefined),
  })

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center py-5">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">กำลังโหลด...</span>
        </Spinner>
        <span className="ms-3">กำลังโหลดข้อมูล...</span>
      </div>
    )
  }

  if (error || !invoice) {
    return (
      <div>
        <PageHeader
          title="ไม่พบข้อมูล"
          subtitle="ไม่สามารถโหลดข้อมูลใบแจ้งหนี้ได้"
        />
        <Alert variant="danger">
          <p className="fw-semibold mb-2">เกิดข้อผิดพลาด</p>
          <p className="small mb-0">
            {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </Alert>
        <Button onClick={() => navigate('/sales/invoices')}>
          กลับไปหน้ารายการ
        </Button>
      </div>
    )
  }

  const statusTone =
    invoice.status === 'paid'
      ? 'green'
      : invoice.status === 'posted'
        ? 'blue'
        : invoice.status === 'draft'
          ? 'gray'
          : 'red'

  const statusLabel =
    invoice.status === 'paid'
      ? 'รับชำระแล้ว'
      : invoice.status === 'posted'
        ? 'ยืนยันแล้ว'
        : invoice.status === 'draft'
          ? 'ร่าง'
          : 'ยกเลิก'

  const lineColumns: Column<typeof invoice.lines[number]>[] = [
    {
      key: 'description',
      header: 'รายละเอียด',
      cell: (line) => <span>{line.description}</span>,
    },
    {
      key: 'quantity',
      header: 'จำนวน',
      className: 'text-end',
      cell: (line) => (
        <span className="font-monospace">{(line.quantity ?? 0).toLocaleString('th-TH')}</span>
      ),
    },
    {
      key: 'unitPrice',
      header: 'ราคาต่อหน่วย',
      className: 'text-end',
      cell: (line) => (
        <span className="font-monospace">
          {(line.unitPrice ?? 0).toLocaleString('th-TH', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      ),
    },
    {
      key: 'subtotal',
      header: 'รวม',
      className: 'text-end',
      cell: (line) => (
        <span className="fw-semibold font-monospace">
          {(line.subtotal ?? (line.quantity ?? 0) * (line.unitPrice ?? 0)).toLocaleString('th-TH', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      ),
    },
  ]

  const invoiceDateText = invoice.invoiceDate
    ? formatDate(invoice.invoiceDate)
    : '—'
  const dueDateText = invoice.dueDate
    ? formatDate(invoice.dueDate)
    : '—'

  const amountUntaxed = invoice.amountUntaxed ?? invoice.total - (invoice.totalTax ?? 0)
  const totalTax = invoice.totalTax ?? 0
  const total = invoice.total ?? 0
  const currency = invoice.currency || 'THB'
  
  // Payment information from API (backend is canonical; use history only as fallback)
  const amountPaidFromHistory = (invoice.payments || []).reduce((sum, p) => sum + Number((p.appliedAmount ?? p.amount) || 0), 0)
  const canonicalPaid = invoice.paymentState === 'paid' || invoice.status === 'paid'
  const amountPaid =
    invoice.amountPaid && invoice.amountPaid > 0
      ? invoice.amountPaid
      : amountPaidFromHistory > 0
        ? amountPaidFromHistory
        : canonicalPaid
          ? total
          : 0
  const amountDue =
    invoice.amountDue !== undefined && invoice.amountDue >= 0
      ? invoice.amountDue
      : canonicalPaid
        ? 0
        : Math.max(0, total - amountPaid)
  // Map default_account_id to bankAccount if needed
  const payments = (invoice.payments || []).map((p) => ({
    ...p,
    bankAccount: p.bankAccount ?? (p.default_account_id ? String(p.default_account_id) : null),
  }))
  const hasAnyWht = payments.some((p) => (p.whtAmount ?? 0) > 0)
  const hasPaymentReceipt = Boolean(invoice.hasPaymentReceipt ?? payments.length > 0)
  const hasFinalReceipt = Boolean(invoice.hasFinalReceipt ?? invoice.hasReceipt ?? (amountDue <= 0 && amountPaid > 0))
  const canOpenReceipt = hasPaymentReceipt || hasFinalReceipt
  const paymentDataMismatch = canonicalPaid && payments.length === 0
  
  const paymentBadgeTone =
    invoice.paymentState === 'paid' || amountDue === 0
      ? 'green'
      : invoice.paymentState === 'partial' || invoice.paymentState === 'in_payment' || amountPaid > 0
        ? 'amber'
        : 'blue'
  const paymentBadgeText =
    invoice.paymentState === 'paid' || amountDue === 0
      ? 'ชำระครบแล้ว'
      : invoice.paymentState === 'partial' || invoice.paymentState === 'in_payment' || amountPaid > 0
        ? 'ชำระบางส่วน'
        : 'รอการชำระเงิน'
  const paymentStageText =
    invoice.paymentState === 'paid' || amountDue === 0
      ? 'รับชำระครบแล้ว'
      : invoice.paymentState === 'partial' || invoice.paymentState === 'in_payment' || amountPaid > 0
        ? 'รับชำระบางส่วน'
        : 'ยังไม่ได้รับชำระ'
  const printSections = [
    {
      key: 'invoice',
      title: 'Invoice',
      badge: 'เอกสารจริง',
      badgeTone: 'blue' as const,
      description: 'พิมพ์จากใบแจ้งหนี้นี้',
      enabled: true,
      helperText: 'ไม่อิงการรับชำระ',
      printLabel: 'พิมพ์ Invoice',
      pdfLabel: 'PDF Invoice',
      templateLabel: 'แก้ไข Template Invoice',
      onPrint: () => {
        setPrintMenuOpen(false)
        const url = `/reports-studio/print/${rsTplInvoice}?recordId=${encodeURIComponent(String(invoice.id))}`
        window.open(url, '_blank', 'noopener,noreferrer')
      },
      onPdf: () => {
        setPrintMenuOpen(false)
        const url = `/reports-studio/print/${rsTplInvoice}?recordId=${encodeURIComponent(String(invoice.id))}`
        window.open(url, '_blank', 'noopener,noreferrer')
      },
      onEdit: () => {
        setPrintMenuOpen(false)
        openReportsStudioEdit(rsTplInvoice)
      },
    },
    {
      key: 'receipt-partial',
      title: 'ใบเสร็จรับเงิน / ใบกำกับภาษี',
      badge: receiptRecordId ? 'พร้อมพิมพ์' : 'ยังไม่พร้อม',
      badgeTone: receiptRecordId ? ('green' as const) : ('gray' as const),
      description: 'สำหรับออกใบเสร็จรับเงิน (บางส่วนหรือครบ)',
      enabled: Boolean(receiptRecordId),
      printLabel: 'พิมพ์ใบเสร็จรับเงิน',
      pdfLabel: 'PDF ใบเสร็จรับเงิน',
      templateLabel: 'แก้ไข Template แบบเต็ม',
      helperText: receiptRecordId ? 'ใช้ข้อมูลรับชำระล่าสุด' : 'ต้องมีรายการรับชำระก่อน',
      onPrint: () => {
        setPrintMenuOpen(false)
        openReportsStudioPrint(rsTplFull)
      },
      onPdf: () => {
        setPrintMenuOpen(false)
        openReportsStudioPdf(rsTplFull)
      },
      onEdit: () => {
        setPrintMenuOpen(false)
        openReportsStudioEdit(rsTplFull)
      },
    },
    {
      key: 'receipt-short',
      title: 'ใบเสร็จ / ใบกำกับภาษีอย่างย่อ',
      badge: hasFinalReceipt ? 'ชำระครบแล้ว' : 'รอชำระครบ',
      badgeTone: hasFinalReceipt ? ('green' as const) : ('amber' as const),
      description: 'ใช้เมื่อชำระครบแล้วเท่านั้น',
      enabled: Boolean(receiptRecordId && hasFinalReceipt),
      printLabel: 'พิมพ์ใบเสร็จอย่างย่อ',
      pdfLabel: 'PDF ใบเสร็จอย่างย่อ',
      templateLabel: 'แก้ไข Template อย่างย่อ',
      helperText: hasFinalReceipt ? 'พร้อมพิมพ์' : 'ยังชำระไม่ครบ',
      onPrint: () => {
        setPrintMenuOpen(false)
        openReportsStudioPrint(rsTplShort)
      },
      onPdf: () => {
        setPrintMenuOpen(false)
        openReportsStudioPdf(rsTplShort)
      },
      onEdit: () => {
        setPrintMenuOpen(false)
        openReportsStudioEdit(rsTplShort)
      },
    },
  ]

  return (
    <div>
      <PageHeader
        title={`ใบแจ้งหนี้ ${invoice.number || `#${invoice.id}`}`}
        subtitle={invoice.customerName || '—'}
        breadcrumb="รายรับ · ใบแจ้งหนี้"
        actions={
          <div className="d-flex align-items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => navigate('/sales/invoices')}>
              กลับ
            </Button>
            <Button size="sm" variant="secondary" onClick={() => navigate('/notes?domain=sales')}>
              ใบเพิ่ม/ลดหนี้
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={invoice.status !== 'posted'}
              onClick={() => setCreditNoteOpen(true)}
              title={invoice.status !== 'posted' ? 'ต้องโพสต์ใบแจ้งหนี้ก่อน' : 'สร้าง Credit Note'}
            >
              ใบลดหนี้
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={invoice.status !== 'posted'}
              onClick={() => setDebitNoteOpen(true)}
              title={invoice.status !== 'posted' ? 'ต้องโพสต์ใบแจ้งหนี้ก่อน' : 'สร้าง Debit Note'}
            >
              ใบเพิ่มหนี้
            </Button>
          </div>
        }
      />

      <CreateNoteModal
        open={creditNoteOpen}
        onClose={() => setCreditNoteOpen(false)}
        kind="credit"
        initialLines={(invoice.lines || []).map((l) => ({
          productId: l.productId ?? null,
          description: l.description,
          quantity: l.quantity ?? 0,
          unitPrice: l.unitPrice ?? 0,
          taxRate: l.taxRate ?? 0,
        }))}
        onSubmit={async ({ reason, mode, lines }) => {
          await createCreditNoteMutation.mutateAsync({ reason, mode, lines })
        }}
      />

      <CreateNoteModal
        open={debitNoteOpen}
        onClose={() => setDebitNoteOpen(false)}
        kind="debit"
        initialLines={[]}
        onSubmit={async ({ reason, lines }) => {
          await createDebitNoteMutation.mutateAsync({ reason, lines })
        }}
      />

      {/* Summary header (desktop-first) */}
      <Card className="p-4 mb-4">
        <div className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3">
          <div className="min-w-0">
            <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
              <Badge tone={statusTone}>{statusLabel}</Badge>
              <span className="text-muted small">เลขที่:</span>
              <span className="fw-semibold font-monospace">
                {invoice.number || `#${invoice.id}`}
              </span>
            </div>

            <div className="d-flex align-items-baseline gap-2 flex-wrap">
              <div className="qf-kpi-value font-monospace">
                {total.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                <span className="qf-kpi-currency">{currency}</span>
              </div>
              <div className="qf-kpi-hint text-muted">
                ก่อนภาษี {amountUntaxed.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} • ภาษี {totalTax.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            <div className="d-flex gap-4 mt-3 flex-wrap">
              <div>
                <div className="qf-kpi-label text-muted">ลูกค้า</div>
                <div className="fw-semibold">{invoice.customerName || '—'}</div>
              </div>
              <div>
                <div className="qf-kpi-label text-muted">วันที่เอกสาร</div>
                <div className="fw-semibold">{invoiceDateText}</div>
              </div>
              <div>
                <div className="qf-kpi-label text-muted">ครบกำหนด</div>
                <div className="fw-semibold">{dueDateText}</div>
              </div>
            </div>
          </div>

          <div className="d-flex align-items-center gap-2 flex-wrap justify-content-lg-end">
            {invoice.status === 'draft' && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => navigate(`/sales/invoices/${invoice.id}/edit`)}
              >
                แก้ไข
              </Button>
            )}
            {invoice.status === 'posted' && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setAmendOpen(true)}
                isLoading={amendMutation.isPending}
              >
                แก้ไข (Amend)
              </Button>
            )}
            {invoice.status === 'draft' && (
              <Button
                size="sm"
                onClick={() => postMutation.mutate()}
                isLoading={postMutation.isPending}
              >
                Confirm → Invoice
              </Button>
            )}
            {invoice.status === 'posted' && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setPromptPayOpen(true)}
                disabled={Math.max(0, amountDue) <= 0}
              >
                PromptPay QR
              </Button>
            )}
            {invoice.status === 'posted' && (
              <Button
                size="sm"
                onClick={() => setPaymentOpen(true)}
                isLoading={paymentMutation.isPending}
                disabled={amountDue <= 0}
              >
                รับชำระเงิน
              </Button>
            )}
            {canOpenReceipt && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setPrintMenuOpen(true)}
              >
                {hasFinalReceipt ? 'เปิดใบเสร็จรับเงิน' : 'ใบเสร็จรับเงิน'}
              </Button>
            )}
            {/* Professional + reliable on mobile: split button + action-sheet modal (avoids dropdown stacking issues) */}
            <ButtonGroup>
              <BootstrapButton size="sm" variant="outline-secondary" onClick={() => openReportsStudioPrint(rsTplFull)}>
                พิมพ์
              </BootstrapButton>
              <BootstrapButton
                size="sm"
                variant="outline-secondary"
                onClick={() => setPrintMenuOpen(true)}
                aria-label="Print options"
                title="ตัวเลือกการพิมพ์"
              >
                ▾
              </BootstrapButton>
            </ButtonGroup>
          </div>
        </div>
      </Card>

      <Card className="p-3 mb-4">
        <div className="small text-muted mb-2">สถานะกระบวนการเอกสาร</div>
        <div className="d-flex flex-wrap gap-2 align-items-center">
          <Badge tone="green">ใบแจ้งหนี้</Badge>
          <span className="text-muted small">→</span>
          <Badge tone={invoice.status === 'draft' ? 'gray' : 'green'}>ยืนยันใบแจ้งหนี้</Badge>
          <span className="text-muted small">→</span>
          <Badge tone={invoice.paymentState === 'paid' ? 'green' : amountPaid > 0 ? 'amber' : 'gray'}>{paymentStageText}</Badge>
          <span className="text-muted small">→</span>
          <Badge tone={hasPaymentReceipt ? 'green' : 'gray'}>ใบเสร็จรับเงิน</Badge>
          <span className="text-muted small">→</span>
          <Badge tone={hasFinalReceipt ? 'green' : 'gray'}>ใบเสร็จ/ใบกำกับภาษี</Badge>
          {payments.length > 1 ? (
            <span className="small text-muted">({payments.length} payments / รองรับแบ่งชำระ)</span>
          ) : null}
        </div>
      </Card>

      <Modal
        show={printMenuOpen}
        onHide={() => setPrintMenuOpen(false)}
        centered
        fullscreen="sm-down"
      >
        <Modal.Header closeButton>
          <Modal.Title>พิมพ์ / PDF</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="d-flex flex-column gap-2">
            {printSections.map((section) => (
              <div key={section.key} className={`qf-print-option-row ${section.enabled ? '' : 'qf-print-option-row--disabled'}`}>
                <div className="d-flex align-items-center justify-content-between gap-2 mb-1">
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    <div className="fw-semibold">{section.title}</div>
                    <Badge tone={section.badgeTone}>{section.badge}</Badge>
                  </div>
                </div>
                <div className="small text-muted mb-2">
                  {section.description} · {section.helperText}
                </div>
                <div className="row g-2">
                  <div className="col-12 col-md-4">
                    <BootstrapButton
                      className="w-100"
                      variant={section.enabled ? 'primary' : 'outline-secondary'}
                      disabled={!section.enabled}
                      onClick={section.onPrint}
                    >
                      {section.printLabel}
                    </BootstrapButton>
                  </div>
                  <div className="col-12 col-md-4">
                    <BootstrapButton
                      className="w-100"
                      variant="outline-secondary"
                      disabled={!section.enabled}
                      onClick={section.onPdf}
                    >
                      {section.pdfLabel}
                    </BootstrapButton>
                  </div>
                  <div className="col-12 col-md-4">
                    <BootstrapButton
                      className="w-100"
                      variant="outline-secondary"
                      onClick={section.onEdit}
                    >
                      Template
                    </BootstrapButton>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <hr />
          <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-md-between gap-2">
            <div>
              <div className="fw-semibold">Fallback</div>
              <div className="small text-muted">ใช้ PDF เดิมของ invoice หากไม่ต้องการผ่าน Reports Studio</div>
            </div>
            <BootstrapButton
              variant="outline-secondary"
              onClick={async () => {
                try {
                  setPrintMenuOpen(false)
                  await openInvoicePdf(invoice.id)
                } catch (err) {
                  toast.error('เปิด PDF ไม่สำเร็จ', err instanceof Error ? err.message : undefined)
                }
              }}
            >
              PDF แบบเดิม
            </BootstrapButton>
          </div>
        </Modal.Body>
      </Modal>

      <div className="row g-4">
        <div className="col-lg-8">
          <Card>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="h6 fw-semibold mb-0">รายละเอียดสินค้า/บริการ</h5>
            </div>
            <DataTable
              plain
              columns={lineColumns}
              rows={invoice.lines || []}
              empty={<p className="text-muted mb-0">ไม่มีรายการ</p>}
            />
          </Card>

          {/* Payment details section - only show for posted/paid invoices */}
          {(invoice.status === 'posted' || invoice.status === 'paid') && (
            <Card className="mt-4">
              <div className="qf-section-title mb-3">รายละเอียดการชำระเงิน</div>
              <div>
                <div className="d-flex justify-content-between mb-2">
                  <span className="text-muted small">ยอดรวมทั้งสิ้น:</span>
                  <span className="fw-semibold font-monospace">
                    {total.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                    {currency}
                  </span>
                </div>
                <div className="d-flex justify-content-between mb-2">
                  <span className="text-muted small">ยอดที่ชำระแล้ว:</span>
                  <span className={`font-monospace ${amountPaid > 0 ? 'fw-semibold text-success' : 'text-muted'}`}>
                    {amountPaid.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                    {currency}
                  </span>
                </div>
                <hr />
                <div className="d-flex justify-content-between mb-3">
                  <span className="fw-semibold">ยอดคงเหลือ:</span>
                  <span className={`fw-bold font-monospace ${amountDue === 0 ? 'text-success' : amountDue > 0 ? 'text-danger' : 'text-muted'}`}>
                    {amountDue.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                    {currency}
                  </span>
                </div>
                
                {/* Payment history */}
                {payments.length > 0 ? (
                  <div className="mt-3">
                    <div className="small fw-semibold text-muted mb-2">ประวัติการชำระเงิน ({payments.length} รายการ):</div>
                    <div className="table-responsive">
                      <table className="table table-sm mb-0">
                        <thead>
                          <tr className="small text-muted">
                            <th style={{ width: '140px' }}>วันที่ชำระ</th>
                            {payments.some((p) => p.journal) && <th>ช่องทางชำระ</th>}
                            <th>วิธีชำระ</th>
                            <th className="text-end">ยอดที่รับ</th>
                            {hasAnyWht && <th className="text-end">หัก ณ ที่จ่าย</th>}
                            {payments.some((p) => p.reference) && <th>อ้างอิง</th>}
                            <th className="text-end">จัดการ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {payments.map((payment) => (
                            <tr key={payment.id}>
                              <td className="small">
                                {formatDate(payment.date)}
                              </td>
                              {payments.some((p) => p.journal) && (
                                <td className="small">
                                  {payment.journal ? (
                                    (() => {
                                      const hasBankInfo = !!(payment.bankAccount || payment.bankAccountNumber)
                                      const tooltipText = payment.bankAccount && payment.bankAccountNumber
                                        ? `${payment.bankAccount} ${payment.bankAccountNumber}`
                                        : payment.bankAccount || payment.bankAccountNumber || ''
                                      
                                      return hasBankInfo ? (
                                        <OverlayTrigger
                                          placement="top"
                                          overlay={
                                            <Tooltip id={`tooltip-payment-${payment.id}`}>
                                              {tooltipText}
                                            </Tooltip>
                                          }
                                        >
                                          <span className="badge bg-secondary" style={{ cursor: 'help' }}>
                                            {payment.journal}
                                          </span>
                                        </OverlayTrigger>
                                      ) : (
                                        <span className="badge bg-secondary">{payment.journal}</span>
                                      )
                                    })()
                                  ) : (
                                    '—'
                                  )}
                                </td>
                              )}
                              <td className="small">{payment.method || 'Manual'}</td>
                              <td className="text-end font-monospace fw-semibold">
                                {(payment.appliedAmount ?? payment.amount).toLocaleString('th-TH', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}{' '}
                                {currency}
                              </td>
                              {hasAnyWht && (
                                <td className="text-end font-monospace text-danger">
                                  {((payment.whtAmount ?? 0) || 0).toLocaleString('th-TH', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}{' '}
                                  {currency}
                                </td>
                              )}
                              {payments.some((p) => p.reference) && (
                                <td className="small text-muted font-monospace">{payment.reference || '—'}</td>
                              )}
                              <td className="text-end">
                                <Button size="sm" variant="ghost" onClick={() => setEditingPayment(payment)}>
                                  แก้ไข
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        {payments.length > 1 && (
                          <tfoot>
                            <tr className="border-top">
                              <td colSpan={payments.some((p) => p.journal) ? 3 : 2} className="small fw-semibold text-end">
                                รวมทั้งหมด:
                              </td>
                              <td className="text-end fw-bold font-monospace">
                                {amountPaid.toLocaleString('th-TH', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}{' '}
                                {currency}
                              </td>
                              {hasAnyWht ? (
                                <td className="text-end fw-bold font-monospace text-danger">
                                  {payments
                                    .reduce((sum, payment) => sum + Number(payment.whtAmount || 0), 0)
                                    .toLocaleString('th-TH', {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}{' '}
                                  {currency}
                                </td>
                              ) : null}
                              {payments.some((p) => p.reference) && <td></td>}
                              <td></td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3">
                    <div className="small text-muted">
                      {paymentDataMismatch
                        ? 'เอกสารถูกทำเครื่องหมายว่าชำระแล้ว แต่ยังไม่พบ payment record สำหรับออกใบเสร็จ'
                        : 'ยังไม่มีประวัติการชำระเงิน'}
                    </div>
                  </div>
                )}
                
                {/* Status badge */}
                <div className="mt-3">
                  <Badge tone={paymentBadgeTone}>{paymentBadgeText}</Badge>
                </div>
              </div>
            </Card>
          )}
        </div>

        <div className="col-lg-4">
          <Card>
            <div className="qf-section-title mb-3">ข้อมูลเอกสาร</div>
            <div>
              <div className="d-flex justify-content-between mb-2">
                <span className="text-muted small">เลขที่:</span>
                <span className="fw-semibold font-monospace">
                  {invoice.number || `#${invoice.id}`}
                </span>
              </div>
              <div className="d-flex justify-content-between mb-2">
                <span className="text-muted small">วันที่เอกสาร:</span>
                <span>{invoiceDateText}</span>
              </div>
              <div className="d-flex justify-content-between mb-2">
                <span className="text-muted small">วันครบกำหนด:</span>
                <span>{dueDateText}</span>
              </div>
              <div className="d-flex justify-content-between mb-2">
                <span className="text-muted small">ลูกค้า:</span>
                <span className="fw-semibold">{invoice.customerName || '—'}</span>
              </div>
              <hr />
              <div className="d-flex justify-content-between mb-2">
                <span className="text-muted small">ยอดรวมก่อนภาษี:</span>
                <span className="font-monospace">
                  {amountUntaxed.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="d-flex justify-content-between mb-2">
                <span className="text-muted small">ภาษี:</span>
                <span className="font-monospace">
                  {totalTax.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="d-flex justify-content-between mb-3">
                <span className="fw-semibold">ยอดรวมทั้งสิ้น:</span>
                <span className="fw-bold font-monospace h6 mb-0">
                  {total.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                  {currency}
                </span>
              </div>
            </div>
          </Card>

          {invoice.notes && (
            <Card className="mt-3">
              <div className="qf-section-title mb-2">หมายเหตุ</div>
              <p className="small text-muted mb-0">{invoice.notes}</p>
            </Card>
          )}
        </div>
      </div>

      <RegisterPaymentModal
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        currency={invoice.currency}
        defaultAmount={Math.max(0, amountDue)}
        maxAmount={Math.max(0, amountDue)}
        enableWht
        whtOptions={paymentMetaQuery.data?.whtOptions ?? [{ code: 'none', label: 'ไม่หัก ณ ที่จ่าย', rate: 0 }]}
        defaultWhtCode={paymentMetaQuery.data?.defaultWht ?? 'none'}
        currencyPrecision={paymentMetaQuery.data?.currencyPrecision ?? 2}
        onSubmit={async (payload) => {
          await paymentMutation.mutateAsync(payload as RegisterPaymentPayload)
        }}
      />

      <RegisterPaymentModal
        open={!!editingPayment}
        onClose={() => setEditingPayment(null)}
        currency={invoice.currency}
        title="แก้ไขข้อมูลการรับชำระ"
        submitLabel="บันทึกการแก้ไข"
        initialDate={editingPayment?.date}
        initialMethod={
          editingPayment?.method?.toLowerCase().includes('cash')
            ? 'cash'
            : editingPayment?.method?.toLowerCase().includes('card')
              ? 'card'
              : editingPayment?.method?.toLowerCase().includes('bank')
                ? 'bank'
                : 'manual'
        }
        initialReference={editingPayment?.reference || ''}
        allowAmountEdit={false}
        onSubmit={async (payload) => {
          if (!editingPayment) return
          await paymentUpdateMutation.mutateAsync({
            paymentId: editingPayment.id,
            payload: payload as UpdatePaymentPayload,
          })
          setEditingPayment(null)
        }}
      />

      <PromptPayQrModal
        open={promptPayOpen}
        onClose={() => setPromptPayOpen(false)}
        defaultAmount={Math.max(0, amountDue)}
        reference={invoice.number || `INV-${invoice.id}`}
        customerName={invoice.customerName}
      />

      <AmendInvoiceModal
        open={amendOpen}
        onClose={() => setAmendOpen(false)}
        isSubmitting={amendMutation.isPending}
        onSubmit={async (reason) => {
          await amendMutation.mutateAsync(reason)
          setAmendOpen(false)
        }}
      />
    </div>
  )
}

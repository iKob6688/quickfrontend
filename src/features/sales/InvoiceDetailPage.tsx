import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getInvoice, postInvoice, registerPayment, openInvoicePdf, amendInvoice, type RegisterPaymentPayload } from '@/api/services/invoices.service'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Spinner, Alert, OverlayTrigger, Tooltip } from 'react-bootstrap'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { RegisterPaymentModal } from '@/features/sales/RegisterPaymentModal'
import { AmendInvoiceModal } from '@/features/sales/AmendInvoiceModal'
import { useState } from 'react'
import { toast } from '@/lib/toastStore'

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [amendOpen, setAmendOpen] = useState(false)

  const invoiceId = id ? Number.parseInt(id, 10) : null

  const {
    data: invoice,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: () => getInvoice(invoiceId!),
    enabled: !!invoiceId,
  })

  const postMutation = useMutation({
    mutationFn: () => postInvoice(invoiceId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      toast.success('โพสต์ใบแจ้งหนี้สำเร็จ')
    },
    onError: (err) => {
      toast.error('โพสต์ใบแจ้งหนี้ไม่สำเร็จ', err instanceof Error ? err.message : undefined)
    },
  })

  const paymentMutation = useMutation({
    mutationFn: (payload: RegisterPaymentPayload) =>
      registerPayment(invoiceId!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      toast.success('บันทึกรับชำระเงินสำเร็จ')
    },
    onError: (err) => {
      toast.error('รับชำระเงินไม่สำเร็จ', err instanceof Error ? err.message : undefined)
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
    ? new Date(invoice.invoiceDate).toLocaleDateString('th-TH')
    : '—'
  const dueDateText = invoice.dueDate
    ? new Date(invoice.dueDate).toLocaleDateString('th-TH')
    : '—'

  const amountUntaxed = invoice.amountUntaxed ?? invoice.total - (invoice.totalTax ?? 0)
  const totalTax = invoice.totalTax ?? 0
  const total = invoice.total ?? 0
  const currency = invoice.currency || 'THB'
  
  // Payment information from API (fallback to calculated if not available)
  const amountPaid = invoice.amountPaid ?? (invoice.status === 'paid' ? total : 0)
  const amountDue = invoice.amountDue ?? (invoice.status === 'paid' ? 0 : total - amountPaid)
  // Map default_account_id to bankAccount if needed
  const payments = (invoice.payments || []).map((p) => ({
    ...p,
    bankAccount: p.bankAccount ?? (p.default_account_id ? String(p.default_account_id) : null),
  }))
  
  // Debug: Log payment data to check bank account info
  if (payments.length > 0) {
    console.log('[InvoiceDetailPage] Payments data:', payments.map(p => ({
      id: p.id,
      journal: p.journal,
      bankAccount: p.bankAccount,
      bankAccountNumber: p.bankAccountNumber,
    })))
  }

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
          </div>
        }
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
                ยืนยันใบแจ้งหนี้
              </Button>
            )}
            {invoice.status === 'posted' && (
              <Button
                size="sm"
                onClick={() => setPaymentOpen(true)}
                isLoading={paymentMutation.isPending}
              >
                รับชำระเงิน
              </Button>
            )}
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                try {
                  await openInvoicePdf(invoice.id)
                } catch (err) {
                  toast.error('เปิด PDF ไม่สำเร็จ', err instanceof Error ? err.message : undefined)
                }
              }}
            >
              พิมพ์ / PDF
            </Button>
          </div>
        </div>
      </Card>

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
                            <th className="text-end">จำนวนเงิน</th>
                            {payments.some((p) => p.reference) && <th>อ้างอิง</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {payments.map((payment) => (
                            <tr key={payment.id}>
                              <td className="small">
                                {new Date(payment.date).toLocaleDateString('th-TH', {
                                  year: 'numeric',
                                  month: '2-digit',
                                  day: '2-digit',
                                })}
                              </td>
                              {payments.some((p) => p.journal) && (
                                <td className="small">
                                  {payment.journal ? (
                                    (() => {
                                      const hasBankInfo = !!(payment.bankAccount || payment.bankAccountNumber)
                                      const tooltipText = payment.bankAccount && payment.bankAccountNumber
                                        ? `${payment.bankAccount} ${payment.bankAccountNumber}`
                                        : payment.bankAccount || payment.bankAccountNumber || ''
                                      
                                      console.log(`[Payment ${payment.id}] hasBankInfo: ${hasBankInfo}, tooltipText: "${tooltipText}"`, {
                                        bankAccount: payment.bankAccount,
                                        bankAccountNumber: payment.bankAccountNumber,
                                      })
                                      
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
                                {payment.amount.toLocaleString('th-TH', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}{' '}
                                {currency}
                              </td>
                              {payments.some((p) => p.reference) && (
                                <td className="small text-muted font-monospace">{payment.reference || '—'}</td>
                              )}
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
                              {payments.some((p) => p.reference) && <td></td>}
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3">
                    <div className="small text-muted">ยังไม่มีประวัติการชำระเงิน</div>
                  </div>
                )}
                
                {/* Status badge */}
                <div className="mt-3">
                  {amountDue === 0 ? (
                    <Badge tone="green">ชำระครบแล้ว</Badge>
                  ) : amountPaid > 0 ? (
                    <Badge tone="amber">ชำระบางส่วน</Badge>
                  ) : (
                    <Badge tone="blue">รอการชำระเงิน</Badge>
                  )}
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
        defaultAmount={total}
        onSubmit={async (payload) => {
          await paymentMutation.mutateAsync(payload)
        }}
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


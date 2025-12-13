import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getInvoice, postInvoice, registerPayment, type RegisterPaymentPayload } from '@/api/endpoints/invoices'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Spinner, Alert } from 'react-bootstrap'
import { DataTable, type Column } from '@/components/ui/DataTable'

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

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
    },
  })

  const paymentMutation = useMutation({
    mutationFn: (payload: RegisterPaymentPayload) =>
      registerPayment(invoiceId!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
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
        <span className="font-monospace">{line.quantity.toLocaleString('th-TH')}</span>
      ),
    },
    {
      key: 'unitPrice',
      header: 'ราคาต่อหน่วย',
      className: 'text-end',
      cell: (line) => (
        <span className="font-monospace">
          {line.unitPrice.toLocaleString('th-TH', {
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
          {line.subtotal.toLocaleString('th-TH', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      ),
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
            <Button
              size="sm"
              variant="secondary"
              onClick={() => navigate('/sales/invoices')}
            >
              กลับ
            </Button>
            {invoice.status === 'draft' && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => navigate(`/sales/invoices/${invoice.id}/edit`)}
              >
                แก้ไข
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
          </div>
        }
      />

      <div className="row g-4">
        <div className="col-lg-8">
          <Card>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="h6 fw-semibold mb-0">รายละเอียดสินค้า/บริการ</h5>
              <Badge tone={statusTone}>{statusLabel}</Badge>
            </div>
            <DataTable
              columns={lineColumns}
              rows={invoice.lines || []}
              empty={<p className="text-muted mb-0">ไม่มีรายการ</p>}
            />
          </Card>
        </div>

        <div className="col-lg-4">
          <Card>
            <h5 className="h6 fw-semibold mb-3">ข้อมูลเอกสาร</h5>
            <div>
              <div className="d-flex justify-content-between mb-2">
                <span className="text-muted small">เลขที่:</span>
                <span className="fw-semibold font-monospace">
                  {invoice.number || `#${invoice.id}`}
                </span>
              </div>
              <div className="d-flex justify-content-between mb-2">
                <span className="text-muted small">วันที่เอกสาร:</span>
                <span>
                  {invoice.invoiceDate
                    ? new Date(invoice.invoiceDate).toLocaleDateString('th-TH')
                    : '—'}
                </span>
              </div>
              <div className="d-flex justify-content-between mb-2">
                <span className="text-muted small">วันครบกำหนด:</span>
                <span>
                  {invoice.dueDate
                    ? new Date(invoice.dueDate).toLocaleDateString('th-TH')
                    : '—'}
                </span>
              </div>
              <div className="d-flex justify-content-between mb-2">
                <span className="text-muted small">ลูกค้า:</span>
                <span className="fw-semibold">{invoice.customerName || '—'}</span>
              </div>
              <hr />
              <div className="d-flex justify-content-between mb-2">
                <span className="text-muted small">ยอดรวมก่อนภาษี:</span>
                <span className="font-monospace">
                  {invoice.amountUntaxed.toLocaleString('th-TH', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="d-flex justify-content-between mb-2">
                <span className="text-muted small">ภาษี:</span>
                <span className="font-monospace">
                  {invoice.totalTax.toLocaleString('th-TH', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="d-flex justify-content-between mb-3">
                <span className="fw-semibold">ยอดรวมทั้งสิ้น:</span>
                <span className="fw-bold font-monospace h6 mb-0">
                  {invoice.total.toLocaleString('th-TH', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{' '}
                  {invoice.currency}
                </span>
              </div>
            </div>
          </Card>

          {invoice.notes && (
            <Card className="mt-3">
              <h5 className="h6 fw-semibold mb-2">หมายเหตุ</h5>
              <p className="small text-muted mb-0">{invoice.notes}</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}


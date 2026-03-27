import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Alert, Spinner } from 'react-bootstrap'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { useAppDateFormatter } from '@/lib/dateFormat'
import {
  getPurchaseVendorBill,
  openPurchaseVendorBillPdf,
  openPurchaseVendorBillWhtPdf,
  postPurchaseVendorBill,
  generatePurchaseVendorBillWht,
  registerPurchaseVendorBillPayment,
  type PurchaseVendorBillLine,
} from '@/api/services/purchase-vendor-bills.service'
import { toast } from '@/lib/toastStore'
import { RegisterPaymentModal } from '@/features/sales/RegisterPaymentModal'
import { CreateNoteModal } from '@/components/notes/CreateNoteModal'
import { createPurchaseCreditNote, createPurchaseDebitNote } from '@/api/services/purchase-notes.service'

export function PurchaseVendorBillDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const formatDate = useAppDateFormatter()
  const billId = id ? Number.parseInt(id, 10) : null
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [creditNoteOpen, setCreditNoteOpen] = useState(false)
  const [debitNoteOpen, setDebitNoteOpen] = useState(false)

  const { data: bill, isLoading, error } = useQuery({
    queryKey: ['purchaseVendorBill', billId],
    queryFn: () => getPurchaseVendorBill(billId!),
    enabled: !!billId,
  })

  const postMutation = useMutation({
    mutationFn: () => postPurchaseVendorBill(billId!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['purchaseVendorBill', billId] })
      await queryClient.invalidateQueries({ queryKey: ['purchaseOrder'] })
      await queryClient.invalidateQueries({ queryKey: ['taxReports'] })
      toast.success('ยืนยัน Vendor Bill สำเร็จ')
    },
    onError: (err) => {
      toast.error('ยืนยัน Vendor Bill ไม่สำเร็จ', err instanceof Error ? err.message : undefined)
    },
  })

  const paymentMutation = useMutation({
    mutationFn: (payload: { amount: number; date: string; method: string; reference?: string }) =>
      registerPurchaseVendorBillPayment(billId!, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['purchaseVendorBill', billId] })
      await queryClient.invalidateQueries({ queryKey: ['purchaseOrder'] })
      await queryClient.invalidateQueries({ queryKey: ['taxReports'] })
      toast.success('บันทึกการชำระ Vendor Bill สำเร็จ')
      setPaymentOpen(false)
    },
    onError: (err) => {
      toast.error('ชำระ Vendor Bill ไม่สำเร็จ', err instanceof Error ? err.message : undefined)
    },
  })

  const generateWhtMutation = useMutation({
    mutationFn: () => generatePurchaseVendorBillWht(billId!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['purchaseVendorBill', billId] })
      await queryClient.invalidateQueries({ queryKey: ['taxReports'] })
      toast.success('สร้างข้อมูล WHT สำเร็จ')
    },
    onError: (err) => {
      toast.error('สร้าง WHT ไม่สำเร็จ', err instanceof Error ? err.message : undefined)
    },
  })

  const createCreditNoteMutation = useMutation({
    mutationFn: async (payload: { reason: string; mode: 'full' | 'delta'; lines: any[] }) => {
      if (!billId) throw new Error('Missing bill id')
      return await createPurchaseCreditNote(billId, {
        reason: payload.reason,
        mode: payload.mode,
        ...(payload.mode === 'delta' ? { lines: payload.lines } : {}),
      })
    },
    onSuccess: async (res) => {
      const noteId = res.noteId
      toast.success('สร้าง Purchase Credit Note สำเร็จ')
      if (noteId) navigate(`/purchases/notes/${noteId}`)
    },
    onError: (err) => toast.error('สร้าง Purchase Credit Note ไม่สำเร็จ', err instanceof Error ? err.message : undefined),
  })

  const createDebitNoteMutation = useMutation({
    mutationFn: async (payload: { reason: string; lines: any[] }) => {
      if (!billId) throw new Error('Missing bill id')
      return await createPurchaseDebitNote(billId, {
        reason: payload.reason,
        lines: payload.lines,
      })
    },
    onSuccess: async (res) => {
      const noteId = res.noteId
      toast.success('สร้าง Purchase Debit Note สำเร็จ')
      if (noteId) navigate(`/purchases/notes/${noteId}`)
    },
    onError: (err) => toast.error('สร้าง Purchase Debit Note ไม่สำเร็จ', err instanceof Error ? err.message : undefined),
  })

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center py-5">
        <Spinner animation="border" />
        <span className="ms-2">กำลังโหลด Vendor Bill...</span>
      </div>
    )
  }

  if (error || !bill) {
    return (
      <div>
        <PageHeader title="ไม่พบ Vendor Bill" subtitle="ไม่สามารถโหลดข้อมูลได้" breadcrumb="รายจ่าย · Vendor Bill" />
        <Alert variant="danger" className="small">
          {error instanceof Error ? error.message : 'Unknown error'}
        </Alert>
        <Button onClick={() => navigate('/purchases/orders')}>กลับไปใบสั่งซื้อ</Button>
      </div>
    )
  }

  const statusTone =
    bill.status === 'paid'
      ? 'green'
      : bill.status === 'posted'
        ? 'blue'
        : bill.status === 'draft'
          ? 'gray'
          : 'red'
  const statusLabel =
    bill.status === 'paid'
      ? 'ชำระแล้ว'
      : bill.status === 'posted'
        ? 'ยืนยันแล้ว'
        : bill.status === 'draft'
          ? 'ร่าง'
          : 'ยกเลิก'

  const lineColumns: Column<PurchaseVendorBillLine>[] = [
    { key: 'description', header: 'รายละเอียด', cell: (r) => <span>{r.description || '—'}</span> },
    {
      key: 'quantity',
      header: 'จำนวน',
      className: 'text-end',
      cell: (r) => <span className="font-monospace">{(r.quantity || 0).toLocaleString('th-TH')}</span>,
    },
    {
      key: 'unitPrice',
      header: 'ราคาต่อหน่วย',
      className: 'text-end',
      cell: (r) => (
        <span className="font-monospace">
          {(r.unitPrice || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: 'subtotal',
      header: 'รวม',
      className: 'text-end',
      cell: (r) => (
        <span className="fw-semibold font-monospace">
          {(r.subtotal || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
    },
  ]

  const amountPaid = bill.amountPaid ?? (bill.status === 'paid' ? bill.total : 0)
  const amountDue = bill.amountDue ?? Math.max(0, bill.total - amountPaid)
  const amountWht = bill.amountWht ?? 0
  const hasAnyWht = amountWht > 0 || bill.payments?.some((payment) => payment.hasWht || (payment.whtCertCount ?? 0) > 0)

  return (
    <div>
      <PageHeader
        title={`Vendor Bill ${bill.number || `#${bill.id}`}`}
        subtitle={bill.vendorName || '—'}
        breadcrumb="รายจ่าย · Vendor Bill"
        actions={
          <div className="d-flex align-items-center gap-2">
            {bill.status === 'draft' ? (
              <Button size="sm" onClick={() => postMutation.mutate()} disabled={postMutation.isPending}>
                {postMutation.isPending ? 'กำลังยืนยัน...' : 'Confirm → Vendor Bill'}
              </Button>
            ) : null}
            {(bill.status === 'posted' || bill.status === 'paid') ? (
              <Button size="sm" variant="secondary" onClick={() => setPaymentOpen(true)}>
                Confirm → Payment
              </Button>
            ) : null}
            {hasAnyWht ? (
              <>
                <Button size="sm" variant="secondary" onClick={() => generateWhtMutation.mutate()} disabled={generateWhtMutation.isPending}>
                  {generateWhtMutation.isPending ? 'กำลังสร้าง WHT...' : 'Generate WHT'}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => openPurchaseVendorBillWhtPdf(bill.id).catch((err) => toast.error('เปิด WHT PDF ไม่สำเร็จ', err instanceof Error ? err.message : undefined))}
                >
                  Print WHT
                </Button>
              </>
            ) : null}
            <Button
              size="sm"
              variant="secondary"
              onClick={() => openPurchaseVendorBillPdf(bill.id).catch((err) => toast.error('เปิด PDF ไม่สำเร็จ', err instanceof Error ? err.message : undefined))}
            >
              PDF
            </Button>
            <Button size="sm" variant="secondary" onClick={() => navigate('/notes?domain=purchase')}>
              ใบเพิ่ม/ลดหนี้ซื้อ
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={!(bill.status === 'posted' || bill.status === 'paid')}
              onClick={() => setCreditNoteOpen(true)}
              title={!(bill.status === 'posted' || bill.status === 'paid') ? 'ต้องยืนยัน Vendor Bill ก่อน' : 'สร้าง Credit Note'}
            >
              ใบลดหนี้ซื้อ
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={!(bill.status === 'posted' || bill.status === 'paid')}
              onClick={() => setDebitNoteOpen(true)}
              title={!(bill.status === 'posted' || bill.status === 'paid') ? 'ต้องยืนยัน Vendor Bill ก่อน' : 'สร้าง Debit Note'}
            >
              ใบเพิ่มหนี้ซื้อ
            </Button>
            <Button size="sm" variant="ghost" onClick={() => navigate('/purchases/orders')}>
              กลับ
            </Button>
          </div>
        }
      />

      <CreateNoteModal
        open={creditNoteOpen}
        onClose={() => setCreditNoteOpen(false)}
        kind="credit"
        initialLines={(bill.lines || []).map((l) => ({
          productId: l.productId ?? null,
          description: l.description,
          quantity: l.quantity ?? 0,
          unitPrice: l.unitPrice ?? 0,
          taxRate: 0,
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

      <Card className="p-4 mb-4">
        <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
          <Badge tone={statusTone}>{statusLabel}</Badge>
          <span className="small text-muted">เลขที่:</span>
          <span className="fw-semibold font-monospace">{bill.number || `#${bill.id}`}</span>
        </div>
        <div className="row g-3">
          <div className="col-md-4">
            <div className="small text-muted">ผู้ขาย</div>
            <div className="fw-semibold">{bill.vendorName || '—'}</div>
          </div>
          <div className="col-md-4">
            <div className="small text-muted">วันที่เอกสาร</div>
            <div>{formatDate(bill.invoiceDate)}</div>
          </div>
          <div className="col-md-4">
            <div className="small text-muted">ครบกำหนด</div>
            <div>{formatDate(bill.dueDate)}</div>
          </div>
          {(bill.purchaseOrders?.length || 0) > 0 ? (
            <div className="col-12">
              <div className="small text-muted mb-1">อ้างอิง Purchase Order</div>
              <div className="d-flex flex-wrap gap-2">
                {bill.purchaseOrders!.map((po) => (
                  <button
                    key={po.id}
                    type="button"
                    className="badge text-bg-light border"
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/purchases/orders/${po.id}`)}
                  >
                    {po.number || `PO #${po.id}`}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {bill.notes ? (
            <div className="col-12">
              <div className="small text-muted">หมายเหตุ</div>
              <div>{bill.notes}</div>
            </div>
          ) : null}
        </div>
      </Card>

      <div className="row g-4 mb-4">
        <div className="col-lg-8">
          <Card className="p-3">
            <h5 className="h6 fw-semibold mb-3">รายการสินค้า/บริการ</h5>
            {bill.lines.length ? (
              <DataTable columns={lineColumns} rows={bill.lines} />
            ) : (
              <div className="text-muted small">ไม่มีรายการ</div>
            )}
          </Card>
        </div>
        <div className="col-lg-4">
          <Card className="p-3">
            <h5 className="h6 fw-semibold mb-3">สรุปยอด</h5>
            <div className="d-flex justify-content-between mb-2">
              <span className="text-muted">ก่อนภาษี</span>
              <span className="font-monospace">{bill.amountUntaxed.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="d-flex justify-content-between mb-2">
              <span className="text-muted">ภาษี</span>
              <span className="font-monospace">{bill.totalTax.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            {amountWht > 0 ? (
              <div className="d-flex justify-content-between mb-2">
                <span className="text-muted">หัก ณ ที่จ่าย</span>
                <span className="font-monospace">{amountWht.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            ) : null}
            <div className="d-flex justify-content-between mb-2">
              <span className="text-muted">ชำระแล้ว</span>
              <span className="font-monospace">{amountPaid.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="d-flex justify-content-between mb-3">
              <span className="text-muted">คงค้าง</span>
              <span className="font-monospace">{amountDue.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <hr />
            <div className="d-flex justify-content-between fw-semibold">
              <span>รวมทั้งสิ้น</span>
              <span className="font-monospace">
                {bill.total.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {bill.currency}
              </span>
            </div>
          </Card>
        </div>
      </div>
      {bill.payments?.some((payment) => payment.hasWht || (payment.whtCertCount ?? 0) > 0) ? (
        <Alert variant="info" className="small">
          พบการชำระที่มีข้อมูล WHT แล้วในระบบ สามารถกด Generate WHT หรือ Print WHT จากหน้านี้ได้
        </Alert>
      ) : null}
      <RegisterPaymentModal
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        onSubmit={async (payload) => {
          await paymentMutation.mutateAsync(payload as any)
        }}
        defaultAmount={Math.max(0, amountDue)}
        currency={bill.currency}
      />
    </div>
  )
}

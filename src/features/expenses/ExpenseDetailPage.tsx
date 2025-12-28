import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getExpense } from '@/api/services/expenses.service'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Spinner, Alert } from 'react-bootstrap'
import { DataTable, type Column } from '@/components/ui/DataTable'

export function ExpenseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const expenseId = id ? Number.parseInt(id, 10) : null

  const {
    data: expense,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['expense', expenseId],
    queryFn: () => getExpense(expenseId!),
    enabled: !!expenseId,
  })

  if (!expenseId) {
    return (
      <Alert variant="danger">
        <div className="fw-semibold mb-2">ไม่พบ ID ของรายจ่าย</div>
        <Button onClick={() => navigate('/expenses')}>กลับไปหน้ารายการ</Button>
      </Alert>
    )
  }

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

  if (error || !expense) {
    return (
      <Alert variant="danger">
        <div className="fw-semibold mb-2">เกิดข้อผิดพลาดในการโหลดข้อมูล</div>
        <div className="small mb-2">
          {error instanceof Error ? error.message : 'Unknown error'}
        </div>
        <Button onClick={() => navigate('/expenses')}>กลับไปหน้ารายการ</Button>
      </Alert>
    )
  }

  const statusTone =
    expense.status === 'done'
      ? 'green'
      : expense.status === 'posted'
        ? 'blue'
        : expense.status === 'approved'
          ? 'blue'
          : expense.status === 'reported'
            ? 'amber'
            : expense.status === 'draft'
              ? 'gray'
              : 'red'

  const statusLabel =
    expense.status === 'done'
      ? 'เสร็จสิ้น'
      : expense.status === 'posted'
        ? 'ลงบัญชีแล้ว'
        : expense.status === 'approved'
          ? 'อนุมัติแล้ว'
          : expense.status === 'reported'
            ? 'รายงานแล้ว'
            : expense.status === 'draft'
              ? 'ร่าง'
              : 'ปฏิเสธ'

  const lineColumns: Column<typeof expense.lines[number]>[] = [
    {
      key: 'description',
      header: 'รายละเอียด',
      cell: (r) => <span>{r.description || '—'}</span>,
    },
    {
      key: 'quantity',
      header: 'จำนวน',
      className: 'text-end',
      cell: (r) => <span className="font-monospace">{(r.quantity ?? 0).toLocaleString('th-TH')}</span>,
    },
    {
      key: 'unitPrice',
      header: 'ราคาต่อหน่วย',
      className: 'text-end',
      cell: (r) => (
        <span className="font-monospace">
          {(r.unitPrice ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: 'subtotal',
      header: 'ยอดรวม',
      className: 'text-end',
      cell: (r) => (
        <span className="fw-semibold font-monospace">
          {(r.subtotal ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: 'totalTax',
      header: 'ภาษี',
      className: 'text-end',
      cell: (r) => (
        <span className="font-monospace">
          {(r.totalTax ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: 'total',
      header: 'รวมทั้งสิ้น',
      className: 'text-end',
      cell: (r) => (
        <span className="fw-semibold font-monospace">
          {(r.total ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title={expense.number || `ร่าง #${expense.id}`}
        subtitle="รายละเอียดรายจ่าย"
        breadcrumb="รายจ่าย · รายละเอียด"
        actions={
          <div className="d-flex gap-2 flex-wrap">
            <Button size="sm" variant="ghost" onClick={() => navigate('/expenses')}>
              กลับ
            </Button>
          </div>
        }
      />

      <div className="row g-3 mb-3">
        <div className="col-md-6">
          <Card className="p-3">
            <div className="small text-muted mb-1">สถานะ</div>
            <div className="mb-3">
              <Badge tone={statusTone}>{statusLabel}</Badge>
            </div>
            <div className="small text-muted mb-1">พนักงาน</div>
            <div className="fw-semibold mb-3">{expense.employeeName || '—'}</div>
            <div className="small text-muted mb-1">วันที่รายจ่าย</div>
            <div className="fw-semibold mb-3">
              {expense.expenseDate
                ? new Date(expense.expenseDate).toLocaleDateString('th-TH', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })
                : '—'}
            </div>
          </Card>
        </div>

        <div className="col-md-6">
          <Card className="p-3">
            <div className="small text-muted mb-1">ยอดรวมก่อนภาษี</div>
            <div className="h5 fw-semibold mb-3 font-monospace">
              {(expense.amountUntaxed ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
              {expense.currency || 'THB'}
            </div>
            <div className="small text-muted mb-1">ภาษี</div>
            <div className="h5 fw-semibold mb-3 font-monospace">
              {(expense.totalTax ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
              {expense.currency || 'THB'}
            </div>
            <div className="small text-muted mb-1">รวมทั้งสิ้น</div>
            <div className="h4 fw-bold mb-0 font-monospace text-primary">
              {(expense.total ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
              {expense.currency || 'THB'}
            </div>
          </Card>
        </div>
      </div>

      {expense.lines && expense.lines.length > 0 ? (
        <Card className="p-3 mb-3">
          <div className="fw-semibold mb-3">รายการรายจ่าย</div>
          <DataTable columns={lineColumns} rows={expense.lines} plain />
        </Card>
      ) : null}

      {expense.notes ? (
        <Card className="p-3">
          <div className="small text-muted mb-1">หมายเหตุ</div>
          <div className="fw-semibold">{expense.notes}</div>
        </Card>
      ) : null}
    </div>
  )
}


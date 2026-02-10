import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Alert, Spinner } from 'react-bootstrap'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { getSalesOrder } from '@/api/services/sales-orders.service'

export function SalesOrderDetailPage() {
  const navigate = useNavigate()
  const params = useParams()
  const id = useMemo(() => Number(params.id), [params.id])

  const query = useQuery({
    queryKey: ['salesOrder', id],
    enabled: Number.isFinite(id) && id > 0,
    queryFn: () => getSalesOrder(id),
    staleTime: 30_000,
  })

  if (!Number.isFinite(id) || id <= 0) {
    return <Alert variant="danger" className="small mb-0">URL ไม่ถูกต้อง</Alert>
  }

  const rowData = (query.data?.lines || []).map((line, idx) => ({
    id: idx,
    description: line.description,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    total: line.total,
  }))

  const columns: Column<(typeof rowData)[number]>[] = [
    { key: 'description', header: 'รายละเอียด', cell: (r) => <span>{r.description || '—'}</span> },
    { key: 'quantity', header: 'จำนวน', className: 'text-end', cell: (r) => <span>{r.quantity.toLocaleString('th-TH')}</span> },
    {
      key: 'unitPrice',
      header: 'ราคาต่อหน่วย',
      className: 'text-end',
      cell: (r) => <span className="font-monospace">{r.unitPrice.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>,
    },
    {
      key: 'total',
      header: 'ยอดรวม',
      className: 'text-end',
      cell: (r) => <span className="font-monospace fw-semibold">{r.total.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>,
    },
  ]

  return (
    <div>
      <PageHeader
        title="รายละเอียดใบเสนอราคา / Sale Order"
        subtitle={query.data?.number || (query.data ? `เอกสาร #${query.data.id}` : 'กำลังโหลดข้อมูล...')}
        breadcrumb="รายรับ · ใบเสนอราคา · รายละเอียด"
        actions={
          <div className="d-flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => navigate('/sales/orders')}>
              กลับไปรายการ
            </Button>
            <Button size="sm" variant="secondary" onClick={() => navigate(`/sales/orders/${id}/edit`)} disabled={!query.data}>
              แก้ไข
            </Button>
          </div>
        }
      />

      {query.isLoading ? (
        <div className="d-flex align-items-center gap-2 py-4">
          <Spinner animation="border" size="sm" />
          <span className="small text-muted">กำลังโหลด...</span>
        </div>
      ) : query.isError ? (
        <Alert variant="danger" className="small">
          {query.error instanceof Error ? query.error.message : 'โหลดข้อมูลไม่สำเร็จ'}
        </Alert>
      ) : !query.data ? null : (
        <div className="row g-4">
          <div className="col-lg-8">
            <Card className="p-4">
              <div className="d-flex align-items-start justify-content-between gap-3 mb-3">
                <div>
                  <h2 className="h5 fw-semibold mb-2">{query.data.number || `#${query.data.id}`}</h2>
                  <div className="small text-muted">ลูกค้า: {query.data.partnerName || '—'}</div>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <Badge tone={query.data.orderType === 'sale' ? 'blue' : 'gray'}>
                    {query.data.orderType === 'sale' ? 'Sale Order' : 'ใบเสนอราคา'}
                  </Badge>
                  <Badge tone={query.data.status === 'cancel' ? 'red' : query.data.status === 'sale' || query.data.status === 'done' ? 'green' : 'gray'}>
                    {query.data.status}
                  </Badge>
                </div>
              </div>

              <DataTable
                plain
                columns={columns}
                rows={rowData}
                rowKey={(row) => row.id}
                empty={<div className="text-center text-muted py-4">ไม่มีรายการ</div>}
              />
            </Card>
          </div>

          <div className="col-lg-4">
            <Card className="p-4">
              <div className="small text-muted mb-1">วันที่เอกสาร</div>
              <div className="fw-semibold mb-3">{query.data.orderDate ? new Date(query.data.orderDate).toLocaleDateString('th-TH') : '—'}</div>

              <div className="small text-muted mb-1">วันหมดอายุ</div>
              <div className="fw-semibold mb-3">{query.data.validityDate ? new Date(query.data.validityDate).toLocaleDateString('th-TH') : '—'}</div>

              <div className="small text-muted mb-1">ยอดรวม</div>
              <div className="h5 fw-bold font-monospace mb-0">
                {query.data.total.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

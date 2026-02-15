import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Alert, Spinner } from 'react-bootstrap'
import { Button } from '@/components/ui/Button'
import { getSalesOrder } from '@/api/services/sales-orders.service'

export function SalesOrderPrintPreviewPage() {
  const navigate = useNavigate()
  const params = useParams()
  const id = useMemo(() => Number(params.id), [params.id])

  const query = useQuery({
    queryKey: ['salesOrder', 'printPreview', id],
    enabled: Number.isFinite(id) && id > 0,
    queryFn: () => getSalesOrder(id),
    staleTime: 30_000,
  })

  if (!Number.isFinite(id) || id <= 0) {
    return <Alert variant="danger" className="m-3">URL ไม่ถูกต้อง</Alert>
  }

  if (query.isLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center py-5">
        <Spinner animation="border" size="sm" />
        <span className="ms-2">กำลังโหลดเอกสาร...</span>
      </div>
    )
  }

  if (query.isError || !query.data) {
    return (
      <div className="container py-4">
        <Alert variant="danger">
          {query.error instanceof Error ? query.error.message : 'โหลดเอกสารไม่สำเร็จ'}
        </Alert>
        <Button variant="secondary" onClick={() => navigate(`/sales/orders/${id}`)}>
          กลับหน้ารายละเอียด
        </Button>
      </div>
    )
  }

  const order = query.data
  const documentLabel = order.orderType === 'sale' ? 'Sale Order' : 'ใบเสนอราคา'

  return (
    <div className="container py-4">
      <div className="d-flex gap-2 justify-content-end mb-3 d-print-none">
        <Button size="sm" variant="secondary" onClick={() => navigate(`/sales/orders/${id}`)}>
          กลับหน้ารายละเอียด
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          พิมพ์เอกสาร
        </Button>
      </div>

      <div className="bg-white border rounded-3 p-4 p-md-5" style={{ maxWidth: 980, margin: '0 auto' }}>
        <div className="d-flex justify-content-between align-items-start mb-4">
          <div>
            <h1 className="h3 mb-1">{documentLabel}</h1>
            <div className="text-muted">{order.number || `#${order.id}`}</div>
          </div>
          <div className="text-end small">
            <div>วันที่เอกสาร: {order.orderDate ? new Date(order.orderDate).toLocaleDateString('th-TH') : '-'}</div>
            <div>วันหมดอายุ: {order.validityDate ? new Date(order.validityDate).toLocaleDateString('th-TH') : '-'}</div>
            <div>สถานะ: {order.status}</div>
          </div>
        </div>

        <div className="mb-3">
          <div className="small text-muted">ลูกค้า</div>
          <div className="fw-semibold">{order.partnerName || '-'}</div>
        </div>

        <table className="table table-bordered align-middle">
          <thead className="table-light">
            <tr>
              <th style={{ width: '46%' }}>รายละเอียด</th>
              <th className="text-end" style={{ width: '14%' }}>จำนวน</th>
              <th className="text-end" style={{ width: '20%' }}>ราคาต่อหน่วย</th>
              <th className="text-end" style={{ width: '20%' }}>ยอดรวม</th>
            </tr>
          </thead>
          <tbody>
            {(order.lines || []).map((line, idx) => (
              <tr key={`${line.productId || 'item'}-${idx}`}>
                <td>{line.description || '-'}</td>
                <td className="text-end">{(line.quantity || 0).toLocaleString('th-TH')}</td>
                <td className="text-end">{(line.unitPrice || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="text-end fw-semibold">{(line.total || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            ))}
            {(!order.lines || order.lines.length === 0) && (
              <tr>
                <td colSpan={4} className="text-center text-muted">ไม่มีรายการสินค้า</td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="d-flex justify-content-end mt-3">
          <div style={{ minWidth: 320 }}>
            <div className="d-flex justify-content-between py-1 border-bottom">
              <span>ยอดก่อนภาษี</span>
              <span className="font-monospace">{(order.amountUntaxed || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="d-flex justify-content-between py-1 border-bottom">
              <span>ภาษี</span>
              <span className="font-monospace">{(order.totalTax || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="d-flex justify-content-between py-2 fw-bold">
              <span>ยอดรวมสุทธิ</span>
              <span className="font-monospace">{(order.total || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


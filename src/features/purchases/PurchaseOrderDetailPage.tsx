import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getPurchaseOrder,
  confirmPurchaseOrder,
  cancelPurchaseOrder,
  type PurchaseOrder,
} from '@/api/services/purchases.service'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Spinner, Alert, Modal, Card as BootstrapCard } from 'react-bootstrap'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { useState } from 'react'
import { toast } from '@/lib/toastStore'

export function PurchaseOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')

  const orderId = id ? Number.parseInt(id, 10) : null

  const {
    data: order,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['purchaseOrder', orderId],
    queryFn: () => getPurchaseOrder(orderId!),
    enabled: !!orderId,
  })

  const confirmMutation = useMutation({
    mutationFn: () => confirmPurchaseOrder(orderId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchaseOrder', orderId] })
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] })
      toast.success('ยืนยันใบสั่งซื้อสำเร็จ')
    },
    onError: (err) => {
      toast.error('ยืนยันใบสั่งซื้อไม่สำเร็จ', err instanceof Error ? err.message : undefined)
    },
  })

  const cancelMutation = useMutation({
    mutationFn: (reason?: string) => cancelPurchaseOrder(orderId!, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchaseOrder', orderId] })
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] })
      toast.success('ยกเลิกใบสั่งซื้อสำเร็จ')
      setCancelModalOpen(false)
      setCancelReason('')
    },
    onError: (err) => {
      toast.error('ยกเลิกใบสั่งซื้อไม่สำเร็จ', err instanceof Error ? err.message : undefined)
    },
  })

  const handleCancel = () => {
    cancelMutation.mutate(cancelReason || undefined)
  }

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
        <Spinner animation="border" role="status">
          <span className="visually-hidden">กำลังโหลด...</span>
        </Spinner>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="danger">
        <Alert.Heading>เกิดข้อผิดพลาด</Alert.Heading>
        <p>{error instanceof Error ? error.message : 'ไม่สามารถโหลดข้อมูลใบสั่งซื้อได้'}</p>
        <Button onClick={() => navigate('/purchases/orders')}>กลับไปหน้ารายการ</Button>
      </Alert>
    )
  }

  if (!order) {
    return (
      <Alert variant="warning">
        <Alert.Heading>ไม่พบข้อมูล</Alert.Heading>
        <p>ไม่พบใบสั่งซื้อที่ระบุ</p>
        <Button onClick={() => navigate('/purchases/orders')}>กลับไปหน้ารายการ</Button>
      </Alert>
    )
  }

  const statusTone =
    order.status === 'done'
      ? 'green'
      : order.status === 'purchase'
        ? 'blue'
        : order.status === 'sent'
          ? 'amber'
          : order.status === 'to_approve'
            ? 'amber'
            : order.status === 'draft'
              ? 'gray'
              : 'red'

  const statusLabel =
    order.status === 'done'
      ? 'เสร็จสิ้น'
      : order.status === 'purchase'
        ? 'ซื้อแล้ว'
        : order.status === 'sent'
          ? 'ส่งแล้ว'
          : order.status === 'to_approve'
            ? 'รออนุมัติ'
            : order.status === 'draft'
              ? 'ร่าง'
              : 'ยกเลิก'

  const canEdit = order.status === 'draft'
  const canConfirm = order.status === 'draft' || order.status === 'sent'
  const canCancel = order.status !== 'cancel' && order.status !== 'done'

  const lineRows = (order.lines || []).map((line, idx) => ({
    id: idx,
    description: line.description,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    subtotal: line.subtotal,
    totalTax: line.totalTax,
    total: line.total,
  }))

  const lineColumns: Column<(typeof lineRows)[number]>[] = [
    {
      key: 'description',
      header: 'รายละเอียด',
      cell: (r) => <span>{r.description || '—'}</span>,
    },
    {
      key: 'quantity',
      header: 'จำนวน',
      className: 'text-end',
      cell: (r) => <span className="font-monospace">{r.quantity.toLocaleString('th-TH')}</span>,
    },
    {
      key: 'unitPrice',
      header: 'ราคาต่อหน่วย',
      className: 'text-end',
      cell: (r) => (
        <span className="font-monospace">
          {r.unitPrice.toLocaleString('th-TH', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      ),
    },
    {
      key: 'subtotal',
      header: 'ยอดรวมก่อนภาษี',
      className: 'text-end',
      cell: (r) => (
        <span className="font-monospace">
          {r.subtotal.toLocaleString('th-TH', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      ),
    },
    {
      key: 'totalTax',
      header: 'ภาษี',
      className: 'text-end',
      cell: (r) => (
        <span className="font-monospace">
          {r.totalTax.toLocaleString('th-TH', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      ),
    },
    {
      key: 'total',
      header: 'ยอดรวม',
      className: 'text-end',
      cell: (r) => (
        <span className="fw-semibold font-monospace">
          {r.total.toLocaleString('th-TH', {
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
        title={order.number || `ใบสั่งซื้อ #${order.id}`}
        subtitle={`ผู้ขาย: ${order.vendorName || '—'}`}
        breadcrumb="รายจ่าย · ใบสั่งซื้อ"
        actions={
          <div className="d-flex align-items-center gap-2">
            {canEdit && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => navigate(`/purchases/orders/${order.id}/edit`)}
              >
                แก้ไข
              </Button>
            )}
            {canConfirm && (
              <Button
                size="sm"
                variant="primary"
                onClick={() => confirmMutation.mutate()}
                disabled={confirmMutation.isPending}
              >
                {confirmMutation.isPending ? 'กำลังยืนยัน...' : 'ยืนยันใบสั่งซื้อ'}
              </Button>
            )}
            {canCancel && (
              <Button
                size="sm"
                variant="danger"
                onClick={() => setCancelModalOpen(true)}
                disabled={cancelMutation.isPending}
              >
                ยกเลิก
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => navigate('/purchases/orders')}>
              กลับ
            </Button>
          </div>
        }
      />

      <div className="row g-3 mb-4">
        <div className="col-md-8">
          <BootstrapCard>
            <BootstrapCard.Header>
              <h5 className="mb-0">รายละเอียดใบสั่งซื้อ</h5>
            </BootstrapCard.Header>
            <BootstrapCard.Body>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label text-muted small">เลขที่เอกสาร</label>
                  <div className="fw-semibold font-monospace">{order.number || `ร่าง #${order.id}`}</div>
                </div>
                <div className="col-md-6">
                  <label className="form-label text-muted small">สถานะ</label>
                  <div>
                    <Badge tone={statusTone}>{statusLabel}</Badge>
                  </div>
                </div>
                <div className="col-md-6">
                  <label className="form-label text-muted small">ผู้ขาย</label>
                  <div className="fw-semibold">{order.vendorName || '—'}</div>
                </div>
                <div className="col-md-6">
                  <label className="form-label text-muted small">วันที่สั่งซื้อ</label>
                  <div>
                    {order.orderDate
                      ? new Date(order.orderDate).toLocaleDateString('th-TH', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })
                      : '—'}
                  </div>
                </div>
                {order.expectedDate && (
                  <div className="col-md-6">
                    <label className="form-label text-muted small">วันที่ส่งมอบ</label>
                    <div>
                      {new Date(order.expectedDate).toLocaleDateString('th-TH', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </div>
                  </div>
                )}
                {order.notes && (
                  <div className="col-12">
                    <label className="form-label text-muted small">หมายเหตุ</label>
                    <div className="text-muted">{order.notes}</div>
                  </div>
                )}
              </div>
            </BootstrapCard.Body>
          </BootstrapCard>
        </div>

        <div className="col-md-4">
          <BootstrapCard>
            <BootstrapCard.Header>
              <h5 className="mb-0">สรุปยอด</h5>
            </BootstrapCard.Header>
            <BootstrapCard.Body>
              <div className="d-flex justify-content-between mb-2">
                <span className="text-muted">ยอดรวมก่อนภาษี</span>
                <span className="font-monospace">
                  {order.amountUntaxed.toLocaleString('th-TH', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="d-flex justify-content-between mb-2">
                <span className="text-muted">ภาษี</span>
                <span className="font-monospace">
                  {order.totalTax.toLocaleString('th-TH', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <hr />
              <div className="d-flex justify-content-between">
                <span className="fw-semibold">ยอดรวมทั้งสิ้น</span>
                <span className="fw-semibold font-monospace">
                  {order.total.toLocaleString('th-TH', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{' '}
                  {order.currency}
                </span>
              </div>
            </BootstrapCard.Body>
          </BootstrapCard>
        </div>
      </div>

      <BootstrapCard>
        <BootstrapCard.Header>
          <h5 className="mb-0">รายการสินค้า</h5>
        </BootstrapCard.Header>
        <BootstrapCard.Body>
          {order.lines.length === 0 ? (
            <div className="text-center text-muted py-4">ไม่มีรายการ</div>
          ) : (
            <DataTable columns={lineColumns} rows={lineRows} />
          )}
        </BootstrapCard.Body>
      </BootstrapCard>

      {/* Cancel Modal */}
      <Modal show={cancelModalOpen} onHide={() => setCancelModalOpen(false)}>
        <Modal.Header closeButton>
          <Modal.Title>ยกเลิกใบสั่งซื้อ</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="mb-3">
            <label className="form-label">เหตุผลในการยกเลิก (ไม่บังคับ)</label>
            <textarea
              className="form-control"
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="ระบุเหตุผล..."
            />
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setCancelModalOpen(false)}>
            ยกเลิก
          </Button>
          <Button variant="danger" onClick={handleCancel} disabled={cancelMutation.isPending}>
            {cancelMutation.isPending ? 'กำลังยกเลิก...' : 'ยืนยันยกเลิก'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}


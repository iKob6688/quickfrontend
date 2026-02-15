import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert } from 'react-bootstrap'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { toast } from '@/lib/toastStore'
import {
  getPurchaseRequest,
  submitPurchaseRequest,
  cancelPurchaseRequest,
} from '@/api/services/purchase-requests.service'

export function PurchaseRequestDetailPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { id } = useParams<{ id: string }>()
  const requestId = id ? Number(id) : null

  const detailQuery = useQuery({
    queryKey: ['purchaseRequest', requestId],
    enabled: Boolean(requestId),
    queryFn: () => getPurchaseRequest(requestId!),
    staleTime: 30_000,
  })

  const submitMutation = useMutation({
    mutationFn: () => submitPurchaseRequest(requestId!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['purchaseRequest', requestId] })
      await queryClient.invalidateQueries({ queryKey: ['purchaseRequests'] })
      toast.success('ส่งอนุมัติสำเร็จ')
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'ส่งอนุมัติไม่สำเร็จ'),
  })

  const cancelMutation = useMutation({
    mutationFn: () => cancelPurchaseRequest(requestId!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['purchaseRequest', requestId] })
      await queryClient.invalidateQueries({ queryKey: ['purchaseRequests'] })
      toast.success('ยกเลิกคำขอซื้อสำเร็จ')
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'ยกเลิกไม่สำเร็จ'),
  })

  if (!requestId) return <Alert variant="danger">invalid id</Alert>
  if (detailQuery.isLoading) return <div className="small text-muted">กำลังโหลดข้อมูล...</div>
  if (detailQuery.isError || !detailQuery.data) {
    return <Alert variant="danger">{detailQuery.error instanceof Error ? detailQuery.error.message : 'โหลดคำขอซื้อไม่สำเร็จ'}</Alert>
  }

  const req = detailQuery.data
  const stateTone =
    req.state === 'done'
      ? 'green'
      : req.state === 'approved'
        ? 'blue'
        : req.state === 'to_approve'
          ? 'amber'
          : req.state === 'rejected'
            ? 'red'
            : req.state === 'cancel'
              ? 'red'
              : 'gray'

  const rows = (req.lines || []).map((line, idx) => ({
    idx: idx + 1,
    productId: line.productId || null,
    description: line.description || '—',
    qty: Number(line.quantity || 0),
    estimatedCost: Number(line.estimatedCost || 0),
    total: Number(line.quantity || 0) * Number(line.estimatedCost || 0),
  }))

  const columns: Column<(typeof rows)[number]>[] = [
    { key: 'idx', header: '#', className: 'text-nowrap', cell: (r) => <span>{r.idx}</span> },
    { key: 'productId', header: 'สินค้า', className: 'text-nowrap', cell: (r) => <span>{r.productId ?? '—'}</span> },
    { key: 'description', header: 'รายละเอียด', cell: (r) => <span>{r.description}</span> },
    { key: 'qty', header: 'จำนวน', className: 'text-end', cell: (r) => <span>{r.qty}</span> },
    { key: 'estimatedCost', header: 'ราคาโดยประมาณ', className: 'text-end', cell: (r) => <span>{r.estimatedCost.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> },
    { key: 'total', header: 'รวม', className: 'text-end', cell: (r) => <span className="fw-semibold">{r.total.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> },
  ]

  return (
    <div>
      <PageHeader
        title={req.name || `PR #${req.id}`}
        subtitle="รายละเอียดคำขอซื้อ"
        breadcrumb="รายจ่าย · คำขอซื้อ · รายละเอียด"
        actions={
          <div className="d-flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => navigate('/purchases/requests')}>
              กลับ
            </Button>
            <Button size="sm" variant="secondary" onClick={() => navigate(`/purchases/requests/${req.id}/edit`)}>
              แก้ไข
            </Button>
            {req.state === 'draft' ? (
              <Button size="sm" onClick={() => submitMutation.mutate()} isLoading={submitMutation.isPending}>
                ส่งอนุมัติ
              </Button>
            ) : null}
            {req.state !== 'cancel' && req.state !== 'done' ? (
              <Button size="sm" variant="ghost" onClick={() => cancelMutation.mutate()} isLoading={cancelMutation.isPending}>
                ยกเลิก
              </Button>
            ) : null}
          </div>
        }
      />

      <Card className="p-4 mb-4">
        <div className="d-flex align-items-center justify-content-between">
          <div>
            <div className="small text-muted">ผู้ขอซื้อ</div>
            <div className="fw-semibold">{req.requestorName || '—'}</div>
          </div>
          <Badge tone={stateTone}>
            {req.state}
          </Badge>
        </div>
      </Card>

      <DataTable
        title="รายการสินค้า"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.idx}
        empty={<div className="text-muted small">ไม่มีรายการสินค้า</div>}
      />
    </div>
  )
}

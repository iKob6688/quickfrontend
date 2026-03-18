import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Spinner } from 'react-bootstrap'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { getSalesDelivery, openSalesDeliveryPdf, validateSalesDelivery, type StockPickingMoveLine } from '@/api/services/stock-pickings.service'
import { toast } from '@/lib/toastStore'
import { useAppDateTimeFormatter } from '@/lib/dateFormat'

export function SalesDeliveryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const formatDateTime = useAppDateTimeFormatter()
  const deliveryId = id ? Number.parseInt(id, 10) : null

  const { data, isLoading, error } = useQuery({
    queryKey: ['salesDelivery', deliveryId],
    queryFn: () => getSalesDelivery(deliveryId!),
    enabled: !!deliveryId,
  })

  const validateMutation = useMutation({
    mutationFn: () => validateSalesDelivery(deliveryId!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['salesDelivery', deliveryId] })
      await queryClient.invalidateQueries({ queryKey: ['salesOrder'] })
      toast.success('ยืนยันการจัดส่งสำเร็จ')
    },
    onError: (err) => {
      toast.error('ยืนยันการจัดส่งไม่สำเร็จ', err instanceof Error ? err.message : undefined)
    },
  })

  if (isLoading) {
    return <div className="d-flex justify-content-center py-5"><Spinner animation="border" /></div>
  }
  if (error || !data) {
    return (
      <div>
        <PageHeader title="ไม่พบ Delivery" subtitle="โหลดข้อมูลไม่สำเร็จ" breadcrumb="รายรับ · Delivery" />
        <Alert variant="danger" className="small">{error instanceof Error ? error.message : 'Unknown error'}</Alert>
      </div>
    )
  }

  const canValidate = !['done', 'cancel'].includes(data.state)
  const columns: Column<StockPickingMoveLine>[] = [
    { key: 'productName', header: 'สินค้า', cell: (r) => <span>{r.productName || '—'}</span> },
    { key: 'orderedQty', header: 'สั่ง/ส่ง', className: 'text-end', cell: (r) => <span className="font-monospace">{r.orderedQty.toLocaleString('th-TH')}</span> },
    { key: 'doneQty', header: 'ทำแล้ว', className: 'text-end', cell: (r) => <span className="font-monospace">{r.doneQty.toLocaleString('th-TH')}</span> },
    { key: 'uom', header: 'หน่วย', cell: (r) => <span>{r.uom || '—'}</span> },
  ]

  return (
    <div>
      <PageHeader
        title={`Delivery ${data.name || `#${data.id}`}`}
        subtitle={data.partnerName || data.origin || 'เอกสารจัดส่ง'}
        breadcrumb="รายรับ · Delivery"
        actions={
          <div className="d-flex gap-2">
            {canValidate ? (
              <Button size="sm" onClick={() => validateMutation.mutate()} disabled={validateMutation.isPending}>
                {validateMutation.isPending ? 'กำลังยืนยัน...' : 'Confirm → Delivery'}
              </Button>
            ) : null}
            <Button size="sm" variant="secondary" onClick={() => openSalesDeliveryPdf(data.id)}>
              พิมพ์ใบส่งสินค้า
            </Button>
            <Button size="sm" variant="secondary" onClick={() => window.open(`/web#id=${data.id}&model=stock.picking&view_type=form`, '_blank', 'noopener,noreferrer')}>
              เปิดใน Odoo
            </Button>
            <Button size="sm" variant="ghost" onClick={() => navigate(-1)}>กลับ</Button>
          </div>
        }
      />
      <Card className="p-4 mb-4">
        <div className="d-flex flex-wrap gap-2 align-items-center mb-2">
          <Badge tone={data.state === 'done' ? 'green' : data.state === 'cancel' ? 'red' : 'blue'}>{data.state}</Badge>
          <span className="small text-muted">Origin:</span>
          <span className="fw-semibold">{data.origin || '—'}</span>
        </div>
        <div className="row g-3">
          <div className="col-md-4"><div className="small text-muted">คู่ค้า</div><div>{data.partnerName || '—'}</div></div>
          <div className="col-md-4"><div className="small text-muted">กำหนดส่ง</div><div>{formatDateTime(data.scheduledDate)}</div></div>
          <div className="col-md-4"><div className="small text-muted">เสร็จสิ้น</div><div>{formatDateTime(data.dateDone)}</div></div>
        </div>
      </Card>
      <Card className="p-3">
        <h5 className="h6 fw-semibold mb-3">รายการจัดส่ง</h5>
        <DataTable columns={columns} rows={data.moves || []} />
      </Card>
    </div>
  )
}

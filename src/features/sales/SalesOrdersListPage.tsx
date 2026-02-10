import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Spinner } from 'react-bootstrap'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Tabs } from '@/components/ui/Tabs'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import { listSalesOrders, type SalesOrderStatus } from '@/api/services/sales-orders.service'

type StatusTab = 'all' | SalesOrderStatus

export function SalesOrdersListPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const typeParam = searchParams.get('type')
  const forcedOrderType = typeParam === 'sale' ? 'sale' : typeParam === 'quotation' ? 'quotation' : undefined
  const [tab, setTab] = useState<StatusTab>('all')
  const [q, setQ] = useState('')
  const qDebounced = useDebouncedValue(q, 300)
  const limit = 30

  const query = useInfiniteQuery({
    queryKey: ['salesOrders', tab, forcedOrderType, qDebounced, limit],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      listSalesOrders({
        status: tab === 'all' ? undefined : tab,
        orderType: forcedOrderType,
        search: qDebounced || undefined,
        limit,
        offset: pageParam,
      }),
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage || lastPage.length < limit) return undefined
      return allPages.reduce((acc, page) => acc + page.length, 0)
    },
    staleTime: 30_000,
  })

  const orders = useMemo(() => query.data?.pages.flatMap((p) => p) ?? [], [query.data?.pages])

  const rows = useMemo(
    () =>
      orders.map((order) => ({
        id: order.id,
        number: order.number,
        orderType: order.orderType,
        customer: order.partnerName,
        date: order.orderDate
          ? new Date(order.orderDate).toLocaleDateString('th-TH', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
            })
          : '—',
        total: order.total,
        status: order.status,
      })),
    [orders],
  )

  const columns: Column<(typeof rows)[number]>[] = [
    {
      key: 'number',
      header: 'เลขที่เอกสาร',
      className: 'text-nowrap',
      cell: (r) => (
        <button
          type="button"
          className="btn btn-link p-0 fw-semibold text-primary text-decoration-none font-monospace"
          onClick={() => navigate(`/sales/orders/${r.id}`)}
        >
          {r.number || `ร่าง #${r.id}`}
        </button>
      ),
    },
    {
      key: 'orderType',
      header: 'ประเภท',
      className: 'text-nowrap',
      cell: (r) => <Badge tone={r.orderType === 'sale' ? 'blue' : 'gray'}>{r.orderType === 'sale' ? 'Sale Order' : 'ใบเสนอราคา'}</Badge>,
    },
    { key: 'customer', header: 'ลูกค้า', cell: (r) => <span>{r.customer}</span> },
    { key: 'date', header: 'วันที่เอกสาร', className: 'text-nowrap', cell: (r) => <span>{r.date}</span> },
    {
      key: 'total',
      header: 'มูลค่ารวม',
      className: 'text-end',
      cell: (r) => (
        <span className="fw-semibold font-monospace">
          {r.total.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'สถานะ',
      className: 'text-nowrap',
      cell: (r) => {
        const tone =
          r.status === 'done'
            ? 'green'
            : r.status === 'sale'
              ? 'blue'
              : r.status === 'sent'
                ? 'amber'
                : r.status === 'cancel'
                  ? 'red'
                  : 'gray'
        const label =
          r.status === 'done'
            ? 'เสร็จสิ้น'
            : r.status === 'sale'
              ? 'ยืนยันแล้ว'
              : r.status === 'sent'
                ? 'ส่งแล้ว'
                : r.status === 'cancel'
                  ? 'ยกเลิก'
                  : 'ร่าง'
        return <Badge tone={tone}>{label}</Badge>
      },
    },
  ]

  return (
    <div>
      <PageHeader
        title="ใบเสนอราคา / Sale Order"
        subtitle={
          forcedOrderType === 'quotation'
            ? 'โหมดใบเสนอราคา'
            : forcedOrderType === 'sale'
              ? 'โหมด Sale Order'
              : 'จัดการใบเสนอราคาและคำสั่งขายให้สอดคล้องกับ Odoo18'
        }
        breadcrumb="รายรับ · ใบเสนอราคา · Sale Order"
        actions={
          <div className="d-flex align-items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => navigate('/sales/orders/new?orderType=quotation')}>
              + สร้างใบเสนอราคา
            </Button>
            <Button size="sm" onClick={() => navigate('/sales/orders/new?orderType=sale')}>
              + สร้าง Sale Order
            </Button>
          </div>
        }
      />

      <div className="mb-4 d-flex flex-column gap-3 flex-sm-row align-items-sm-center justify-content-sm-between">
        <Tabs
          value={tab}
          onChange={(next) => setTab(next as StatusTab)}
          items={[
            { key: 'all', label: 'ทั้งหมด' },
            { key: 'draft', label: 'ร่าง' },
            { key: 'sent', label: 'ส่งแล้ว' },
            { key: 'sale', label: 'ยืนยันแล้ว' },
            { key: 'done', label: 'เสร็จสิ้น' },
            { key: 'cancel', label: 'ยกเลิก' },
          ]}
        />
        <div className="w-100" style={{ maxWidth: 360 }}>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหาเลขที่เอกสาร / ลูกค้า"
            leftAdornment={<i className="bi bi-search"></i>}
          />
        </div>
      </div>

      {query.isLoading ? (
        <div className="d-flex justify-content-center align-items-center py-5">
          <Spinner animation="border" role="status" />
          <span className="ms-3">กำลังโหลดข้อมูล...</span>
        </div>
      ) : query.isError ? (
        <div className="alert alert-danger">
          <p className="fw-semibold mb-2">โหลดใบเสนอราคา / Sale Order ไม่สำเร็จ</p>
          <p className="small mb-2">{query.error instanceof Error ? query.error.message : 'Unknown error'}</p>
          <p className="small mb-3 mb-0">
            ตรวจสอบ backend endpoint <code>/api/th/v1/sales/orders/*</code> ในโมดูล <code>adt_th_api</code>
          </p>
        </div>
      ) : (
        <div className="d-flex flex-column gap-3">
          <DataTable
            title="รายการใบเสนอราคา / Sale Order"
            right={
              <Button size="sm" variant="ghost" onClick={() => query.refetch()}>
                <i className="bi bi-arrow-clockwise me-1"></i>
                รีเฟรช
              </Button>
            }
            columns={columns}
            rows={rows}
            rowKey={(row) => row.id}
            empty={
              <div>
                <p className="h6 fw-semibold mb-2">ยังไม่มีข้อมูล</p>
                <p className="small text-muted mb-0">{qDebounced ? 'ไม่พบข้อมูลที่ค้นหา' : 'ยังไม่มีใบเสนอราคา/Sale Order ในระบบ'}</p>
              </div>
            }
          />

          <div className="d-flex justify-content-between align-items-center">
            <div className="small text-muted">แสดงแล้ว {rows.length} รายการ</div>
            {query.hasNextPage ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => query.fetchNextPage()}
                isLoading={query.isFetchingNextPage}
              >
                โหลดเพิ่ม
              </Button>
            ) : (
              <div className="small text-muted">ครบแล้ว</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

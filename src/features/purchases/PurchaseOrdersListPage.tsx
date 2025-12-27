import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Tabs } from '@/components/ui/Tabs'
import { Input } from '@/components/ui/Input'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { useMemo, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { listPurchaseOrders } from '@/api/services/purchases.service'
import { useNavigate } from 'react-router-dom'
import { Spinner } from 'react-bootstrap'
import { useDebouncedValue } from '@/lib/useDebouncedValue'

export function PurchaseOrdersListPage() {
  const navigate = useNavigate()
  type StatusTab = 'all' | 'draft' | 'sent' | 'to_approve' | 'purchase' | 'done' | 'cancel'
  const [tab, setTab] = useState<StatusTab>('all')
  const [q, setQ] = useState('')
  const qDebounced = useDebouncedValue(q, 300)
  const limit = 30

  const query = useInfiniteQuery({
    queryKey: ['purchaseOrders', tab, qDebounced, limit],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      return await listPurchaseOrders({
        status: tab === 'all' ? undefined : tab,
        search: qDebounced || undefined,
        limit,
        offset: pageParam,
      })
    },
    getNextPageParam: (lastPage, allPages) => {
      // backend doesn't return total; we stop when the page returns fewer items than `limit`
      if (!lastPage || lastPage.length < limit) return undefined
      return allPages.reduce((acc, p) => acc + (p?.length ?? 0), 0)
    },
    staleTime: 30_000,
  })

  const orders = useMemo(() => {
    const allOrders = query.data?.pages.flatMap((p) => p ?? []) ?? []
    
    // Debug: Log orders data structure
    if (process.env.NODE_ENV === 'development' && allOrders.length > 0) {
      console.debug('[PurchaseOrdersListPage] Orders data:', {
        total: allOrders.length,
        firstOrder: allOrders[0],
        hasVendorName: allOrders[0]?.vendorName,
        hasOrderDate: allOrders[0]?.orderDate,
        hasTotal: allOrders[0]?.total,
        hasStatus: allOrders[0]?.status,
      })
    }
    
    // Filter out invalid entries and ensure minimum required fields
    return allOrders.filter((order) => order && typeof order.id === 'number')
  }, [query.data?.pages])

  // Transform API data to table rows
  const rows = useMemo(() => {
    return orders.map((order) => ({
      id: order.id ?? 0,
      number: order.number ?? '',
      vendor: order.vendorName ?? '—',
      date: order.orderDate
        ? new Date(order.orderDate).toLocaleDateString('th-TH', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          })
        : '—',
      expectedDate: order.expectedDate
        ? new Date(order.expectedDate).toLocaleDateString('th-TH', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          })
        : '—',
      total: typeof order.total === 'number' ? order.total : 0,
      status: order.status ?? 'draft',
      currency: order.currency ?? 'THB',
    }))
  }, [orders])

  const columns: Column<(typeof rows)[number]>[] = [
    {
      key: 'number',
      header: 'เลขที่เอกสาร',
      className: 'text-nowrap',
      cell: (r) => (
        <button
          type="button"
          className="btn btn-link p-0 fw-semibold text-primary text-decoration-none font-monospace"
          onClick={() => navigate(`/purchases/orders/${r.id}`)}
        >
          {r.number || `ร่าง #${r.id}`}
        </button>
      ),
    },
    {
      key: 'vendor',
      header: 'ผู้ขาย',
      cell: (r) => <span>{r.vendor}</span>,
    },
    {
      key: 'date',
      header: 'วันที่สั่งซื้อ',
      className: 'text-nowrap',
      cell: (r) => <span>{r.date}</span>,
    },
    {
      key: 'expectedDate',
      header: 'วันที่ส่งมอบ',
      className: 'text-nowrap',
      cell: (r) => <span>{r.expectedDate}</span>,
    },
    {
      key: 'total',
      header: 'มูลค่ารวม',
      className: 'text-end',
      cell: (r) => (
        <span className="fw-semibold font-monospace">
          {(r.total ?? 0).toLocaleString('th-TH', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}{' '}
          {r.currency || 'THB'}
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
            : r.status === 'purchase'
              ? 'blue'
              : r.status === 'sent'
                ? 'amber'
                : r.status === 'to_approve'
                  ? 'amber'
                  : r.status === 'draft'
                    ? 'gray'
                    : 'red'
        const label =
          r.status === 'done'
            ? 'เสร็จสิ้น'
            : r.status === 'purchase'
              ? 'ซื้อแล้ว'
              : r.status === 'sent'
                ? 'ส่งแล้ว'
                : r.status === 'to_approve'
                  ? 'รออนุมัติ'
                  : r.status === 'draft'
                    ? 'ร่าง'
                    : 'ยกเลิก'
        return <Badge tone={tone}>{label}</Badge>
      },
    },
  ]

  return (
    <div>
      <PageHeader
        title="ใบสั่งซื้อ"
        subtitle="ค้นหา ดู และจัดการใบสั่งซื้อ"
        breadcrumb="รายจ่าย · ใบสั่งซื้อ"
        actions={
          <div className="d-flex align-items-center gap-2">
            <Button
              size="sm"
              onClick={() => navigate('/purchases/orders/new')}
            >
              + สร้างใบสั่งซื้อ
            </Button>
            <Button size="sm" variant="secondary" disabled>
              พิมพ์รายงาน
            </Button>
          </div>
        }
      />

      <div className="mb-4 d-flex flex-column gap-3 flex-sm-row align-items-sm-center justify-content-sm-between">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { key: 'all', label: 'ทั้งหมด' },
            { key: 'draft', label: 'ร่าง' },
            { key: 'sent', label: 'ส่งแล้ว' },
            { key: 'to_approve', label: 'รออนุมัติ' },
            { key: 'purchase', label: 'ซื้อแล้ว' },
            { key: 'done', label: 'เสร็จสิ้น' },
            { key: 'cancel', label: 'ยกเลิก' },
          ]}
        />
        <div className="w-100" style={{ maxWidth: '360px' }}>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหาเลขที่เอกสาร / ผู้ขาย"
            leftAdornment={<i className="bi bi-search"></i>}
          />
        </div>
      </div>

      {query.isLoading ? (
        <div className="d-flex justify-content-center align-items-center py-5">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">กำลังโหลด...</span>
          </Spinner>
          <span className="ms-3">กำลังโหลดข้อมูล...</span>
        </div>
      ) : query.isError ? (
        <div className="alert alert-danger">
          <p className="fw-semibold mb-2">เกิดข้อผิดพลาดในการโหลดข้อมูล</p>
          <p className="small mb-2">
            {query.error instanceof Error ? query.error.message : 'Unknown error'}
          </p>
          <Button size="sm" onClick={() => query.refetch()}>
            ลองอีกครั้ง
          </Button>
        </div>
      ) : (
        <div className="d-flex flex-column gap-3">
          <DataTable
            title="รายการใบสั่งซื้อ"
            right={
              <div className="d-flex align-items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => query.refetch()}>
                  <i className="bi bi-arrow-clockwise me-1"></i>
                  รีเฟรช
                </Button>
              </div>
            }
            columns={columns}
            rows={rows}
            empty={
              <div>
                <p className="h6 fw-semibold mb-2">ยังไม่มีข้อมูล</p>
                <p className="small text-muted mb-0">
                  {qDebounced
                    ? 'ไม่พบข้อมูลที่ค้นหา ลองค้นหาด้วยคำอื่น'
                    : 'ยังไม่มีใบสั่งซื้อในระบบ'}
                </p>
              </div>
            }
          />

          <div className="d-flex justify-content-between align-items-center">
            <div className="small text-muted">
              แสดงแล้ว {rows.length} รายการ
            </div>
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


import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Tabs } from '@/components/ui/Tabs'
import { Input } from '@/components/ui/Input'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { useMemo, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { listPurchaseRequests } from '@/api/services/purchase-requests.service'
import { useNavigate } from 'react-router-dom'
import { Spinner } from 'react-bootstrap'
import { useDebouncedValue } from '@/lib/useDebouncedValue'

export function PurchaseRequestsListPage() {
  const navigate = useNavigate()
  type StatusTab = 'all' | 'draft' | 'to_approve' | 'approved' | 'rejected' | 'done' | 'cancel'
  const [tab, setTab] = useState<StatusTab>('all')
  const [q, setQ] = useState('')
  const qDebounced = useDebouncedValue(q, 300)
  const limit = 30

  const query = useInfiniteQuery({
    queryKey: ['purchaseRequests', tab, qDebounced, limit],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      return await listPurchaseRequests({
        state: tab === 'all' ? undefined : tab,
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

  const requests = useMemo(() => {
    return query.data?.pages.flatMap((p) => p) ?? []
  }, [query.data?.pages])

  // Transform API data to table rows
  const rows = useMemo(() => {
    return requests.map((request) => ({
      id: request.id,
      name: request.name,
      requestor: request.requestorName,
      date: request.requestedDate
        ? new Date(request.requestedDate).toLocaleDateString('th-TH', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          })
        : '—',
      requiredDate: request.requiredDate
        ? new Date(request.requiredDate).toLocaleDateString('th-TH', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          })
        : '—',
      estimatedCost: request.totalEstimatedCost ?? 0,
      status: request.state,
      purchaseOrderName: request.purchaseOrderName,
    }))
  }, [requests])

  const columns: Column<(typeof rows)[number]>[] = [
    {
      key: 'name',
      header: 'เลขที่คำขอ',
      className: 'text-nowrap',
      cell: (r) => (
        <button
          type="button"
          className="btn btn-link p-0 fw-semibold text-primary text-decoration-none font-monospace"
          onClick={() => navigate(`/purchases/requests/${r.id}`)}
        >
          {r.name || `ร่าง #${r.id}`}
        </button>
      ),
    },
    {
      key: 'requestor',
      header: 'ผู้ขอซื้อ',
      cell: (r) => <span>{r.requestor}</span>,
    },
    {
      key: 'date',
      header: 'วันที่ขอ',
      className: 'text-nowrap',
      cell: (r) => <span>{r.date}</span>,
    },
    {
      key: 'requiredDate',
      header: 'วันที่ต้องการ',
      className: 'text-nowrap',
      cell: (r) => <span>{r.requiredDate}</span>,
    },
    {
      key: 'estimatedCost',
      header: 'มูลค่าโดยประมาณ',
      className: 'text-end',
      cell: (r) => (
        <span className="fw-semibold font-monospace">
          {r.estimatedCost.toLocaleString('th-TH', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
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
            : r.status === 'approved'
              ? 'blue'
              : r.status === 'to_approve'
                ? 'amber'
                : r.status === 'rejected'
                  ? 'red'
                  : r.status === 'draft'
                    ? 'gray'
                    : 'gray'
        const label =
          r.status === 'done'
            ? 'เสร็จสิ้น'
            : r.status === 'approved'
              ? 'อนุมัติแล้ว'
              : r.status === 'to_approve'
                ? 'รออนุมัติ'
                : r.status === 'rejected'
                  ? 'ปฏิเสธ'
                  : r.status === 'draft'
                    ? 'ร่าง'
                    : 'ยกเลิก'
        return <Badge tone={tone}>{label}</Badge>
      },
    },
    {
      key: 'purchaseOrder',
      header: 'ใบสั่งซื้อ',
      className: 'text-nowrap',
      cell: (r) => (
        r.purchaseOrderName ? (
          <span className="font-monospace text-muted small">{r.purchaseOrderName}</span>
        ) : (
          <span className="text-muted small">—</span>
        )
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="คำขอซื้อ"
        subtitle="ค้นหา ดู และจัดการคำขอซื้อ"
        breadcrumb="รายจ่าย · คำขอซื้อ"
        actions={
          <div className="d-flex align-items-center gap-2">
            <Button
              size="sm"
              onClick={() => navigate('/purchases/requests/new')}
            >
              + สร้างคำขอซื้อ
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
            { key: 'to_approve', label: 'รออนุมัติ' },
            { key: 'approved', label: 'อนุมัติแล้ว' },
            { key: 'done', label: 'เสร็จสิ้น' },
            { key: 'rejected', label: 'ปฏิเสธ' },
            { key: 'cancel', label: 'ยกเลิก' },
          ]}
        />
        <div className="w-100" style={{ maxWidth: '360px' }}>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหาเลขที่คำขอ / ผู้ขอซื้อ"
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
            title="รายการคำขอซื้อ"
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
                    : 'ยังไม่มีคำขอซื้อในระบบ'}
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


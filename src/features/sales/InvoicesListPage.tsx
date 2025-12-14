import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Tabs } from '@/components/ui/Tabs'
import { Input } from '@/components/ui/Input'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { useMemo, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { listInvoices } from '@/api/services/invoices.service'
import { useNavigate } from 'react-router-dom'
import { Spinner } from 'react-bootstrap'
import { useDebouncedValue } from '@/lib/useDebouncedValue'

export function InvoicesListPage() {
  const navigate = useNavigate()
  type StatusTab = 'all' | 'draft' | 'posted' | 'paid' | 'cancelled'
  const [tab, setTab] = useState<StatusTab>('all')
  const [q, setQ] = useState('')
  const qDebounced = useDebouncedValue(q, 300)
  const limit = 30

  const query = useInfiniteQuery({
    queryKey: ['invoices', tab, qDebounced, limit],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      return await listInvoices({
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

  const invoices = useMemo(() => {
    return query.data?.pages.flatMap((p) => p) ?? []
  }, [query.data?.pages])

  // Transform API data to table rows
  const rows = useMemo(() => {
    return invoices.map((inv) => ({
      id: inv.id,
      number: inv.number,
      customer: inv.customerName,
      date: inv.invoiceDate
        ? new Date(inv.invoiceDate).toLocaleDateString('th-TH', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          })
        : '—',
      total: inv.total,
      status: inv.status,
      paymentState: inv.paymentState,
      amountPaid: inv.amountPaid,
      amountDue: inv.amountDue,
    }))
  }, [invoices])

  const columns: Column<(typeof rows)[number]>[] = [
    {
      key: 'number',
      header: 'เลขที่เอกสาร',
      className: 'text-nowrap',
      cell: (r) => (
        <button
          type="button"
          className="btn btn-link p-0 fw-semibold text-primary text-decoration-none font-monospace"
          onClick={() => navigate(`/sales/invoices/${r.id}`)}
        >
          {r.number || `ร่าง #${r.id}`}
        </button>
      ),
    },
    { 
      key: 'customer', 
      header: 'ลูกค้า', 
      cell: (r) => <span>{r.customer}</span>
    },
    { 
      key: 'date', 
      header: 'วันที่เอกสาร',
      className: 'text-nowrap',
      cell: (r) => <span>{r.date}</span>
    },
    {
      key: 'total',
      header: 'มูลค่ารวม',
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
    {
      key: 'status',
      header: 'สถานะ',
      className: 'text-nowrap',
      cell: (r) => {
        const tone =
          r.status === 'paid'
            ? 'green'
            : r.status === 'posted'
              ? 'blue'
              : r.status === 'draft'
                ? 'gray'
                : 'red'
        const label =
          r.status === 'paid'
            ? 'รับชำระแล้ว'
            : r.status === 'posted'
              ? 'ยืนยันแล้ว'
              : r.status === 'draft'
                ? 'ร่าง'
                : 'ยกเลิก'
        return <Badge tone={tone}>{label}</Badge>
      },
    },
    {
      key: 'paymentStatus',
      header: 'สถานะการชำระ',
      className: 'text-nowrap',
      cell: (r) => {
        // Only show payment status for posted invoices
        if (r.status !== 'posted') {
          return <span className="text-muted small">—</span>
        }
        
        const paymentState = r.paymentState
        const total = r.total ?? 0
        const amountDue = r.amountDue ?? 0
        const amountPaid = r.amountPaid ?? 0
        
        // Use paymentState as primary source (most reliable from Odoo)
        if (paymentState === 'paid') {
          // Fully paid according to Odoo payment_state
          return <Badge tone="green">ชำระครบแล้ว</Badge>
        } else if (paymentState === 'partial' || paymentState === 'in_payment') {
          // Partially paid
          return <Badge tone="amber">ชำระบางส่วน</Badge>
        } else if (paymentState === 'not_paid') {
          // Not paid
          return <Badge tone="gray">รอการชำระ</Badge>
        }
        
        // Fallback: use amounts if paymentState is missing
        // If total is 0, no payment status (treat as unpaid for display)
        if (total === 0 || (amountDue === total && amountPaid === 0)) {
          return <Badge tone="gray">รอการชำระ</Badge>
        }
        
        // Check amounts
        if (amountDue === 0 && amountPaid > 0 && total > 0) {
          return <Badge tone="green">ชำระครบแล้ว</Badge>
        } else if (amountPaid > 0 && amountDue > 0) {
          return <Badge tone="amber">ชำระบางส่วน</Badge>
        } else {
          return <Badge tone="gray">รอการชำระ</Badge>
        }
      },
    },
  ]

  return (
    <div>
      <PageHeader
        title="ใบเสร็จรับเงิน / ใบแจ้งหนี้"
        subtitle="ค้นหา ดู และจัดการเอกสารขาย (รูปแบบ UI ใกล้ PEAK)"
        breadcrumb="รายรับ · ใบเสร็จรับเงิน"
        actions={
          <div className="d-flex align-items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => navigate('/sales/invoices/new')}
            >
              + ออกใบเสร็จ
            </Button>
            <Button
              size="sm"
              onClick={() => navigate('/sales/invoices/new')}
            >
              + สร้างใบแจ้งหนี้
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
            { key: 'posted', label: 'ยืนยันแล้ว' },
            { key: 'paid', label: 'รับชำระแล้ว' },
            { key: 'cancelled', label: 'ยกเลิก' },
          ]}
        />
        <div className="w-100" style={{ maxWidth: '360px' }}>
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
            title="รายการเอกสาร"
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
                    : 'ยังไม่มีใบแจ้งหนี้ในระบบ'}
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



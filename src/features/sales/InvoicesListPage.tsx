import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Tabs } from '@/components/ui/Tabs'
import { Input } from '@/components/ui/Input'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { useMemo, useState } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { listInvoices } from '@/api/services/invoices.service'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Spinner } from 'react-bootstrap'
import { useDebouncedValue } from '@/lib/useDebouncedValue'

interface InvoicesListPageProps {
  mode?: 'invoices' | 'receipts'
}

export function InvoicesListPage({ mode = 'invoices' }: InvoicesListPageProps) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  type StatusTab = 'all' | 'draft' | 'posted' | 'paid' | 'cancelled' | 'due'
  const [tab, setTab] = useState<StatusTab>(
    mode === 'receipts' ? 'paid' : searchParams.get('payment') === 'due' ? 'due' : 'all',
  )
  const [q, setQ] = useState('')
  const qDebounced = useDebouncedValue(q, 300)
  const limit = 30
  const isReceiptMode = mode === 'receipts'

  const query = useInfiniteQuery({
    queryKey: ['invoices', mode, tab, qDebounced, limit],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const status =
        isReceiptMode
          ? tab === 'all'
            ? undefined
            : 'paid'
          : tab === 'all' || tab === 'due'
            ? undefined
            : tab
      return await listInvoices({
        status,
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
  const countsQuery = useQuery({
    queryKey: ['invoices-counts', mode, qDebounced],
    queryFn: () =>
      listInvoices({
        search: qDebounced || undefined,
        limit: 1000,
        offset: 0,
        ...(isReceiptMode ? { status: 'paid' as const } : {}),
      }),
    staleTime: 30_000,
  })
  const statusCounts = useMemo(() => {
    const base = { all: 0, draft: 0, posted: 0, paid: 0, cancelled: 0, due: 0 } as Record<StatusTab, number>
    for (const inv of countsQuery.data ?? []) {
      if (isReceiptMode) {
        if (inv.status !== 'draft' && inv.status !== 'cancelled') base.all += 1
      } else {
        base.all += 1
      }
      base[inv.status] += 1
      const dueAmount = inv.amountDue ?? Math.max(0, (inv.total ?? 0) - (inv.amountPaid ?? 0))
      const isPaid = inv.status === 'paid' || inv.paymentState === 'paid' || dueAmount <= 0
      if (!isPaid && inv.status !== 'draft' && inv.status !== 'cancelled') base.due += 1
    }
    return base
  }, [countsQuery.data, isReceiptMode])

  // Transform API data to table rows
  const rows = useMemo(() => {
    return invoices
      .filter((inv) => (isReceiptMode ? inv.status !== 'draft' && inv.status !== 'cancelled' : true))
      .filter((inv) => {
        if (isReceiptMode || tab !== 'due') return true
        const dueAmount = inv.amountDue ?? Math.max(0, (inv.total ?? 0) - (inv.amountPaid ?? 0))
        const isPaid = inv.status === 'paid' || inv.paymentState === 'paid' || dueAmount <= 0
        return !isPaid && inv.status !== 'draft' && inv.status !== 'cancelled'
      })
      .map((inv) => ({
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
      hasReceipt: inv.hasReceipt,
    }))
  }, [invoices, isReceiptMode, tab])

  const columns: Column<(typeof rows)[number]>[] = [
    {
      key: 'number',
      header: 'เลขที่เอกสาร',
      className: 'text-nowrap',
      cell: (r) => {
        const total = r.total ?? 0
        const paymentState = r.paymentState
        const amountDue = r.amountDue ?? total
        const isPaid =
          r.status === 'paid' || paymentState === 'paid' || (amountDue <= 0 && total > 0)
        const canOpenReceipt = Boolean(r.hasReceipt)
        const actionSuffix = isReceiptMode ? (canOpenReceipt ? '?action=receipt' : isPaid ? '' : '?action=payment') : ''
        return (
          <button
            type="button"
            className="btn btn-link p-0 fw-semibold text-primary text-decoration-none font-monospace"
            onClick={() => navigate(`/sales/invoices/${r.id}${actionSuffix}`)}
          >
            {r.number || `ร่าง #${r.id}`}
          </button>
        )
      },
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
        if (r.status === 'draft' || r.status === 'cancelled') {
          return <span className="text-muted small">—</span>
        }
        
        const paymentState = r.paymentState
        const total = r.total ?? 0
        const amountDue = r.amountDue ?? 0
        const amountPaid = r.amountPaid ?? 0
        
        // Use paymentState as primary source (most reliable from Odoo)
        if (paymentState === 'paid' || r.status === 'paid') {
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
    {
      key: 'actions',
      header: 'ดำเนินการ',
      className: 'text-nowrap text-end',
      cell: (r) => {
        const total = r.total ?? 0
        const paymentState = r.paymentState
        const amountDue = r.amountDue ?? total
        const isPaid = r.status === 'paid' || paymentState === 'paid' || (amountDue <= 0 && total > 0)
        const canOpenReceipt = Boolean(r.hasReceipt)
        if (r.status === 'draft' || r.status === 'cancelled') {
          return <span className="text-muted small">—</span>
        }
        if (isPaid && canOpenReceipt) {
          return (
            <Button size="sm" variant="ghost" onClick={() => navigate(`/sales/invoices/${r.id}?action=receipt`)}>
              ดูใบเสร็จ
            </Button>
          )
        }
        return (
          <Button size="sm" onClick={() => navigate(`/sales/invoices/${r.id}?action=payment`)}>
            {isReceiptMode ? (isPaid ? 'เปิดเอกสาร' : 'สร้างใบเสร็จรับเงิน') : 'ชำระเงิน'}
          </Button>
        )
      },
    },
  ]

  return (
    <div>
      <PageHeader
        title={isReceiptMode ? 'ใบเสร็จรับเงิน' : 'ใบแจ้งหนี้'}
        subtitle={
          isReceiptMode
            ? 'ค้นหาและเปิดรายการใบเสร็จรับเงิน (เอกสารที่ชำระแล้ว)'
            : 'ค้นหา ดู และจัดการเอกสารขาย (รูปแบบ UI ใกล้ PEAK)'
        }
        breadcrumb={isReceiptMode ? 'รายรับ · ใบเสร็จรับเงิน' : 'รายรับ · ใบแจ้งหนี้'}
        actions={
          <div className="d-flex align-items-center gap-2">
            {!isReceiptMode ? (
              <Button
                size="sm"
                onClick={() => navigate('/sales/invoices/new')}
              >
                + สร้างใบแจ้งหนี้
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => navigate('/sales/invoices?payment=due')}
              >
                + เลือกใบแจ้งหนี้เพื่อสร้างใบเสร็จ
              </Button>
            )}
            <Button size="sm" variant="secondary" disabled>
              พิมพ์รายงาน
            </Button>
          </div>
        }
      />

      <div className="mb-4 d-flex flex-column gap-3 flex-sm-row align-items-sm-center justify-content-sm-between">
        <Tabs
          value={tab}
          onChange={(next) => {
            const nextValue = next as StatusTab
            if (isReceiptMode && nextValue !== 'paid' && nextValue !== 'all') return
            setTab(nextValue)
            if (!isReceiptMode) {
              const q = new URLSearchParams(searchParams)
              if (nextValue === 'due') q.set('payment', 'due')
              else q.delete('payment')
              setSearchParams(q, { replace: true })
            }
          }}
          items={
            isReceiptMode
              ? [
                  { key: 'paid', label: 'ใบเสร็จรับเงิน', count: statusCounts.paid },
                  { key: 'all', label: 'ทั้งหมด', count: statusCounts.all },
                ]
              : [
                  { key: 'all', label: 'ทั้งหมด', count: statusCounts.all },
                  { key: 'due', label: 'ค้างชำระ', count: statusCounts.due },
                  { key: 'draft', label: 'ร่าง', count: statusCounts.draft },
                  { key: 'posted', label: 'ยืนยันแล้ว', count: statusCounts.posted },
                  { key: 'paid', label: 'รับชำระแล้ว', count: statusCounts.paid },
                  { key: 'cancelled', label: 'ยกเลิก', count: statusCounts.cancelled },
                ]
          }
        />
        <div className="d-flex gap-2 w-100 justify-content-sm-end" style={{ maxWidth: '560px' }}>
          <div className="w-100" style={{ maxWidth: '360px' }}>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ค้นหาเลขที่เอกสาร / ลูกค้า"
              leftAdornment={<i className="bi bi-search"></i>}
            />
          </div>
          {(q || tab !== 'all') && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setQ('')
                setTab(isReceiptMode ? 'paid' : 'all')
                if (!isReceiptMode) {
                  const next = new URLSearchParams(searchParams)
                  next.delete('payment')
                  setSearchParams(next, { replace: true })
                }
              }}
            >
              ล้างตัวกรอง
            </Button>
          )}
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
            rowKey={(row) => row.id}
            empty={
              <div>
                <p className="h6 fw-semibold mb-2">ยังไม่มีข้อมูล</p>
                <p className="small text-muted mb-0">
                  {qDebounced
                    ? 'ไม่พบข้อมูลที่ค้นหา ลองค้นหาด้วยคำอื่น'
                    : isReceiptMode
                      ? 'ยังไม่มีใบเสร็จรับเงินในระบบ'
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

import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Tabs } from '@/components/ui/Tabs'
import { Input } from '@/components/ui/Input'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listInvoices, type InvoiceListItem } from '@/api/endpoints/invoices'
import { useNavigate } from 'react-router-dom'
import { Spinner } from 'react-bootstrap'

export function InvoicesListPage() {
  const navigate = useNavigate()
  type StatusTab = 'all' | 'draft' | 'posted' | 'paid' | 'cancelled'
  const [tab, setTab] = useState<StatusTab>('all')
  const [q, setQ] = useState('')

  // Fetch invoices from API
  const {
    data: invoices = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['invoices', tab, q],
    queryFn: () =>
      listInvoices({
        status: tab === 'all' ? undefined : tab,
        search: q || undefined,
        limit: 100,
      }),
    staleTime: 30_000, // 30 seconds
  })

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
    }))
  }, [invoices])

  const columns: Column<(typeof rows)[number]>[] = [
    {
      key: 'number',
      header: 'เลขที่เอกสาร',
      cell: (r) => (
        <button
          type="button"
          className="btn btn-link p-0 fw-semibold text-primary text-decoration-none font-monospace"
          onClick={() => navigate(`/sales/invoices/${r.id}`)}
        >
          {r.number}
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

      {isLoading ? (
        <div className="d-flex justify-content-center align-items-center py-5">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">กำลังโหลด...</span>
          </Spinner>
          <span className="ms-3">กำลังโหลดข้อมูล...</span>
        </div>
      ) : error ? (
        <div className="alert alert-danger">
          <p className="fw-semibold mb-2">เกิดข้อผิดพลาดในการโหลดข้อมูล</p>
          <p className="small mb-2">
            {error instanceof Error ? error.message : 'Unknown error'}
          </p>
          <Button size="sm" onClick={() => refetch()}>
            ลองอีกครั้ง
          </Button>
        </div>
      ) : (
        <DataTable
          title="รายการเอกสาร"
          right={
            <Button size="sm" variant="ghost" onClick={() => refetch()}>
              <i className="bi bi-arrow-clockwise me-1"></i>
              รีเฟรช
            </Button>
          }
          columns={columns}
          rows={rows}
          empty={
            <div>
              <p className="h6 fw-semibold mb-2">ยังไม่มีข้อมูล</p>
              <p className="small text-muted mb-0">
                {q
                  ? 'ไม่พบข้อมูลที่ค้นหา ลองค้นหาด้วยคำอื่น'
                  : 'ยังไม่มีใบแจ้งหนี้ในระบบ'}
              </p>
            </div>
          }
        />
      )}
    </div>
  )
}



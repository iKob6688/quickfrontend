import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Alert, Spinner } from 'react-bootstrap'
import { listPurchaseNotes, type PurchaseNoteListItem, type NoteType } from '@/api/services/purchase-notes.service'

export function PurchaseNotesListPage() {
  const navigate = useNavigate()
  const [type, setType] = useState<NoteType | 'all'>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const query = useQuery({
    queryKey: ['purchaseNotes', { type, dateFrom, dateTo }],
    queryFn: () =>
      listPurchaseNotes({
        ...(type !== 'all' ? { type } : {}),
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo ? { dateTo } : {}),
        limit: 200,
        offset: 0,
      }),
    staleTime: 10_000,
  })

  const rows = query.data?.rows ?? []

  const columns: Column<PurchaseNoteListItem>[] = useMemo(
    () => [
      {
        key: 'number',
        header: 'เลขที่',
        cell: (r) => (
          <button className="btn btn-link p-0 text-decoration-none" onClick={() => navigate(`/purchases/notes/${r.id}`)}>
            <span className="font-monospace">{r.number || `#${r.id}`}</span>
          </button>
        ),
      },
      {
        key: 'type',
        header: 'ประเภท',
        cell: (r) =>
          r.noteType === 'credit' ? <Badge tone="red">Credit</Badge> : <Badge tone="blue">Debit</Badge>,
      },
      { key: 'vendor', header: 'ผู้ขาย', cell: (r) => <span>{r.partner?.name || '—'}</span> },
      { key: 'date', header: 'วันที่เอกสาร', cell: (r) => <span className="font-monospace">{r.documentDate || '—'}</span> },
      {
        key: 'total',
        header: 'รวม',
        className: 'text-end',
        cell: (r) => (
          <span className="font-monospace fw-semibold">
            {(r.amountTotal ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
            <span className="text-muted">{r.currency || 'THB'}</span>
          </span>
        ),
      },
      {
        key: 'status',
        header: 'สถานะ',
        cell: (r) => {
          const tone = r.status === 'paid' ? 'green' : r.status === 'posted' ? 'blue' : r.status === 'draft' ? 'gray' : 'red'
          const label = r.status === 'paid' ? 'รับชำระแล้ว' : r.status === 'posted' ? 'ยืนยันแล้ว' : r.status === 'draft' ? 'ร่าง' : 'ยกเลิก'
          return <Badge tone={tone as any}>{label}</Badge>
        },
      },
    ],
    [navigate],
  )

  return (
    <div>
      <PageHeader
        title="ใบเพิ่ม/ลดหนี้ (Purchase)"
        subtitle="Vendor Debit/Credit Note"
        breadcrumb="รายจ่าย · ใบเพิ่ม/ลดหนี้"
        actions={
          <div className="d-flex align-items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => navigate('/purchases/orders')}>
              ไปใบสั่งซื้อ
            </Button>
          </div>
        }
      />

      <div className="d-flex flex-wrap gap-2 align-items-end mb-3">
        <div>
          <div className="small text-muted">ประเภท</div>
          <select className="form-select form-select-sm" value={type} onChange={(e) => setType(e.target.value as any)}>
            <option value="all">ทั้งหมด</option>
            <option value="credit">Credit Note</option>
            <option value="debit">Debit Note</option>
          </select>
        </div>
        <div>
          <div className="small text-muted">จากวันที่</div>
          <input className="form-control form-control-sm" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div>
          <div className="small text-muted">ถึงวันที่</div>
          <input className="form-control form-control-sm" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <div className="ms-auto">
          <Button size="sm" variant="secondary" onClick={() => query.refetch()} disabled={query.isFetching}>
            รีเฟรช
          </Button>
        </div>
      </div>

      {query.isLoading ? (
        <div className="d-flex justify-content-center align-items-center py-5">
          <Spinner animation="border" role="status" />
          <span className="ms-3">กำลังโหลด...</span>
        </div>
      ) : query.error ? (
        <Alert variant="danger" className="small">
          {query.error instanceof Error ? query.error.message : 'เกิดข้อผิดพลาด'}
        </Alert>
      ) : (
        <DataTable title="รายการใบเพิ่ม/ลดหนี้ซื้อ" columns={columns} rows={rows} />
      )}
    </div>
  )
}


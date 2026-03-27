import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Alert, Spinner } from 'react-bootstrap'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { listSalesNotes, type NoteType, type SalesNoteListItem } from '@/api/services/sales-notes.service'
import { listPurchaseNotes, type PurchaseNoteListItem } from '@/api/services/purchase-notes.service'
import { toast } from '@/lib/toastStore'

type NoteDomain = 'sales' | 'purchase'
type UnifiedNoteRow = {
  id: number
  number: string
  noteType: NoteType
  status: 'draft' | 'posted' | 'paid' | 'cancelled'
  partnerName: string
  documentDate: string
  amountTotal: number
  currency: string
  domain: NoteDomain
}

function mapSalesRow(row: SalesNoteListItem): UnifiedNoteRow {
  return {
    id: row.id,
    number: row.number,
    noteType: row.noteType,
    status: row.status,
    partnerName: row.partner?.name || '—',
    documentDate: row.documentDate || '—',
    amountTotal: row.amountTotal ?? 0,
    currency: row.currency || 'THB',
    domain: 'sales',
  }
}

function mapPurchaseRow(row: PurchaseNoteListItem): UnifiedNoteRow {
  return {
    id: row.id,
    number: row.number,
    noteType: row.noteType,
    status: row.status,
    partnerName: row.partner?.name || '—',
    documentDate: row.documentDate || '—',
    amountTotal: row.amountTotal ?? 0,
    currency: row.currency || 'THB',
    domain: 'purchase',
  }
}

function resolveActionableError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาด'
  if (/404|ไม่พบ route|ไม่พบ endpoint|not found/i.test(message)) {
    return 'ยังไม่พบ route ใบเพิ่ม/ลดหนี้จาก backend ตรวจสอบว่า upgrade module API แล้ว และ proxy ชี้ถูก จากนั้นกดรีเฟรชอีกครั้ง'
  }
  if (/403|unauthorized|forbidden|scope/i.test(message)) {
    return 'สิทธิ์ยังไม่พอสำหรับหน้าใบเพิ่ม/ลดหนี้ กรุณาให้ผู้ดูแลเปิดสิทธิ์ที่เกี่ยวข้อง แล้วลองใหม่'
  }
  return message
}

export function NotesListPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialDomain = (searchParams.get('domain') || '').toLowerCase() === 'purchase' ? 'purchase' : 'sales'
  const [domain, setDomain] = useState<NoteDomain>(initialDomain)
  const [type, setType] = useState<NoteType | 'all'>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const query = useQuery({
    queryKey: ['notes', domain, type, dateFrom, dateTo],
    queryFn: async () => {
      if (domain === 'sales') {
        const result = await listSalesNotes({
          ...(type !== 'all' ? { type } : {}),
          ...(dateFrom ? { dateFrom } : {}),
          ...(dateTo ? { dateTo } : {}),
          limit: 200,
          offset: 0,
        })
        return (result.rows || []).map(mapSalesRow)
      }
      const result = await listPurchaseNotes({
        ...(type !== 'all' ? { type } : {}),
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo ? { dateTo } : {}),
        limit: 200,
        offset: 0,
      })
      return (result.rows || []).map(mapPurchaseRow)
    },
    staleTime: 10_000,
  })

  const columns: Column<UnifiedNoteRow>[] = useMemo(
    () => [
      {
        key: 'number',
        header: 'เลขที่',
        cell: (row) => (
          <button
            className="btn btn-link p-0 text-decoration-none"
            onClick={() => navigate(row.domain === 'sales' ? `/sales/notes/${row.id}` : `/purchases/notes/${row.id}`)}
          >
            <span className="font-monospace">{row.number || `#${row.id}`}</span>
          </button>
        ),
      },
      {
        key: 'type',
        header: 'ประเภท',
        cell: (row) => (row.noteType === 'credit' ? <Badge tone="red">Credit</Badge> : <Badge tone="blue">Debit</Badge>),
      },
      {
        key: 'partner',
        header: domain === 'sales' ? 'ลูกค้า' : 'ผู้ขาย',
        cell: (row) => <span>{row.partnerName}</span>,
      },
      {
        key: 'date',
        header: 'วันที่เอกสาร',
        cell: (row) => <span className="font-monospace">{row.documentDate || '—'}</span>,
      },
      {
        key: 'total',
        header: 'รวม',
        className: 'text-end',
        cell: (row) => (
          <span className="font-monospace fw-semibold">
            {(row.amountTotal ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
            <span className="text-muted">{row.currency || 'THB'}</span>
          </span>
        ),
      },
      {
        key: 'status',
        header: 'สถานะ',
        cell: (row) => {
          const tone = row.status === 'paid' ? 'green' : row.status === 'posted' ? 'blue' : row.status === 'draft' ? 'gray' : 'red'
          const label = row.status === 'paid' ? 'รับชำระแล้ว' : row.status === 'posted' ? 'ยืนยันแล้ว' : row.status === 'draft' ? 'ร่าง' : 'ยกเลิก'
          return <Badge tone={tone as any}>{label}</Badge>
        },
      },
    ],
    [navigate, domain],
  )

  const updateDomain = (next: NoteDomain) => {
    setDomain(next)
    setSearchParams((prev) => {
      const updated = new URLSearchParams(prev)
      updated.set('domain', next)
      return updated
    })
  }

  const openCreateFlow = (kind: NoteType) => {
    if (domain === 'sales') {
      toast.info(kind === 'credit' ? 'สร้างใบลดหนี้' : 'สร้างใบเพิ่มหนี้', 'เลือกใบแจ้งหนี้ แล้วกดปุ่มสร้างจากหน้า detail')
      navigate('/sales/invoices')
      return
    }
    toast.info(kind === 'credit' ? 'สร้างใบลดหนี้ซื้อ' : 'สร้างใบเพิ่มหนี้ซื้อ', 'เลือก Vendor Bill แล้วกดปุ่มสร้างจากหน้า detail')
    navigate('/purchases/orders')
  }

  return (
    <div>
      <PageHeader
        title="ใบเพิ่ม/ลดหนี้"
        subtitle="รวม Sales และ Purchase ในเมนูเดียว"
        breadcrumb="รายงาน · ใบเพิ่ม/ลดหนี้"
      />

      <div className="d-flex flex-wrap gap-2 align-items-end mb-3">
        <div>
          <div className="small text-muted">หมวดเอกสาร</div>
          <select className="form-select form-select-sm" value={domain} onChange={(e) => updateDomain(e.target.value as NoteDomain)}>
            <option value="sales">Sales</option>
            <option value="purchase">Purchase</option>
          </select>
        </div>
        <div>
          <div className="small text-muted">ประเภท</div>
          <select className="form-select form-select-sm" value={type} onChange={(e) => setType(e.target.value as NoteType | 'all')}>
            <option value="all">ทั้งหมด</option>
            <option value="credit">Credit</option>
            <option value="debit">Debit</option>
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
        <div className="ms-auto d-flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => openCreateFlow('debit')}>
            + สร้างใบเพิ่มหนี้
          </Button>
          <Button size="sm" variant="secondary" onClick={() => openCreateFlow('credit')}>
            + สร้างใบลดหนี้
          </Button>
          <Button size="sm" variant="ghost" onClick={() => query.refetch()} disabled={query.isFetching}>
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
          <div className="fw-semibold mb-1">เข้าเมนูใบเพิ่ม/ลดหนี้ไม่ได้</div>
          <div>{resolveActionableError(query.error)}</div>
          <div className="mt-2 d-flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => query.refetch()}>
              ลองโหลดใหม่
            </Button>
          </div>
        </Alert>
      ) : (
        <DataTable
          title={domain === 'sales' ? 'รายการใบเพิ่ม/ลดหนี้ขาย' : 'รายการใบเพิ่ม/ลดหนี้ซื้อ'}
          columns={columns}
          rows={query.data || []}
        />
      )}
    </div>
  )
}


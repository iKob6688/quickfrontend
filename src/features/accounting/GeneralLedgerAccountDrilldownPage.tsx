import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { getGeneralLedgerAccountDrilldown, type GeneralLedgerAccountMoveLine, type TargetMove } from '@/api/services/accounting-reports.service'

function parseNumber(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (typeof v === 'string') {
    const n = Number(v.replace(/,/g, ''))
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

export function GeneralLedgerAccountDrilldownPage() {
  const navigate = useNavigate()
  const { accountId } = useParams()
  const [sp] = useSearchParams()

  const id = Number(accountId)
  const dateFrom = sp.get('dateFrom') || undefined
  const dateTo = sp.get('dateTo') || undefined
  const targetMove = (sp.get('targetMove') as TargetMove) || 'posted'

  const query = useQuery({
    queryKey: ['accounting', 'gl', 'account', id, dateFrom, dateTo, targetMove],
    enabled: Number.isFinite(id) && id > 0,
    queryFn: () => getGeneralLedgerAccountDrilldown(id, { dateFrom, dateTo, targetMove }),
    staleTime: 60_000,
    retry: 1,
  })

  const rows = query.data?.moveLines ?? []
  const totals = query.data?.totals

  const columns: Column<GeneralLedgerAccountMoveLine>[] = [
    {
      key: 'date',
      header: 'วันที่',
      cell: (r) => <span className="font-monospace">{r.date ?? '—'}</span>,
    },
    {
      key: 'move',
      header: 'เอกสาร',
      cell: (r) => (
        <div className="d-flex flex-column">
          <div className="fw-semibold">{r.moveName ?? r.moveId?.name ?? '—'}</div>
          <div className="text-muted small">{r.ref ?? ''}</div>
        </div>
      ),
    },
    {
      key: 'partner',
      header: 'คู่ค้า',
      cell: (r) => <span>{r.partnerId?.name ?? '—'}</span>,
    },
    {
      key: 'debit',
      header: 'เดบิต',
      className: 'text-end',
      cell: (r) => <span className="font-monospace">{parseNumber(r.debit).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>,
    },
    {
      key: 'credit',
      header: 'เครดิต',
      className: 'text-end',
      cell: (r) => <span className="font-monospace">{parseNumber(r.credit).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>,
    },
    {
      key: 'actions',
      header: '',
      className: 'text-end',
      cell: (r) => {
        const moveLineId = r.id
        const canViewDetail = Number.isFinite(moveLineId) && moveLineId > 0
        
        if (import.meta.env.DEV) {
          console.debug('[GeneralLedgerAccountDrilldownPage] Detail button:', {
            moveLineId,
            canViewDetail,
            moveLineName: r.moveName,
          })
        }
        
        return (
          <Button
            size="sm"
            variant="secondary"
            disabled={!canViewDetail}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              
              if (!canViewDetail) {
                if (import.meta.env.DEV) {
                  console.warn('[GeneralLedgerAccountDrilldownPage] Cannot view detail, moveLineId:', moveLineId)
                }
                return
              }
              
              const path = `/accounting/reports/move-lines/${moveLineId}`
              if (import.meta.env.DEV) {
                console.debug('[GeneralLedgerAccountDrilldownPage] Navigating to:', path)
              }
              navigate(path)
            }}
          >
            รายละเอียด
          </Button>
        )
      },
    },
  ]

  const title = useMemo(() => {
    const a = query.data?.account
    if (!a) return 'General Ledger'
    return `General Ledger: ${a.displayName || `${a.code ?? ''} ${a.name ?? ''}`.trim()}`
  }, [query.data?.account])

  return (
    <div>
      <PageHeader
        title={title}
        subtitle="รายละเอียดจาก Profit & Loss / Balance Sheet"
        breadcrumb="Home · Accounting · Reports"
        actions={
          <div className="d-flex gap-2 flex-wrap">
            <Button size="sm" variant="secondary" onClick={() => navigate(-1)}>
              ย้อนกลับ
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void query.refetch()}>
              <i className="bi bi-arrow-clockwise me-1" aria-hidden="true" />
              รีเฟรช
            </Button>
          </div>
        }
      />

      <Card className="p-3 mb-3">
        <div className="row g-2">
          <div className="col-md-3">
            <div className="small text-muted">ช่วงวันที่</div>
            <div className="font-monospace">{dateFrom ?? '—'} → {dateTo ?? '—'}</div>
          </div>
          <div className="col-md-3">
            <div className="small text-muted">Target move</div>
            <div className="font-monospace">{targetMove}</div>
          </div>
          <div className="col-md-6">
            <div className="small text-muted">รวม</div>
            <div className="d-flex flex-wrap gap-3">
              <div>Debit: <span className="font-monospace fw-semibold">{(totals?.totalDebit ?? 0).toLocaleString('th-TH')}</span></div>
              <div>Credit: <span className="font-monospace fw-semibold">{(totals?.totalCredit ?? 0).toLocaleString('th-TH')}</span></div>
              <div>Balance: <span className="font-monospace fw-semibold">{(totals?.balance ?? 0).toLocaleString('th-TH')}</span></div>
              <div className="text-muted">({totals?.recordCount ?? rows.length} รายการ)</div>
            </div>
          </div>
        </div>
      </Card>

      {query.isError ? (
        <div className="alert alert-danger">
          โหลด General Ledger ไม่สำเร็จ: {query.error instanceof Error ? query.error.message : 'Unknown error'}
        </div>
      ) : (
        <DataTable
          title="รายการเดินบัญชี"
          columns={columns}
          rows={rows}
          empty={query.isLoading ? 'กำลังโหลด...' : 'ไม่มีข้อมูล'}
        />
      )}
    </div>
  )
}



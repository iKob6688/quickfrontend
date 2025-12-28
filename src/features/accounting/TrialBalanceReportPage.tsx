import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { getTrialBalance, type TargetMove } from '@/api/services/accounting-reports.service'
import { toISODate, firstDayOfThisMonth, lastDayOfThisMonth, firstDayOfLastMonth, lastDayOfLastMonth, firstDayOfThisYear, lastDayOfThisYear } from '@/lib/datePresets'

type Item = Record<string, unknown>

function asString(v: unknown) {
  if (v == null) return ''
  return String(v)
}
function asNumber(v: unknown) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (typeof v === 'string') {
    const n = Number(v.replace(/,/g, ''))
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

export function TrialBalanceReportPage() {
  const navigate = useNavigate()
  const [dateFrom, setDateFrom] = useState(() => toISODate(firstDayOfThisMonth()))
  const [dateTo, setDateTo] = useState(() => toISODate(lastDayOfThisMonth()))
  const [targetMove, setTargetMove] = useState<TargetMove>('posted')

  const applyPreset = (preset: 'thisMonth' | 'prevMonth' | 'thisYear') => {
    if (preset === 'thisMonth') {
      setDateFrom(toISODate(firstDayOfThisMonth()))
      setDateTo(toISODate(lastDayOfThisMonth()))
    } else if (preset === 'prevMonth') {
      setDateFrom(toISODate(firstDayOfLastMonth()))
      setDateTo(toISODate(lastDayOfLastMonth()))
    } else {
      setDateFrom(toISODate(firstDayOfThisYear()))
      setDateTo(toISODate(lastDayOfThisYear()))
    }
  }

  // Hotkeys: Alt+1 เดือนนี้, Alt+2 เดือนก่อน, Alt+3 ปีนี้
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.altKey || e.shiftKey || e.ctrlKey || e.metaKey) return
      if (e.key === '1') {
        e.preventDefault()
        applyPreset('thisMonth')
      } else if (e.key === '2') {
        e.preventDefault()
        applyPreset('prevMonth')
      } else if (e.key === '3') {
        e.preventDefault()
        applyPreset('thisYear')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const q = useQuery({
    queryKey: ['accounting', 'trialBalance', dateFrom, dateTo, targetMove],
    queryFn: () => getTrialBalance({ dateFrom, dateTo, targetMove, comparison: 0 }),
    staleTime: 60_000,
    retry: 1,
  })

  const reportData = (q.data?.reportData ?? {}) as any
  const items: Item[] = Array.isArray(reportData?.items) ? reportData.items : []

  const columns: Column<Item>[] = [
    { key: 'name', header: 'บัญชี', cell: (r) => <span className="fw-semibold">{asString(r.name || r.accountName || r.code || '')}</span> },
    { key: 'debit', header: 'เดบิต', className: 'text-end', cell: (r) => <span className="font-monospace">{asNumber(r.debit).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> },
    { key: 'credit', header: 'เครดิต', className: 'text-end', cell: (r) => <span className="font-monospace">{asNumber(r.credit).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> },
    { key: 'balance', header: 'คงเหลือ', className: 'text-end', cell: (r) => <span className="font-monospace">{asNumber(r.balance).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> },
  ]

  return (
    <div>
      <PageHeader
        title="งบทดลอง (Trial Balance)"
        subtitle="สรุปยอดเดบิต/เครดิตและคงเหลือตามบัญชี"
        breadcrumb="Home · Accounting · Reports"
        actions={
          <div className="d-flex gap-2 flex-wrap">
            <Button size="sm" variant="secondary" onClick={() => navigate('/accounting/reports')}>
              กลับไปรายงานบัญชี
            </Button>
          </div>
        }
      />

      <Card className="p-3 mb-3">
        <div className="row g-2 align-items-end">
          <div className="col-md-4">
            <label className="form-label">ตั้งแต่</label>
            <input className="form-control" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="col-md-4">
            <label className="form-label">ถึง</label>
            <input className="form-control" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div className="col-md-4">
            <label className="form-label">Target move</label>
            <select className="form-select" value={targetMove} onChange={(e) => setTargetMove(e.target.value as TargetMove)}>
              <option value="posted">posted</option>
              <option value="draft">draft</option>
            </select>
          </div>
        </div>
        <div className="d-flex gap-2 flex-wrap mt-3">
          <Button size="sm" variant="ghost" onClick={() => applyPreset('thisMonth')}>
            เดือนนี้ (Alt+1)
          </Button>
          <Button size="sm" variant="ghost" onClick={() => applyPreset('prevMonth')}>
            เดือนก่อน (Alt+2)
          </Button>
          <Button size="sm" variant="ghost" onClick={() => applyPreset('thisYear')}>
            ปีนี้ (Alt+3)
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void q.refetch()}>
            <i className="bi bi-arrow-clockwise me-1" aria-hidden="true" />
            รีเฟรช
          </Button>
        </div>
      </Card>

      {q.isError ? (
        <div className="alert alert-danger">
          โหลดรายงานไม่สำเร็จ: {q.error instanceof Error ? q.error.message : 'Unknown error'}
        </div>
      ) : (
        <>
          {items.length > 0 ? (
            <DataTable title="รายการ" columns={columns} rows={items} empty={q.isLoading ? 'กำลังโหลด...' : 'ไม่มีข้อมูล'} />
          ) : (
            <Card className="p-3">
              <div className="fw-semibold mb-2">Raw reportData</div>
              <pre className="small mb-0" style={{ whiteSpace: 'pre-wrap' }}>
                {q.isLoading ? 'กำลังโหลด...' : JSON.stringify(q.data?.reportData ?? {}, null, 2)}
              </pre>
            </Card>
          )}
        </>
      )}
    </div>
  )
}



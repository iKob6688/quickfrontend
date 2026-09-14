import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useMemo, useState } from 'react'

import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { getBankBook, getCashBook } from '@/api/services/accounting-reports.service'
import { ReportDataTable } from '@/features/accounting/ReportDataTable'
import {
  firstDayOfLastMonth,
  firstDayOfThisMonth,
  firstDayOfThisYear,
  lastDayOfLastMonth,
  lastDayOfThisMonth,
  lastDayOfThisYear,
  toISODate,
} from '@/lib/datePresets'

type Mode = 'cash' | 'bank'
type TargetMove = 'posted' | 'draft'

function parseAccountIds(value: string) {
  return value
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((id) => Number.isInteger(id) && id > 0)
}

export function BookReportPage(props: { mode: Mode }) {
  const navigate = useNavigate()
  const { mode } = props
  const [dateFrom, setDateFrom] = useState(() => toISODate(firstDayOfThisMonth()))
  const [dateTo, setDateTo] = useState(() => toISODate(lastDayOfThisMonth()))
  const [targetMove, setTargetMove] = useState<TargetMove>('posted')
  const [accountIdsText, setAccountIdsText] = useState('')
  const accountIds = useMemo(() => parseAccountIds(accountIdsText), [accountIdsText])
  const params = useMemo(
    () => ({
      date_from: dateFrom,
      date_to: dateTo,
      target_move: targetMove,
      ...(accountIds.length ? { account_ids: accountIds } : {}),
    }),
    [accountIds, dateFrom, dateTo, targetMove],
  )

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

  const q = useQuery({
    queryKey: ['accounting', 'book', mode, params],
    queryFn: () => (mode === 'cash' ? getCashBook(params) : getBankBook(params)),
    staleTime: 60_000,
    retry: 1,
  })

  const title = mode === 'cash' ? 'สมุดเงินสด (Cash Book)' : 'สมุดเงินฝากธนาคาร (Bank Book)'

  return (
    <div>
      <PageHeader
        title={title}
        subtitle="สรุปรายการสมุดรายวันจากข้อมูลจริงในระบบ"
        breadcrumb="Home · Accounting · Reports"
        actions={
          <div className="d-flex gap-2 flex-wrap">
            <Button size="sm" variant="secondary" onClick={() => navigate('/accounting/reports')}>
              กลับไปรายงานบัญชี
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void q.refetch()}>
              <i className="bi bi-arrow-clockwise me-1" aria-hidden="true" />
              รีเฟรช
            </Button>
          </div>
        }
      />

      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body">
          <div className="row g-3 align-items-end">
            <div className="col-md-3">
              <label className="form-label" htmlFor="book-date-from">
                Date from
              </label>
              <input
                id="book-date-from"
                className="form-control"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label" htmlFor="book-date-to">
                Date to
              </label>
              <input id="book-date-to" className="form-control" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div className="col-md-3">
              <label className="form-label" htmlFor="book-target-move">
                Entry state
              </label>
              <select
                id="book-target-move"
                className="form-select"
                value={targetMove}
                onChange={(e) => setTargetMove(e.target.value as TargetMove)}
              >
                <option value="posted">Posted only</option>
                <option value="draft">Posted + draft</option>
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label" htmlFor="book-account-ids">
                Account IDs
              </label>
              <input
                id="book-account-ids"
                className="form-control"
                type="text"
                inputMode="numeric"
                placeholder="เช่น 101, 102"
                value={accountIdsText}
                onChange={(e) => setAccountIdsText(e.target.value)}
              />
            </div>
          </div>
          <div className="d-flex gap-2 flex-wrap mt-3">
            <Button size="sm" variant="ghost" onClick={() => applyPreset('thisMonth')}>
              เดือนนี้
            </Button>
            <Button size="sm" variant="ghost" onClick={() => applyPreset('prevMonth')}>
              เดือนก่อน
            </Button>
            <Button size="sm" variant="ghost" onClick={() => applyPreset('thisYear')}>
              ปีนี้
            </Button>
          </div>
          <div className="text-muted small mt-2">
            ใช้ตัวกรองตาม backend canonical: <code>date_from</code>, <code>date_to</code>, <code>target_move</code>, และ{' '}
            <code>account_ids</code>. ไม่มีตัวกรองสมุดรายวันในหน้านี้
          </div>
        </div>
      </div>

      {q.isError ? (
        <div className="alert alert-danger">
          โหลดรายงานไม่สำเร็จ: {q.error instanceof Error ? q.error.message : 'Unknown error'}
        </div>
      ) : (
        <ReportDataTable title="รายการสมุดรายวัน" reportData={q.data?.reportData} loading={q.isLoading} />
      )}
    </div>
  )
}

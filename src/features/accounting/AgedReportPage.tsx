import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { getAgedPayables, getAgedReceivables } from '@/api/services/accounting-reports.service'
import { toISODate, lastDayOfThisMonth, lastDayOfLastMonth, lastDayOfThisYear } from '@/lib/datePresets'

type Mode = 'receivables' | 'payables'

type Entry = Record<string, unknown> & {
  partnerId?: number
  partnerName?: string
  drilldownUrl?: string
}

function asNumber(v: unknown) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (typeof v === 'string') {
    const n = Number(v.replace(/,/g, ''))
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

export function AgedReportPage(props: { mode: Mode }) {
  const navigate = useNavigate()
  const { mode } = props
  const [asOfDate, setAsOfDate] = useState(() => toISODate(lastDayOfThisMonth()))

  const applyPreset = (preset: 'thisMonth' | 'prevMonth' | 'thisYear') => {
    if (preset === 'thisMonth') {
      setAsOfDate(toISODate(lastDayOfThisMonth()))
    } else if (preset === 'prevMonth') {
      setAsOfDate(toISODate(lastDayOfLastMonth()))
    } else {
      setAsOfDate(toISODate(lastDayOfThisYear()))
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
    queryKey: ['accounting', 'aged', mode, asOfDate],
    queryFn: () => (mode === 'receivables' ? getAgedReceivables({ date: asOfDate }) : getAgedPayables({ date: asOfDate })),
    staleTime: 60_000,
    retry: 1,
  })

  const reportData = (q.data?.reportData ?? {}) as Record<string, unknown>

  const rows = useMemo(() => {
    // backend returns dict keyed by partner name + partnerTotals
    const out: Array<{ partner: string; partnerId?: number; buckets: Entry[] }> = []
    for (const [k, v] of Object.entries(reportData)) {
      if (k === 'partnerTotals') continue
      if (!Array.isArray(v)) continue
      const entries = v.filter((x): x is Entry => !!x && typeof x === 'object') as Entry[]
      const partnerId = entries.find((e) => typeof e.partnerId === 'number')?.partnerId
      out.push({ partner: k, partnerId, buckets: entries })
    }
    return out
  }, [reportData])

  const columns: Column<{ partner: string; partnerId?: number; buckets: Entry[] }>[] = [
    {
      key: 'partner',
      header: 'คู่ค้า',
      cell: (r) => (
        <div className="d-flex flex-column">
          <div className="fw-semibold">{r.partner}</div>
          {r.partnerId ? <div className="text-muted small">ID: {r.partnerId}</div> : null}
        </div>
      ),
    },
    {
      key: 'summary',
      header: 'สรุป',
      cell: (r) => {
        // show first bucket totals if present; else show count
        const first = r.buckets[0] ?? {}
        const total = asNumber((first as any).total || (first as any).amount || 0)
        return (
          <span className="font-monospace">
            {total ? total.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : `${r.buckets.length} รายการ`}
          </span>
        )
      },
    },
    {
      key: 'actions',
      header: '',
      className: 'text-end',
      cell: (r) =>
        r.partnerId ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              const sp = new URLSearchParams({ targetMove: 'posted' })
              navigate(`/accounting/reports/partner-ledger/partner/${r.partnerId}?${sp.toString()}`)
            }}
          >
            Drilldown
          </Button>
        ) : (
          <span className="text-muted small">—</span>
        ),
    },
  ]

  const title = mode === 'receivables' ? 'อายุลูกหนี้ (Aged Receivables)' : 'อายุเจ้าหนี้ (Aged Payables)'

  return (
    <div>
      <PageHeader
        title={title}
        subtitle="ดูรายการคงค้างตามอายุ พร้อม drilldown ไป Partner Ledger"
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

      <Card className="p-3 mb-3">
        <div className="row g-2 align-items-end">
          <div className="col-md-4">
            <label className="form-label">As of date</label>
            <input className="form-control" type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} />
          </div>
          <div className="col-md-8">
            <div className="text-muted small">
              หมายเหตุ: Backend แปะ <code>partnerId</code> ลงใน entries เพื่อ drilldown ได้ (ต้อง restart/upgrade module ให้โหลด route ใหม่)
            </div>
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
        <DataTable title="คู่ค้า" columns={columns} rows={rows} empty={q.isLoading ? 'กำลังโหลด...' : 'ไม่มีข้อมูล'} />
      )}
    </div>
  )
}



import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { getBalanceSheet, getAccountByCode, type ReportBaseParams, type TargetMove } from '@/api/services/accounting-reports.service'
import { toast } from '@/lib/toastStore'
import { toISODate, firstDayOfThisMonth, lastDayOfThisMonth, firstDayOfLastMonth, lastDayOfLastMonth, firstDayOfThisYear, lastDayOfThisYear } from '@/lib/datePresets'

function parseNumber(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (typeof v === 'string') {
    const n = Number(v.replace(/,/g, ''))
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

function extractAccountCodeFromName(name: unknown): string | null {
  if (typeof name !== 'string') return null
  if (!name.includes(' - ')) return null
  const code = name.split(' - ', 1)[0].trim()
  return code || null
}

function isUsableAccountCode(code: unknown): code is string {
  if (typeof code !== 'string') return false
  const c = code.trim()
  if (!c) return false
  if (c.toLowerCase() === 'false') return false
  return /^[0-9]+$/.test(c)
}

type Entry = {
  name: string
  amount: string | number
  accountId?: number
  accountCode?: string
  accountName?: string
  drilldownUrl?: string
}

function extractEntries(section: unknown): Entry[] {
  if (!section || typeof section !== 'object') return []
  const anyS = section as { entries?: unknown }
  if (!Array.isArray(anyS.entries)) return []
  return anyS.entries.filter((e): e is Entry => !!e && typeof e === 'object' && 'name' in (e as any))
}

export function BalanceSheetReportPage() {
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

  const params: ReportBaseParams = { dateFrom, dateTo, targetMove, comparison: 0 }

  const q = useQuery({
    queryKey: ['accounting', 'balanceSheet', dateFrom, dateTo, targetMove],
    queryFn: () => getBalanceSheet(params),
    staleTime: 60_000,
    retry: 1,
  })

  const reportData = (q.data?.reportData ?? {}) as Record<string, unknown>

  // Minimal Phase 2: show key sections if present (backend returns many keys)
  const sections = useMemo(() => {
    const pick = [
      { key: 'assetCash', label: 'เงินสดและธนาคาร' },
      { key: 'assetReceivable', label: 'ลูกหนี้การค้า' },
      { key: 'assetCurrent', label: 'สินทรัพย์หมุนเวียนอื่น' },
      { key: 'assetFixed', label: 'สินทรัพย์ถาวร' },
      { key: 'assetNonCurrent', label: 'สินทรัพย์ไม่หมุนเวียน' },
      { key: 'liabilityPayable', label: 'เจ้าหนี้การค้า' },
      { key: 'liabilityCurrent', label: 'หนี้สินหมุนเวียนอื่น' },
      { key: 'liabilityNonCurrent', label: 'หนี้สินไม่หมุนเวียน' },
      { key: 'equity', label: 'ส่วนของผู้ถือหุ้น' },
      { key: 'equityUnaffected', label: 'กำไร(ขาดทุน)สะสม/ยังไม่จัดสรร' },
    ]
    return pick
      .map((p) => ({ ...p, value: reportData[p.key] }))
      .filter((x) => x.value != null)
  }, [reportData])

  const columns: Column<Entry>[] = [
    {
      key: 'name',
      header: 'บัญชี',
      cell: (r) => (
        <div className="d-flex flex-column">
          <div className="fw-semibold">{r.name}</div>
          {r.accountCode ? <div className="text-muted small">Code: {r.accountCode}</div> : null}
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'จำนวนเงิน',
      className: 'text-end',
      cell: (r) => <span className="font-monospace">{parseNumber(r.amount).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>,
    },
    {
      key: 'actions',
      header: '',
      className: 'text-end',
      cell: (r) => {
        const params = new URLSearchParams({ dateFrom, dateTo, targetMove })
        const fallbackCode = r.accountCode || extractAccountCodeFromName(r.name)
        const canDrill = Boolean(r.accountId) || isUsableAccountCode(fallbackCode)
        
        if (import.meta.env.DEV) {
          console.debug('[BalanceSheetReportPage] รายละเอียดbutton:', {
            accountId: r.accountId,
            fallbackCode,
            canDrill,
            entryName: r.name,
          })
        }
        
        return (
          <Button
            size="sm"
            variant="secondary"
            disabled={!canDrill}
            onClick={async (e) => {
              e.preventDefault()
              e.stopPropagation()
              
              if (import.meta.env.DEV) {
                console.debug('[BalanceSheetReportPage] รายละเอียดclicked:', { accountId: r.accountId, fallbackCode })
              }
              
              try {
                if (r.accountId) {
                  const path = `/accounting/reports/general-ledger/account/${r.accountId}?${params.toString()}`
                  if (import.meta.env.DEV) {
                    console.debug('[BalanceSheetReportPage] Navigating to:', path)
                  }
                  navigate(path)
                  return
                }
                if (!isUsableAccountCode(fallbackCode)) {
                  toast.info('ไม่สามารถ รายละเอียดได้', 'รายการนี้ไม่มี accountId/accountCode')
                  return
                }
                const acc = await getAccountByCode(fallbackCode)
                const path = `/accounting/reports/general-ledger/account/${acc.id}?${params.toString()}`
                if (import.meta.env.DEV) {
                  console.debug('[BalanceSheetReportPage] Resolved account, navigating to:', path)
                }
                navigate(path)
              } catch (e) {
                console.error('[BalanceSheetReportPage] รายละเอียดerror:', e)
                toast.error('รายละเอียดไม่สำเร็จ', e instanceof Error ? e.message : 'Unknown error')
              }
            }}
          >
            Drilldown
          </Button>
        )
      },
    },
  ]

  return (
    <div>
      <PageHeader
        title="งบดุล (Balance Sheet)"
        subtitle="คลิก รายละเอียดเพื่อดู General Ledger รายบัญชี"
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
        <div className="d-flex flex-column gap-3">
          {sections.map((s) => {
            const rows = extractEntries(s.value)
            return (
              <DataTable
                key={s.key}
                title={s.label}
                columns={columns}
                rows={rows}
                empty={q.isLoading ? 'กำลังโหลด...' : 'ไม่มีข้อมูล'}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}



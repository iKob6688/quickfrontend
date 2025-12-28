import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { DataTable, type Column } from '@/components/ui/DataTable'
import {
  getProfitLoss,
  getAccountByCode,
  type ProfitLossEntry,
  type TargetMove,
} from '@/api/services/accounting-reports.service'
import { toast } from '@/lib/toastStore'

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10)
}

function firstDayOfThisMonth() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function dateRangeThisMonth() {
  const d = new Date()
  const from = new Date(d.getFullYear(), d.getMonth(), 1)
  const to = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return { from: toISODate(from), to: toISODate(to) }
}

function dateRangePrevMonth() {
  const d = new Date()
  const from = new Date(d.getFullYear(), d.getMonth() - 1, 1)
  const to = new Date(d.getFullYear(), d.getMonth(), 0)
  return { from: toISODate(from), to: toISODate(to) }
}

function dateRangeThisYear() {
  const d = new Date()
  const from = new Date(d.getFullYear(), 0, 1)
  const to = new Date(d.getFullYear(), 11, 31)
  return { from: toISODate(from), to: toISODate(to) }
}

function parseNumber(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (typeof v === 'string') {
    const n = Number(v.replace(/,/g, ''))
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

function safeEntries(v: unknown): ProfitLossEntry[] {
  if (!v || typeof v !== 'object') return []
  const anyV = v as { entries?: unknown }
  const entries = anyV.entries
  if (!Array.isArray(entries)) return []
  return entries.filter((e): e is ProfitLossEntry => !!e && typeof e === 'object' && 'name' in (e as any) && 'amount' in (e as any))
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
  // Accept typical Thai chart-of-accounts codes (numeric). If your codes are alphanumeric,
  // we can relax this later.
  return /^[0-9]+$/.test(c)
}

type Tab = 'income' | 'expense'

export function ProfitLossReportPage() {
  const navigate = useNavigate()
  const [sp, setSp] = useSearchParams()

  const tab = (sp.get('tab') as Tab) || 'income'
  const [dateFrom, setDateFrom] = useState(() => sp.get('dateFrom') || toISODate(firstDayOfThisMonth()))
  const [dateTo, setDateTo] = useState(() => sp.get('dateTo') || toISODate(new Date()))
  const [targetMove, setTargetMove] = useState<TargetMove>(() => (sp.get('targetMove') as TargetMove) || 'posted')

  const syncUrl = (next: { dateFrom?: string; dateTo?: string; targetMove?: TargetMove; tab?: Tab }) => {
    const n = new URLSearchParams(sp)
    if (next.tab) n.set('tab', next.tab)
    if (next.dateFrom) n.set('dateFrom', next.dateFrom)
    if (next.dateTo) n.set('dateTo', next.dateTo)
    if (next.targetMove) n.set('targetMove', next.targetMove)
    setSp(n, { replace: true })
  }

  const applyPreset = (preset: 'thisMonth' | 'prevMonth' | 'thisYear') => {
    const r =
      preset === 'thisMonth'
        ? dateRangeThisMonth()
        : preset === 'prevMonth'
          ? dateRangePrevMonth()
          : dateRangeThisYear()
    setDateFrom(r.from)
    setDateTo(r.to)
    syncUrl({ dateFrom: r.from, dateTo: r.to, targetMove, tab })
  }

  // Hotkeys: Alt+1 เดือนนี้, Alt+2 เดือนก่อน, Alt+3 ปีนี้
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.altKey) return
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, targetMove, sp])

  const plQuery = useQuery({
    queryKey: ['accounting', 'profitLoss', dateFrom, dateTo, targetMove],
    queryFn: () => getProfitLoss({ dateFrom, dateTo, targetMove, comparison: 0 }),
    staleTime: 60_000,
    retry: 1,
  })

  const reportData = plQuery.data?.reportData
  const incomeEntries = useMemo(() => {
    const a = safeEntries((reportData as any)?.income)
    const b = safeEntries((reportData as any)?.incomeOther)
    return [...a, ...b]
  }, [reportData])

  // IMPORTANT: backend separates expense into multiple buckets.
  // We merge them so "รายจ่าย" isn't shown as 0 when data lives under expenseDirectCost, etc.
  const expenseEntries = useMemo(() => {
    const a = safeEntries((reportData as any)?.expense)
    const b = safeEntries((reportData as any)?.expenseDepreciation)
    const c = safeEntries((reportData as any)?.expenseDirectCost)
    return [...a, ...b, ...c]
  }, [reportData])

  const kpis = useMemo(() => {
    const income = parseNumber((reportData as any)?.totalIncome)
    const expenseMain = parseNumber((reportData as any)?.expense?.total)
    const expenseDep = parseNumber((reportData as any)?.expenseDepreciation?.total)
    const expenseDirect = parseNumber((reportData as any)?.expenseDirectCost?.total)
    const expenseFromBuckets = expenseMain + expenseDep + expenseDirect
    const expenseFallback = parseNumber((reportData as any)?.totalExpense)
    const expense = expenseFromBuckets || expenseFallback
    const profit = income - expense
    return { income, expense, profit }
  }, [reportData])

  const rows = tab === 'income' ? incomeEntries : expenseEntries

  const columns: Column<ProfitLossEntry>[] = [
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
      cell: (r) => {
        const n = parseNumber(r.amount)
        return <span className="font-monospace">{n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      },
    },
    {
      key: 'actions',
      header: '',
      className: 'text-end',
      cell: (r) => {
        const accountId = r.accountId
        const fallbackCode = r.accountCode || extractAccountCodeFromName(r.name)
        const canDrill = Boolean(accountId) || isUsableAccountCode(fallbackCode)
        
        if (import.meta.env.DEV) {
          console.debug('[ProfitLossReportPage] Drilldown button:', {
            accountId,
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
                console.debug('[ProfitLossReportPage] Drilldown clicked:', { accountId, fallbackCode })
              }
              
              const params = new URLSearchParams({ dateFrom, dateTo, targetMove })
              try {
                if (accountId) {
                  const path = `/accounting/reports/general-ledger/account/${accountId}?${params.toString()}`
                  if (import.meta.env.DEV) {
                    console.debug('[ProfitLossReportPage] Navigating to:', path)
                  }
                  navigate(path)
                  return
                }
                if (!isUsableAccountCode(fallbackCode)) {
                  toast.info('ไม่สามารถ drilldown ได้', 'รายการนี้ไม่มี accountId/accountCode')
                  return
                }
                const acc = await getAccountByCode(fallbackCode)
                const path = `/accounting/reports/general-ledger/account/${acc.id}?${params.toString()}`
                if (import.meta.env.DEV) {
                  console.debug('[ProfitLossReportPage] Resolved account, navigating to:', path)
                }
                navigate(path)
              } catch (e) {
                console.error('[ProfitLossReportPage] Drilldown error:', e)
                toast.error('Drilldown ไม่สำเร็จ', e instanceof Error ? e.message : 'Unknown error')
              }
            }}
          >
            Drilldown
          </Button>
        )
      },
    },
  ]

  const title = 'งบกำไรขาดทุน (Profit & Loss)'
  const subtitle = 'คลิก Drilldown เพื่อดู General Ledger รายบัญชี'

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={subtitle}
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

          <Button
            size="sm"
            variant={tab === 'income' ? 'primary' : 'secondary'}
            onClick={() => {
              const next = new URLSearchParams(sp)
              next.set('tab', 'income')
              next.set('dateFrom', dateFrom)
              next.set('dateTo', dateTo)
              next.set('targetMove', targetMove)
              setSp(next, { replace: true })
            }}
          >
            รายได้
          </Button>
          <Button
            size="sm"
            variant={tab === 'expense' ? 'primary' : 'secondary'}
            onClick={() => {
              const next = new URLSearchParams(sp)
              next.set('tab', 'expense')
              next.set('dateFrom', dateFrom)
              next.set('dateTo', dateTo)
              next.set('targetMove', targetMove)
              setSp(next, { replace: true })
            }}
          >
            รายจ่าย
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void plQuery.refetch()}>
            <i className="bi bi-arrow-clockwise me-1" aria-hidden="true" />
            รีเฟรช
          </Button>
        </div>

        <div className="row g-2 mt-2">
          <div className="col-md-4">
            <div className="rounded bg-light p-3">
              <div className="small text-muted">รายได้รวม</div>
              <div className="h5 fw-semibold mb-0 font-monospace">{kpis.income.toLocaleString('th-TH')}</div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="rounded bg-light p-3">
              <div className="small text-muted">รายจ่ายรวม</div>
              <div className="h5 fw-semibold mb-0 font-monospace">{kpis.expense.toLocaleString('th-TH')}</div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="rounded bg-light p-3">
              <div className="small text-muted">กำไรสุทธิ</div>
              <div className="h5 fw-semibold mb-0 font-monospace">{kpis.profit.toLocaleString('th-TH')}</div>
            </div>
          </div>
        </div>
      </Card>

      {plQuery.isError ? (
        <div className="alert alert-danger">
          โหลดรายงานไม่สำเร็จ:{' '}
          {plQuery.error instanceof Error ? plQuery.error.message : 'Unknown error'}
        </div>
      ) : (
        <DataTable
          title={tab === 'income' ? 'รายการรายได้' : 'รายการรายจ่าย'}
          columns={columns}
          rows={rows}
          empty={plQuery.isLoading ? 'กำลังโหลด...' : 'ไม่มีข้อมูล'}
        />
      )}
    </div>
  )
}



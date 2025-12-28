import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts'

import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { getProfitLoss, type ProfitLossEntry, type TargetMove } from '@/api/services/accounting-reports.service'

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10)
}

function firstDayOfThisMonth() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function parseNumber(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (typeof v === 'string') {
    const n = Number(v.replace(/,/g, ''))
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

function safeEntries(entries: unknown): ProfitLossEntry[] {
  if (!Array.isArray(entries)) return []
  return entries.filter((e): e is ProfitLossEntry => {
    if (!e || typeof e !== 'object') return false
    const anyE = e as Record<string, unknown>
    return typeof anyE.name === 'string' && ('amount' in anyE)
  })
}

const pieColors = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#a855f7',
  '#64748b',
]

export function AccountingOverviewPage() {
  const navigate = useNavigate()

  // Default: เดือนนี้ (from first day → today)
  const [dateFrom, setDateFrom] = useState(() => toISODate(firstDayOfThisMonth()))
  const [dateTo, setDateTo] = useState(() => toISODate(new Date()))
  const [targetMove, setTargetMove] = useState<TargetMove>('posted')

  const plQuery = useQuery({
    queryKey: ['accounting', 'profitLoss', dateFrom, dateTo, targetMove],
    queryFn: () =>
      getProfitLoss({
        dateFrom,
        dateTo,
        targetMove,
        // Phase 1: keep comparison off; Phase 2 will build monthly series
        comparison: 0,
      }),
    staleTime: 60_000,
  })

  const kpis = useMemo(() => {
    const rd = plQuery.data?.reportData
    const income = parseNumber(rd?.totalIncome)
    const expense = parseNumber(rd?.totalExpense)
    const profit = parseNumber(rd?.totalEarnings) || income - expense
    return { income, expense, profit }
  }, [plQuery.data])

  const expensePie = useMemo(() => {
    const entries = safeEntries(plQuery.data?.reportData?.expense && (plQuery.data.reportData.expense as any).entries)
    return entries
      .map((e) => ({ name: e.name, value: parseNumber(e.amount) }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [plQuery.data])

  // Phase 1: single-point “month” trend; Phase 2 will use comparison/reportPeriods to build real series
  const trend = useMemo(
    () => [{ label: 'เดือนนี้', income: kpis.income, expense: kpis.expense }],
    [kpis.income, kpis.expense],
  )

  return (
    <div>
      <PageHeader
        title="ภาพรวมบัญชี (Accounting Overview)"
        subtitle="ภาพรวมรายได้ ค่าใช้จ่าย และกำไร — ค่าเริ่มต้น: เดือนนี้"
        breadcrumb="Home · Accounting"
        actions={
          <div className="d-flex gap-2 flex-wrap">
            <Button size="sm" onClick={() => navigate('/sales/invoices')}>
              ไปหน้าใบแจ้งหนี้
            </Button>
            <Button size="sm" variant="secondary" onClick={() => navigate('/expenses')}>
              ไปหน้ารายจ่าย
            </Button>
            <Button size="sm" variant="secondary" onClick={() => navigate('/purchases/orders')}>
              ไปหน้าใบสั่งซื้อ
            </Button>
          </div>
        }
      />

      <Card className="p-3 mb-3">
        <div className="row g-2 align-items-end">
          <div className="col-md-4">
            <label className="form-label">ตั้งแต่</label>
            <input
              className="form-control"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
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
        <div className="mt-2 text-muted small">
          Phase 1 จะดึง Profit &amp; Loss เพื่อทำ KPI + กราฟเบื้องต้น (drilldown ไปเมนู invoice/expenses/purchases ได้)
        </div>
      </Card>

      <div className="row g-3 mb-3">
        <div className="col-lg-4">
          <Card className="p-3 qf-kpi-card qf-kpi-income" role="button" onClick={() => navigate('/sales/invoices')}>
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <div className="text-muted">รายได้รวม</div>
                <div className="fs-3 fw-semibold">{kpis.income.toLocaleString('th-TH')}</div>
              </div>
              <i className="bi bi-graph-up-arrow fs-3 text-primary" aria-hidden="true" />
            </div>
            <div className="small text-muted mt-1">คลิกเพื่อไปหน้าใบแจ้งหนี้</div>
          </Card>
        </div>
        <div className="col-lg-4">
          <Card className="p-3 qf-kpi-card qf-kpi-expense" role="button" onClick={() => navigate('/expenses')}>
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <div className="text-muted">ค่าใช้จ่ายรวม</div>
                <div className="fs-3 fw-semibold">{kpis.expense.toLocaleString('th-TH')}</div>
              </div>
              <i className="bi bi-cash-stack fs-3 text-danger" aria-hidden="true" />
            </div>
            <div className="small text-muted mt-1">คลิกเพื่อไปหน้ารายจ่าย</div>
          </Card>
        </div>
        <div className="col-lg-4">
          <Card className="p-3 qf-kpi-card qf-kpi-profit">
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <div className="text-muted">กำไรสุทธิ</div>
                <div className="fs-3 fw-semibold">{kpis.profit.toLocaleString('th-TH')}</div>
              </div>
              <i className="bi bi-award fs-3 text-success" aria-hidden="true" />
            </div>
            <div className="small text-muted mt-1">คำนวณจาก (รายได้ - ค่าใช้จ่าย)</div>
          </Card>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-xl-7">
          <Card className="p-3">
            <div className="fw-semibold mb-2">รายได้ vs ค่าใช้จ่าย</div>
            <div className="text-muted small mb-2">
              Phase 1 แสดงภาพรวม “เดือนนี้” (Phase 2 จะเพิ่มกราฟตามเดือนด้วย comparison)
            </div>
            <div style={{ height: 290 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend}>
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="income" stroke="#2563eb" fill="#93c5fd" />
                  <Area type="monotone" dataKey="expense" stroke="#dc2626" fill="#fecaca" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <div className="col-xl-5">
          <Card className="p-3">
            <div className="fw-semibold mb-2">สัดส่วนค่าใช้จ่าย (Top 8)</div>
            <div className="text-muted small mb-2">คลิก “รายจ่าย” เพื่อ drilldown ดูรายละเอียด</div>
            <div style={{ height: 290 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={expensePie} dataKey="value" nameKey="name" outerRadius={105} label>
                    {(expensePie ?? []).map((_, idx) => (
                      <Cell key={idx} fill={pieColors[idx % pieColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>

      {plQuery.isError && (
        <div className="alert alert-danger mt-3">
          <div className="fw-semibold mb-1">โหลด Accounting Overview ไม่สำเร็จ</div>
          <div className="small">
            {plQuery.error instanceof Error ? plQuery.error.message : 'Unknown error'}
          </div>
          <div className="small mt-2">
            ตรวจสอบว่า backend มี endpoint <code>/api/th/v1/accounting/reports/profit-loss</code> และ nginx proxy ส่ง <code>/api</code>{' '}
            ไปที่ odoo18-api instance ถูกต้อง
          </div>
        </div>
      )}

      {plQuery.isFetching && (
        <div className="text-muted small mt-2">
          กำลังโหลดข้อมูล...
        </div>
      )}
    </div>
  )
}



import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/features/auth/store'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ping } from '@/api/services/system.service'
import { getDashboardKpis } from '@/api/services/dashboard.service'
import { listInvoices } from '@/api/services/invoices.service'
import { listPurchaseOrders } from '@/api/services/purchases.service'
import { listPurchaseRequests } from '@/api/services/purchase-requests.service'
import { listProducts } from '@/api/services/products.service'
import { getProfitLoss } from '@/api/services/accounting-reports.service'
import { getEtaxSummary } from '@/api/services/etax.service'
import { getAssistantTasks } from '@/api/services/ai-assistant.service'
import { approvalAction, listApprovalTasks } from '@/api/services/approval.service'
import { hasScope } from '@/lib/scopes'
import { isAdminUser } from '@/lib/adminAccess'
import { getAssistantLanguage, setAssistantLanguage, type AssistantLanguage } from '@/lib/assistantLanguage'
import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts'
import { toast } from '@/lib/toastStore'

function formatLocalISODate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function firstDayOfCurrentMonthLocal() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function normalizeUiDate(value: string): string {
  const raw = (value || '').trim()
  if (!raw) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) {
    const day = String(Number(m[1])).padStart(2, '0')
    const month = String(Number(m[2])).padStart(2, '0')
    const year = String(Number(m[3]))
    return `${year}-${month}-${day}`
  }
  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime())) return formatLocalISODate(parsed)
  return ''
}

function parseNumber(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (typeof v === 'string') {
    const raw = v.trim()
    if (!raw) return 0
    const isParenNegative = /^\(.*\)$/.test(raw)
    const cleaned = raw
      .replace(/[,\s]/g, '')
      .replace(/[฿$€£]/g, '')
      .replace(/[()]/g, '')
      .replace(/[^0-9.-]/g, '')
    if (!cleaned) return 0
    const n = Number(cleaned)
    if (!Number.isFinite(n)) return 0
    return isParenNegative ? -Math.abs(n) : n
  }
  return 0
}

function plExpenseTotal(rd: any): number {
  const expenseMain = parseNumber(rd?.expense?.total)
  const expenseDep = parseNumber(rd?.expenseDepreciation?.total)
  const expenseDirect = parseNumber(rd?.expenseDirectCost?.total)
  const expenseFromBuckets = expenseMain + expenseDep + expenseDirect
  return expenseFromBuckets || parseNumber(rd?.totalExpense)
}

function formatMoney(value: number | undefined | null) {
  return (value ?? 0).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

type DashboardCardKey =
  | 'kpis'
  | 'invoices'
  | 'products'
  | 'quotations'
  | 'salesOrders'
  | 'accounting'
  | 'etax'
  | 'purchaseOrders'
  | 'purchaseRequests'
  | 'approvals'
  | 'ai'
  | 'excel'
  | 'backend'
  | 'connection'

const DASHBOARD_CARD_PREF_KEY = 'qf.dashboard.cards.v1'
const DASHBOARD_CARD_DEFAULTS: Record<DashboardCardKey, boolean> = {
  kpis: true,
  invoices: true,
  products: true,
  quotations: true,
  salesOrders: true,
  accounting: true,
  etax: true,
  purchaseOrders: true,
  purchaseRequests: true,
  approvals: true,
  ai: true,
  excel: true,
  backend: true,
  connection: true,
}

function loadDashboardCardPrefs(): Record<DashboardCardKey, boolean> {
  if (typeof window === 'undefined') return DASHBOARD_CARD_DEFAULTS
  try {
    const raw = window.localStorage.getItem(DASHBOARD_CARD_PREF_KEY)
    if (!raw) return DASHBOARD_CARD_DEFAULTS
    const parsed = JSON.parse(raw) as Partial<Record<DashboardCardKey, boolean>>
    return { ...DASHBOARD_CARD_DEFAULTS, ...parsed }
  } catch {
    return DASHBOARD_CARD_DEFAULTS
  }
}

function KpiCard(props: {
  label: string
  value: string
  helper: string
  icon: string
  tone?: string
  onClick?: () => void
}) {
  const { label, value, helper, icon, tone = '#26d6f0', onClick } = props
  return (
    <div
      className="qf-dashboard-kpi-card qf-hover-lift"
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (!onClick) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div className="d-flex align-items-start justify-content-between gap-3">
        <div>
          <div className="small text-muted fw-semibold mb-2">{label}</div>
          <div className="h5 fw-bold mb-0 font-monospace" style={{ color: 'var(--qf-text-strong)' }}>
            {value}
          </div>
        </div>
        <span className="d-inline-flex align-items-center justify-content-center rounded-circle" style={{ width: 38, height: 38, color: tone, background: `${tone}18` }}>
          <i className={`bi ${icon}`} />
        </span>
      </div>
      <div className="small text-muted">{helper}</div>
    </div>
  )
}

export function DashboardPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const instancePublicId = useAuthStore((s) => s.instancePublicId)
  const canAccessAdminSetup = isAdminUser(user)
  const canSeeKpis = hasScope('dashboard')
  const canSeeReports = hasScope('reports')
  const [assistantLang, setAssistantLangState] = useState<AssistantLanguage>(() => getAssistantLanguage())
  const [showCardControl, setShowCardControl] = useState(false)
  const [cardVisibility, setCardVisibility] =
    useState<Record<DashboardCardKey, boolean>>(loadDashboardCardPrefs)
  const [accDateFrom, setAccDateFrom] = useState<string>(() => formatLocalISODate(firstDayOfCurrentMonthLocal()))
  const [accDateTo, setAccDateTo] = useState<string>(() => formatLocalISODate(new Date()))
  const [accFilterFrom, setAccFilterFrom] = useState<string>(() => formatLocalISODate(firstDayOfCurrentMonthLocal()))
  const [accFilterTo, setAccFilterTo] = useState<string>(() => formatLocalISODate(new Date()))

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(DASHBOARD_CARD_PREF_KEY, JSON.stringify(cardVisibility))
  }, [cardVisibility])

  const pingQuery = useQuery({
    queryKey: ['system', 'ping'],
    queryFn: ping,
    staleTime: 30_000,
  })

  const kpiQuery = useQuery({
    queryKey: ['dashboard-kpis', 'month'],
    enabled: canSeeKpis,
    queryFn: () => getDashboardKpis(),
    staleTime: 60_000,
  })

  const invoicesQuery = useQuery({
    queryKey: ['invoices', 'all', 'dashboard'],
    enabled: canSeeKpis,
    queryFn: () => listInvoices({ limit: 1000 }),
    staleTime: 60_000,
  })

  const purchaseOrdersQuery = useQuery({
    queryKey: ['purchaseOrders', 'dashboard'],
    enabled: canSeeKpis,
    queryFn: () => listPurchaseOrders({ limit: 1000 }),
    staleTime: 60_000,
  })

  const purchaseRequestsQuery = useQuery({
    queryKey: ['purchaseRequests', 'dashboard'],
    enabled: canSeeKpis,
    queryFn: () => listPurchaseRequests({ limit: 1000 }),
    staleTime: 60_000,
  })

  const productsQuery = useQuery({
    queryKey: ['products', 'dashboard'],
    enabled: canSeeKpis,
    queryFn: () => listProducts({ limit: 1000, active: true }),
    staleTime: 60_000,
  })

  const etaxQuery = useQuery({
    queryKey: ['etax', 'summary', 'dashboard'],
    queryFn: getEtaxSummary,
    staleTime: 60_000,
    retry: 1,
  })

  const profitLossQuery = useQuery({
    queryKey: ['accounting', 'profitLoss', 'dashboard', accFilterFrom, accFilterTo],
    enabled: true,
    queryFn: () =>
      getProfitLoss({
        dateFrom: accFilterFrom,
        dateTo: accFilterTo,
        targetMove: 'posted',
        comparison: 0,
      }),
    staleTime: 60_000,
    retry: 1,
  })

  const aiTasksQuery = useQuery({
    queryKey: ['ai', 'tasks', 'dashboard'],
    queryFn: () => getAssistantTasks(5),
    staleTime: 30_000,
  })

  const approvalTasksQuery = useQuery({
    queryKey: ['approvalTasks', 'dashboard'],
    queryFn: () => listApprovalTasks(8),
    staleTime: 20_000,
  })

  const approvalMutation = useMutation({
    mutationFn: ({ model, id, action }: { model: string; id: number; action: 'approve' | 'reject' }) =>
      approvalAction(model, id, action),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['approvalTasks', 'dashboard'] })
      await queryClient.invalidateQueries({ queryKey: ['purchaseRequests'] })
      await queryClient.invalidateQueries({ queryKey: ['purchaseRequests', 'dashboard'] })
      toast.success(variables.action === 'approve' ? 'อนุมัติรายการสำเร็จ' : 'ปฏิเสธรายการสำเร็จ')
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'ดำเนินการอนุมัติไม่สำเร็จ')
    },
  })

  const accountingSnapshot = useMemo(() => {
    const rd = profitLossQuery.data?.reportData
    const incomeTotal = parseNumber(rd?.totalIncome)
    const incomeFromBucket = parseNumber((rd as any)?.income?.total)
    const income = incomeTotal || incomeFromBucket
    const expenseTotal = parseNumber(rd?.totalExpense)
    const expenseBucket = plExpenseTotal(rd as any)
    const expense = expenseBucket || expenseTotal
    const profit = income - expense
    return { income, expense, profit }
  }, [profitLossQuery.data])

  const accountingChartData = useMemo(
    () => [
      { name: 'รายได้', value: accountingSnapshot.income, fill: '#26d6f0' },
      { name: 'รายจ่าย', value: accountingSnapshot.expense, fill: '#3b82f6' },
      { name: 'กำไร', value: accountingSnapshot.profit, fill: accountingSnapshot.profit >= 0 ? '#10b981' : '#ef4444' },
    ],
    [accountingSnapshot],
  )

  const purchaseStats = useMemo(() => {
    if (!purchaseOrdersQuery.data) return null
    const orders = purchaseOrdersQuery.data
    const draftCount = orders.filter((o) => o.status === 'draft').length
    const sentCount = orders.filter((o) => o.status === 'sent').length
    const purchaseCount = orders.filter((o) => o.status === 'purchase').length
    const doneCount = orders.filter((o) => o.status === 'done').length
    const totalValue = orders.reduce((sum, o) => sum + o.total, 0)
    return { draftCount, sentCount, purchaseCount, doneCount, totalValue }
  }, [purchaseOrdersQuery.data])

  const paymentStats = useMemo(() => {
    if (!invoicesQuery.data) return null
    const invoices = invoicesQuery.data
    let paidCount = 0
    let paidTotal = 0
    let partialCount = 0
    let partialTotal = 0
    invoices.forEach((inv) => {
      const total = Number(inv.total || 0)
      const amountPaid = Number(inv.amountPaid || 0)
      const amountDue = Number(inv.amountDue || 0)
      const paymentState = inv.paymentState
      const isPaid =
        inv.status === 'paid' ||
        paymentState === 'paid' ||
        (inv.status === 'posted' && total > 0 && amountDue === 0 && amountPaid > 0)
      const isPartial =
        !isPaid &&
        inv.status === 'posted' &&
        (paymentState === 'partial' ||
          paymentState === 'in_payment' ||
          (amountPaid > 0 && amountDue > 0))
      if (isPaid) {
        paidCount++
        paidTotal += total
      } else if (isPartial) {
        partialCount++
        partialTotal += amountPaid > 0 ? amountPaid : Math.max(0, total - amountDue)
      }
    })
    return { paidCount, paidTotal, partialCount, partialTotal }
  }, [invoicesQuery.data])

  const purchaseRequestStats = useMemo(() => {
    if (!purchaseRequestsQuery.data) return null
    const requests = purchaseRequestsQuery.data
    const draftCount = requests.filter((r) => r.state === 'draft').length
    const toApproveCount = requests.filter((r) => r.state === 'to_approve').length
    const approvedCount = requests.filter((r) => r.state === 'approved').length
    const doneCount = requests.filter((r) => r.state === 'done').length
    const totalValue = requests.reduce((sum, r) => sum + (r.totalEstimatedCost || 0), 0)
    return { draftCount, toApproveCount, approvedCount, doneCount, totalValue, totalCount: requests.length }
  }, [purchaseRequestsQuery.data])

  const recentActivities = useMemo(() => {
    const rows: Array<{ tone?: string; title: string; time: string }> = []
    const firstInvoice = invoicesQuery.data?.[0]
    const firstPo = purchaseOrdersQuery.data?.[0]
    const firstApproval = approvalTasksQuery.data?.items?.[0]
    if (firstInvoice) {
      rows.push({
        title: `ใบแจ้งหนี้ ${firstInvoice.number || firstInvoice.id} · ${firstInvoice.customerName || 'ลูกค้า'}`,
        time: firstInvoice.invoiceDate || 'ล่าสุด',
      })
    }
    if (firstPo) {
      rows.push({
        title: `ใบสั่งซื้อ ${firstPo.number || firstPo.id} · ${firstPo.vendorName || 'ผู้ขาย'}`,
        time: firstPo.orderDate || 'ล่าสุด',
        tone: '#3b82f6',
      })
    }
    if (firstApproval) {
      rows.push({
        title: `งานรออนุมัติ ${firstApproval.name}`,
        time: firstApproval.requestedDate || 'ล่าสุด',
        tone: '#f59e0b',
      })
    }
    rows.push({
      title: pingQuery.data?.pong ? 'ระบบเชื่อมต่อ backend สำเร็จ' : 'ตรวจสอบสถานะระบบได้จากการ์ดการเชื่อมต่อ',
      time: 'ระบบ',
      tone: pingQuery.data?.pong ? '#10b981' : '#cbd5e1',
    })
    return rows.slice(0, 4)
  }, [approvalTasksQuery.data, invoicesQuery.data, pingQuery.data, purchaseOrdersQuery.data])

  const statusMeta = (status: string) => {
    if (status === 'executed') return { label: 'สำเร็จ', cls: 'bg-success-subtle text-success-emphasis' }
    if (status === 'failed') return { label: 'ผิดพลาด', cls: 'bg-danger-subtle text-danger-emphasis' }
    if (status === 'planned') return { label: 'วางแผนแล้ว', cls: 'bg-warning-subtle text-warning-emphasis' }
    return { label: 'ร่าง', cls: 'bg-secondary-subtle text-secondary-emphasis' }
  }

  const applyAccountingRange = () => {
    const from = normalizeUiDate(accDateFrom)
    const to = normalizeUiDate(accDateTo)
    if (!from || !to) return
    if (new Date(from).getTime() > new Date(to).getTime()) return
    setAccDateFrom(from)
    setAccDateTo(to)
    setAccFilterFrom(from)
    setAccFilterTo(to)
  }

  const resetAccountingRange = () => {
    const from = formatLocalISODate(firstDayOfCurrentMonthLocal())
    const to = formatLocalISODate(new Date())
    setAccDateFrom(from)
    setAccDateTo(to)
    setAccFilterFrom(from)
    setAccFilterTo(to)
  }

  const goToProfitLossDetail = (tab: 'income' | 'expense') => {
    const sp = new URLSearchParams({
      tab,
      dateFrom: accFilterFrom,
      dateTo: accFilterTo,
      targetMove: 'posted',
    })
    navigate(`/accounting/reports/profit-loss?${sp.toString()}`)
  }

  const onMetricCardKeyDown = (e: KeyboardEvent<HTMLDivElement>, tab: 'income' | 'expense') => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      goToProfitLossDetail(tab)
    }
  }

  const productCount = productsQuery.data?.total ?? productsQuery.data?.items.length ?? 0
  const paidTotal = kpiQuery.data?.payments?.paidTotal ?? paymentStats?.paidTotal ?? 0
  const paidCount = kpiQuery.data?.payments?.paidCount ?? paymentStats?.paidCount ?? 0
  const partialTotal = kpiQuery.data?.payments?.partialTotal ?? paymentStats?.partialTotal ?? 0
  const partialCount = kpiQuery.data?.payments?.partialCount ?? paymentStats?.partialCount ?? 0

  return (
    <div className="d-flex flex-column gap-4">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
        <div>
          <h1 className="qf-page-title mb-1" style={{ fontSize: '26px', fontWeight: 700 }}>
            สวัสดี, {user?.name || 'ผู้ใช้งาน'}
          </h1>
          <p className="text-muted mb-0 small">
            ภาพรวมธุรกิจ ยอดขาย รายจ่าย กำไร และงานที่ต้องติดตามจากข้อมูลจริงของระบบ
          </p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <Button className="text-white px-4 py-2 border-0 qf-hover-lift" onClick={() => navigate('/sales/invoices/new')}>
            <i className="bi bi-plus-circle me-2" />
            สร้างใบแจ้งหนี้
          </Button>
          <Button variant="secondary" className="px-4 py-2 qf-hover-lift" onClick={() => navigate('/expenses/new')}>
            <i className="bi bi-cash me-2" />
            บันทึกค่าใช้จ่าย
          </Button>
          <Button variant="secondary" className="px-4 py-2 qf-hover-lift" onClick={() => navigate('/sales/orders/new?type=quotation')}>
            <i className="bi bi-file-earmark-text me-2" />
            สร้างใบเสนอราคา
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowCardControl((s) => !s)}>
            <i className="bi bi-grid me-1" />
            {showCardControl ? 'ปิดตั้งค่าการ์ด' : 'จัดการการ์ด'}
          </Button>
        </div>
      </div>

      {showCardControl ? (
        <Card className="p-3">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
            <div className="fw-semibold">เลือกการ์ดที่ต้องการแสดงบนแดชบอร์ด</div>
            <Button size="sm" variant="secondary" onClick={() => setCardVisibility({ ...DASHBOARD_CARD_DEFAULTS })}>
              รีเซ็ตค่าเริ่มต้น
            </Button>
          </div>
          <div className="row g-2">
            {(
              [
                ['kpis', 'การ์ดสรุป'],
                ['invoices', 'ใบแจ้งหนี้'],
                ['products', 'สินค้า/บริการ'],
                ['quotations', 'ใบเสนอราคา'],
                ['salesOrders', 'ใบสั่งขาย'],
                ['accounting', 'รายงานบัญชี'],
                ['etax', 'e-Tax'],
                ['purchaseOrders', 'ใบสั่งซื้อ'],
                ['purchaseRequests', 'คำขอซื้อ'],
                ['approvals', 'งานรออนุมัติ'],
                ['ai', 'ERPTH AI'],
                ['excel', 'นำเข้า Excel'],
                ['backend', 'ระบบหลังบ้าน'],
                ['connection', 'สถานะการเชื่อมต่อ'],
              ] as Array<[DashboardCardKey, string]>
            ).map(([key, label]) => (
              <div className="col-6 col-md-4 col-xl-3" key={key}>
                <label className="form-check form-switch mb-0 rounded border bg-light px-3 py-2 w-100">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={Boolean(cardVisibility[key])}
                    onChange={() => setCardVisibility((prev) => ({ ...prev, [key]: !prev[key] }))}
                  />
                  <span className="form-check-label ms-2">{label}</span>
                </label>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {canSeeKpis && cardVisibility.kpis ? (
        <div className="qf-kpi-grid">
          <KpiCard
            label="ยอดขายยืนยันแล้ว"
            value={kpiQuery.isLoading ? '...' : kpiQuery.isError ? '—' : formatMoney(kpiQuery.data?.salesInvoices.postedTotal)}
            helper={kpiQuery.data ? `${kpiQuery.data.salesInvoices.postedCount} ใบ` : 'ยอดขายที่โพสต์แล้ว'}
            icon="bi-receipt"
            onClick={() => navigate('/sales/invoices')}
          />
          <KpiCard
            label="ลูกหนี้คงค้าง"
            value={kpiQuery.isLoading ? '...' : kpiQuery.isError ? '—' : formatMoney(kpiQuery.data?.receivables.openTotal)}
            helper={kpiQuery.data ? `${kpiQuery.data.receivables.openCount} ใบ` : 'ยอดค้างชำระ'}
            icon="bi-wallet2"
            tone="#3b82f6"
            onClick={() => navigate('/sales/invoices?tab=due')}
          />
          <KpiCard
            label="เกินกำหนด"
            value={kpiQuery.isLoading ? '...' : kpiQuery.isError ? '—' : formatMoney(kpiQuery.data?.receivables.overdueTotal)}
            helper={kpiQuery.data ? `${kpiQuery.data.receivables.overdueCount} ใบ` : 'เกินกำหนดชำระ'}
            icon="bi-exclamation-circle"
            tone="#ef4444"
            onClick={() => navigate('/sales/invoices')}
          />
          <KpiCard
            label="ชำระครบแล้ว"
            value={invoicesQuery.isLoading ? '...' : formatMoney(paidTotal)}
            helper={`${paidCount} ใบ`}
            icon="bi-check-circle"
            tone="#10b981"
            onClick={() => navigate('/sales/receipts')}
          />
          <KpiCard
            label="คำขอซื้อ"
            value={purchaseRequestsQuery.isLoading ? '...' : `${purchaseRequestStats?.totalCount ?? 0}`}
            helper={`รออนุมัติ ${purchaseRequestStats?.toApproveCount ?? 0} รายการ`}
            icon="bi-clipboard-check"
            tone="#f59e0b"
            onClick={() => navigate('/purchases/requests')}
          />
          <KpiCard
            label="กำไรสุทธิ"
            value={profitLossQuery.isLoading ? '...' : formatMoney(accountingSnapshot.profit)}
            helper={`ช่วง ${accFilterFrom} ถึง ${accFilterTo}`}
            icon="bi-graph-up-arrow"
            tone={accountingSnapshot.profit >= 0 ? '#10b981' : '#ef4444'}
            onClick={() => navigate('/accounting/reports/profit-loss')}
          />
        </div>
      ) : null}

      <div className="row g-4">
        <div className="col-12 col-xl-8">
          <Card className="p-4 h-100">
            <div className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3 mb-4">
              <div>
                <h2 className="h5 fw-bold mb-1">สรุปบัญชี</h2>
                <p className="text-muted small mb-0">
                  ช่วงวันที่ {accFilterFrom} ถึง {accFilterTo}
                  {!canSeeReports ? <span className="ms-2">(ถ้าเรียกไม่ได้ ให้เปิด scope: <code>reports</code>)</span> : null}
                </p>
              </div>
              <div className="d-flex gap-2 flex-wrap">
                <input className="form-control form-control-sm" type="date" style={{ width: 150 }} value={accDateFrom} onChange={(e) => setAccDateFrom(e.target.value)} />
                <input className="form-control form-control-sm" type="date" style={{ width: 150 }} value={accDateTo} onChange={(e) => setAccDateTo(e.target.value)} />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={applyAccountingRange}
                  disabled={!accDateFrom || !accDateTo || new Date(accDateFrom).getTime() > new Date(accDateTo).getTime()}
                >
                  ใช้ช่วงวันที่
                </Button>
                <Button size="sm" variant="ghost" onClick={resetAccountingRange}>เดือนนี้</Button>
              </div>
            </div>

            {profitLossQuery.isError ? (
              <div className="alert alert-danger mb-0">
                <div className="fw-semibold">โหลดสรุปบัญชีไม่สำเร็จ</div>
                <div className="small">{profitLossQuery.error instanceof Error ? profitLossQuery.error.message : 'ไม่ทราบสาเหตุ'}</div>
              </div>
            ) : (
              <>
                <div className="row g-3 mb-4">
                  <div className="col-12 col-md-4">
                    <div className="rounded-4 bg-light p-3 h-100 qf-clickable-metric qf-clickable-metric--income" role="button" tabIndex={0} onClick={() => goToProfitLossDetail('income')} onKeyDown={(e) => onMetricCardKeyDown(e, 'income')}>
                      <div className="small text-muted">รายได้รวม</div>
                      <div className="h4 fw-bold mb-0 font-monospace">{formatMoney(accountingSnapshot.income)}</div>
                    </div>
                  </div>
                  <div className="col-12 col-md-4">
                    <div className="rounded-4 bg-light p-3 h-100 qf-clickable-metric qf-clickable-metric--expense" role="button" tabIndex={0} onClick={() => goToProfitLossDetail('expense')} onKeyDown={(e) => onMetricCardKeyDown(e, 'expense')}>
                      <div className="small text-muted">รายจ่ายรวม</div>
                      <div className="h4 fw-bold mb-0 font-monospace">{formatMoney(accountingSnapshot.expense)}</div>
                    </div>
                  </div>
                  <div className="col-12 col-md-4">
                    <div className={`rounded-4 p-3 h-100 qf-profit-metric ${accountingSnapshot.profit >= 0 ? 'qf-profit-metric--gain' : 'qf-profit-metric--loss'}`}>
                      <div className="small text-muted">กำไรสุทธิ</div>
                      <div className="h4 fw-bold mb-0 font-monospace">{formatMoney(accountingSnapshot.profit)}</div>
                    </div>
                  </div>
                </div>
                <div className="qf-chart-box">
                  <ResponsiveContainer width="100%" height="100%" minWidth={280} minHeight={280}>
                    <BarChart data={accountingChartData} margin={{ top: 12, right: 20, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 13 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(value) => formatMoney(Number(value))} />
                      <Bar dataKey="value" radius={[10, 10, 0, 0]} isAnimationActive={false} barSize={72}>
                        {accountingChartData.map((d) => (
                          <Cell key={d.name} fill={d.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </Card>
        </div>

        <div className="col-12 col-xl-4">
          <Card className="p-4 h-100">
            <h2 className="h5 fw-bold mb-1">งานค้างที่ต้องติดตาม</h2>
            <p className="text-muted mb-4 small">งานอนุมัติ เอกสาร e-Tax และรายการที่ควรตรวจสอบ</p>
            <div className="d-flex flex-column gap-3">
              <button className="d-flex align-items-center justify-content-between p-3 rounded-4 bg-light border qf-hover-lift text-start" type="button" onClick={() => navigate('/accounting/document-review')}>
                <span>
                  <span className="d-block fw-semibold small">คำขอซื้อรอการอนุมัติ</span>
                  <span className="d-block text-muted" style={{ fontSize: '11px' }}>งานอนุมัติในคิวความรับผิดชอบของคุณ</span>
                </span>
                <span className="badge bg-light text-dark border fw-bold">{approvalTasksQuery.data?.pendingCount || 0} รายการ</span>
              </button>
              <button className="d-flex align-items-center justify-content-between p-3 rounded-4 bg-light border qf-hover-lift text-start" type="button" onClick={() => navigate('/accounting/etax')}>
                <span>
                  <span className="d-block fw-semibold small">เอกสาร e-Tax รอส่ง</span>
                  <span className="d-block text-muted" style={{ fontSize: '11px' }}>นำส่งข้อมูลใบกำกับภาษีอิเล็กทรอนิกส์</span>
                </span>
                <span className="badge bg-light text-dark border fw-bold">{etaxQuery.data?.config?.usage?.queueDepth || 0} รายการ</span>
              </button>
              <button className="d-flex align-items-center justify-content-between p-3 rounded-4 bg-light border qf-hover-lift text-start" type="button" onClick={() => navigate('/sales/invoices')}>
                <span>
                  <span className="d-block fw-semibold small">ใบแจ้งหนี้เกินกำหนด</span>
                  <span className="d-block text-muted" style={{ fontSize: '11px' }}>ยอดขายที่พ้นกำหนดการชำระเงิน</span>
                </span>
                <span className="badge bg-light text-dark border fw-bold">{kpiQuery.data?.receivables.overdueCount || 0} ใบ</span>
              </button>
              <button className="d-flex align-items-center justify-content-between p-3 rounded-4 bg-light border qf-hover-lift text-start" type="button" onClick={() => navigate('/purchases/orders')}>
                <span>
                  <span className="d-block fw-semibold small">ใบสั่งซื้อรอตรวจสอบ</span>
                  <span className="d-block text-muted" style={{ fontSize: '11px' }}>ตรวจสอบและยืนยัน Purchase Orders</span>
                </span>
                <span className="badge bg-light text-dark border fw-bold">{purchaseStats?.draftCount || 0} ใบ</span>
              </button>
            </div>
          </Card>
        </div>
      </div>

      <div className="row g-4">
        {cardVisibility.invoices ? (
          <div className="col-md-6 col-xl-3">
            <Card onClick={() => navigate('/sales/invoices')} role="button" tabIndex={0} className="qf-dashboard-card qf-hover-lift h-100">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <p className="small fw-medium text-muted mb-0">ใบแจ้งหนี้</p>
                <i className="bi bi-receipt text-primary" style={{ fontSize: '1.5rem' }} />
              </div>
              <p className="h6 fw-semibold mb-2">ไปจัดการใบแจ้งหนี้</p>
              <p className="small text-muted mb-0">สร้าง/แก้ไข/โพสต์ใบแจ้งหนี้</p>
            </Card>
          </div>
        ) : null}
        {cardVisibility.products ? (
          <div className="col-md-6 col-xl-3">
            <Card onClick={() => navigate('/products')} role="button" tabIndex={0} className="qf-dashboard-card qf-hover-lift h-100">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <p className="small fw-medium text-muted mb-0">สินค้า/บริการ</p>
                <i className="bi bi-box-seam" style={{ fontSize: '1.5rem', color: '#0ea5e9' }} />
              </div>
              <p className="h6 fw-semibold mb-2">{productsQuery.isLoading ? 'กำลังโหลด...' : productsQuery.isError ? '—' : `${productCount} รายการ`}</p>
              <p className="small text-muted mb-0">จัดการสินค้าและบริการ</p>
            </Card>
          </div>
        ) : null}
        {cardVisibility.purchaseOrders ? (
          <div className="col-md-6 col-xl-3">
            <Card onClick={() => navigate('/purchases/orders')} role="button" tabIndex={0} className="qf-dashboard-card qf-hover-lift h-100">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <p className="small fw-medium text-muted mb-0">ใบสั่งซื้อ</p>
                <i className="bi bi-cart text-success" style={{ fontSize: '1.5rem' }} />
              </div>
              <p className="h6 fw-semibold mb-2">{purchaseOrdersQuery.isLoading ? 'กำลังโหลด...' : purchaseOrdersQuery.isError ? '—' : `${(purchaseStats?.doneCount || 0) + (purchaseStats?.purchaseCount || 0)} ใบ`}</p>
              <p className="small text-muted mb-0">มูลค่า {formatMoney(purchaseStats?.totalValue)}</p>
            </Card>
          </div>
        ) : null}
        {cardVisibility.etax ? (
          <div className="col-md-6 col-xl-3">
            <Card onClick={() => navigate('/accounting/etax')} role="button" tabIndex={0} className="qf-dashboard-card qf-hover-lift h-100">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <p className="small fw-medium text-muted mb-0">e-Tax</p>
                <i className="bi bi-receipt-cutoff" style={{ fontSize: '1.5rem', color: '#0f766e' }} />
              </div>
              <p className="h6 fw-semibold mb-2">{etaxQuery.isLoading ? 'กำลังโหลด...' : etaxQuery.isError ? '—' : `${etaxQuery.data?.config?.usage?.queueDepth ?? 0} รายการในคิว`}</p>
              <p className="small text-muted mb-0">สำเร็จ {etaxQuery.data?.config?.usage ? `${etaxQuery.data.config.usage.successRate.toFixed(1)}%` : '—'}</p>
            </Card>
          </div>
        ) : null}
      </div>

      <div className="row g-4">
        {cardVisibility.approvals ? (
          <div className="col-12 col-xl-6">
            <Card className="p-4 h-100">
              <div className="d-flex align-items-start justify-content-between gap-3 mb-3">
                <div>
                  <h2 className="h5 fw-bold mb-1">งานรออนุมัติของฉัน</h2>
                  <p className="small text-muted mb-0">ผูกกับ backend approval queue และ process ได้จากหน้าหลัก</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => navigate('/accounting/document-review')}>เปิดกล่องงาน</Button>
              </div>
              {approvalTasksQuery.isLoading ? (
                <div className="small text-muted">กำลังโหลดงานอนุมัติ...</div>
              ) : approvalTasksQuery.isError ? (
                <div className="small text-danger">โหลด approval inbox ไม่สำเร็จ</div>
              ) : (approvalTasksQuery.data?.items.length || 0) === 0 ? (
                <div className="small text-muted">ไม่มีงานรออนุมัติในขณะนี้</div>
              ) : (
                <div className="d-flex flex-column gap-3">
                  {approvalTasksQuery.data?.items.slice(0, 3).map((task) => (
                    <div key={`${task.model}:${task.id}`} className="border rounded-4 p-3 bg-light">
                      <div className="d-flex flex-column flex-lg-row align-items-lg-start justify-content-between gap-3">
                        <div className="flex-grow-1">
                          <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                            <span className="badge text-bg-warning">รออนุมัติ</span>
                            <span className="badge text-bg-light">{task.typeLabel || task.type}</span>
                            {task.approvalTeamName ? <span className="badge text-bg-info">{task.approvalTeamName}</span> : null}
                          </div>
                          <div className="fw-semibold">{task.name}</div>
                          <div className="small text-muted mt-1">
                            {task.requestedByName ? `ผู้ขอ: ${task.requestedByName}` : 'ผู้ขอ: -'}
                            {task.company ? ` · บริษัท: ${task.company}` : ''}
                            {task.requestedDate ? ` · วันที่: ${task.requestedDate}` : ''}
                          </div>
                        </div>
                        <div className="text-lg-end">
                          <div className="fw-semibold">{formatMoney(task.amountTotal)} {task.currency || 'THB'}</div>
                          <div className="small text-muted">มูลค่ารวมโดยประมาณ</div>
                        </div>
                      </div>
                      <div className="d-flex flex-wrap gap-2 mt-3">
                        <Button
                          size="sm"
                          onClick={() => approvalMutation.mutate({ model: task.model, id: task.id, action: 'approve' })}
                          isLoading={approvalMutation.isPending && approvalMutation.variables?.model === task.model && approvalMutation.variables?.id === task.id && approvalMutation.variables?.action === 'approve'}
                        >
                          อนุมัติ
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => approvalMutation.mutate({ model: task.model, id: task.id, action: 'reject' })}
                          isLoading={approvalMutation.isPending && approvalMutation.variables?.model === task.model && approvalMutation.variables?.id === task.id && approvalMutation.variables?.action === 'reject'}
                        >
                          ปฏิเสธ
                        </Button>
                        {task.route ? <Button size="sm" variant="ghost" onClick={() => navigate(task.route || '/accounting/document-review')}>เปิดเอกสาร</Button> : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        ) : null}

        <div className="col-12 col-xl-6">
          <Card className="p-4 h-100">
            <h2 className="h5 fw-bold mb-1">ประวัติกิจกรรมล่าสุด</h2>
            <p className="text-muted mb-4 small">กิจกรรมและเอกสารที่ดึงได้จากรายการล่าสุดในระบบ</p>
            <div className="qf-timeline">
              {recentActivities.map((activity) => (
                <div className="qf-timeline-item" key={`${activity.time}:${activity.title}`}>
                  <span className="qf-timeline-indicator" style={{ background: activity.tone }} />
                  <div className="qf-timeline-time">{activity.time}</div>
                  <div className="qf-timeline-content">{activity.title}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <div className="row g-4">
        {cardVisibility.ai ? (
          <div className="col-md-6 col-xl-3">
            <Card onClick={() => navigate('/agent')} role="button" tabIndex={0} className="qf-dashboard-card h-100 qf-hover-lift" style={{ background: 'linear-gradient(135deg, #26d6f0 0%, #3b82f6 100%)', color: 'white', cursor: 'pointer' }}>
              <div className="d-flex align-items-center justify-content-between mb-2">
                <p className="small fw-medium mb-0" style={{ opacity: 0.9 }}>ผู้ช่วย AI</p>
                <select
                  className="form-select form-select-sm"
                  value={assistantLang}
                  style={{ minWidth: 88, background: 'rgba(255,255,255,0.88)', color: '#0f172a' }}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    const next = e.target.value === 'en_US' ? 'en_US' : 'th_TH'
                    setAssistantLanguage(next)
                    setAssistantLangState(next)
                  }}
                >
                  <option value="th_TH">TH</option>
                  <option value="en_US">EN</option>
                </select>
              </div>
              <p className="h6 fw-semibold mb-2" style={{ color: 'white' }}>สร้างด้วย AI</p>
              <div className="small" style={{ opacity: 0.95 }}>
                {aiTasksQuery.isLoading ? 'กำลังโหลด task...' : aiTasksQuery.isError ? 'โหลด task ไม่สำเร็จ' : (aiTasksQuery.data || []).length === 0 ? 'ยังไม่มี task' : `${aiTasksQuery.data?.length ?? 0} task ล่าสุด`}
              </div>
              {(aiTasksQuery.data || []).slice(0, 2).map((task) => {
                const meta = statusMeta(task.status)
                return (
                  <div key={task.session_id} className="rounded p-2 mt-2" style={{ background: 'rgba(255,255,255,0.16)' }} onClick={(e) => e.stopPropagation()}>
                    <div className="fw-semibold text-truncate small" title={task.title}>{task.title}</div>
                    <span className={`badge mt-1 ${meta.cls}`}>{meta.label}</span>
                  </div>
                )
              })}
            </Card>
          </div>
        ) : null}
        {cardVisibility.excel ? (
          <div className="col-md-6 col-xl-3">
            <Card onClick={() => navigate('/excel-import')} role="button" tabIndex={0} className="qf-dashboard-card qf-hover-lift h-100">
              <p className="small fw-medium text-muted mb-2">นำเข้า Excel</p>
              <p className="h6 fw-semibold mb-2">นำเข้าข้อมูลจาก Excel</p>
              <p className="small text-muted mb-0">อัปโหลด .xlsx เพื่อสร้างข้อมูล</p>
            </Card>
          </div>
        ) : null}
        {cardVisibility.backend && canAccessAdminSetup ? (
          <div className="col-md-6 col-xl-3">
            <Card onClick={() => navigate('/backend-connection')} role="button" tabIndex={0} className="qf-dashboard-card qf-hover-lift h-100">
              <p className="small fw-medium text-muted mb-2">ระบบหลังบ้าน</p>
              <p className="h6 fw-semibold mb-2">ตั้งค่า/Provisioning</p>
              <p className="small text-muted mb-0">สร้างบริษัทและ admin ใหม่</p>
            </Card>
          </div>
        ) : null}
        {cardVisibility.connection ? (
          <div className="col-md-6 col-xl-3">
            <Card className="h-100">
              <p className="small fw-medium text-muted mb-2">สถานะการเชื่อมต่อ</p>
              <p className="h6 fw-semibold mb-2">
                {pingQuery.isLoading ? 'กำลังตรวจสอบ...' : pingQuery.isError ? 'เชื่อมต่อไม่ได้' : pingQuery.data?.pong ? 'เชื่อมต่อได้ (pong)' : 'ไม่ทราบสถานะ'}
              </p>
              <p className="small text-muted mb-0">รหัส Instance: {instancePublicId ?? '—'}</p>
            </Card>
          </div>
        ) : null}
      </div>

      {partialCount > 0 ? (
        <div className="small text-muted">
          ชำระบางส่วน {partialCount} ใบ · ยอดรับแล้วบางส่วน {formatMoney(partialTotal)}
        </div>
      ) : null}
    </div>
  )
}

import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/features/auth/store'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ping } from '@/api/services/system.service'
import { getDashboardKpis } from '@/api/services/dashboard.service'
import { listInvoices } from '@/api/services/invoices.service'
import { listPurchaseOrders } from '@/api/services/purchases.service'
import { listPurchaseRequests } from '@/api/services/purchase-requests.service'
import { listProducts } from '@/api/services/products.service'
import { getProfitLoss } from '@/api/services/accounting-reports.service'
import { getAssistantTasks } from '@/api/services/ai-assistant.service'
import { hasScope } from '@/lib/scopes'
import { getAssistantLanguage, setAssistantLanguage, type AssistantLanguage } from '@/lib/assistantLanguage'
import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts'

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
    // Accounting formats can include commas, currency symbols, spaces, and negatives in parentheses.
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

type DashboardCardKey =
  | 'kpis'
  | 'invoices'
  | 'products'
  | 'quotations'
  | 'salesOrders'
  | 'accounting'
  | 'purchaseOrders'
  | 'purchaseRequests'
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
  purchaseOrders: true,
  purchaseRequests: true,
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

export function DashboardPage() {
  const navigate = useNavigate()
  const instancePublicId = useAuthStore((s) => s.instancePublicId)
  const canSeeKpis = hasScope('dashboard')
  const canSeeReports = hasScope('reports')
  const [assistantLang, setAssistantLangState] = useState<AssistantLanguage>(() => getAssistantLanguage())
  const [showCardControl, setShowCardControl] = useState(false)
  const [cardVisibility, setCardVisibility] =
    useState<Record<DashboardCardKey, boolean>>(loadDashboardCardPrefs)

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(DASHBOARD_CARD_PREF_KEY, JSON.stringify(cardVisibility))
  }, [cardVisibility])

  const [accDateFrom, setAccDateFrom] = useState<string>(() =>
    formatLocalISODate(firstDayOfCurrentMonthLocal()),
  )
  const [accDateTo, setAccDateTo] = useState<string>(() => formatLocalISODate(new Date()))
  const [accFilterFrom, setAccFilterFrom] = useState<string>(() =>
    formatLocalISODate(firstDayOfCurrentMonthLocal()),
  )
  const [accFilterTo, setAccFilterTo] = useState<string>(() => formatLocalISODate(new Date()))

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

  // Fetch invoices to calculate payment status (fallback if backend doesn't return payments)
  const invoicesQuery = useQuery({
    queryKey: ['invoices', 'all', 'dashboard'],
    enabled: canSeeKpis,
    queryFn: () => listInvoices({ limit: 1000 }), // Get all invoices for calculation
    staleTime: 60_000,
  })

  // Fetch purchase orders for dashboard
  const purchaseOrdersQuery = useQuery({
    queryKey: ['purchaseOrders', 'dashboard'],
    enabled: canSeeKpis,
    queryFn: () => listPurchaseOrders({ limit: 1000 }), // Get all purchase orders for calculation
    staleTime: 60_000,
  })

  // Fetch purchase requests for dashboard
  const purchaseRequestsQuery = useQuery({
    queryKey: ['purchaseRequests', 'dashboard'],
    enabled: canSeeKpis,
    queryFn: () => listPurchaseRequests({ limit: 1000 }), // Get all purchase requests for calculation
    staleTime: 60_000,
  })

  const productsQuery = useQuery({
    queryKey: ['products', 'dashboard'],
    enabled: canSeeKpis,
    queryFn: () => listProducts({ limit: 1000, active: true }),
    staleTime: 60_000,
  })

  const profitLossQuery = useQuery({
    queryKey: ['accounting', 'profitLoss', 'dashboard', accFilterFrom, accFilterTo],
    // Even if scope isn't enabled, allow request; backend will enforce scopes.
    // This keeps UX consistent with the rest of the app.
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

  const accountingChartData = useMemo(() => {
    return [
      { name: 'รายได้', value: accountingSnapshot.income, fill: '#2563eb' },
      { name: 'รายจ่าย', value: accountingSnapshot.expense, fill: '#dc2626' },
      { name: 'กำไร', value: accountingSnapshot.profit, fill: '#16a34a' },
    ]
  }, [accountingSnapshot.expense, accountingSnapshot.income, accountingSnapshot.profit])

  // Calculate purchase orders stats
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

  // Calculate payment stats from invoices
  const paymentStats = useMemo(() => {
    if (!invoicesQuery.data) return null
    const invoices = invoicesQuery.data
    let paidCount = 0
    let paidTotal = 0
    let partialCount = 0
    let partialTotal = 0

    invoices.forEach((inv) => {
      if (inv.status === 'paid') {
        paidCount++
        paidTotal += inv.total
      } else if (inv.status === 'posted') {
        // For posted invoices, we can't determine partial payment without amountPaid/amountDue
        // So we'll only count fully paid ones for now
      }
    })

    return { paidCount, paidTotal, partialCount, partialTotal }
  }, [invoicesQuery.data])

  // Calculate purchase requests stats
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

  return (
    <div>
      <PageHeader
        title="แดชบอร์ดภาพรวมธุรกิจ"
        subtitle="ภาพรวมยอดขาย รายจ่าย กำไร และสถานะใบแจ้งหนี้สำหรับ Quickfront18"
        breadcrumb="Home · Dashboard"
        actions={
          <div className="d-flex gap-2">
            <Button 
              size="sm" 
              onClick={() => navigate('/sales/invoices')}
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                border: 'none',
                color: 'white',
              }}
            >
              <i className="bi bi-receipt me-1"></i>
              ไปหน้าใบแจ้งหนี้
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void pingQuery.refetch()}
              style={{
                border: '1px solid #e5e7eb',
              }}
            >
              <i className="bi bi-arrow-clockwise me-1"></i>
              ตรวจสอบการเชื่อมต่อ
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowCardControl((s) => !s)}
              style={{ border: '1px solid #e5e7eb' }}
            >
              <i className="bi bi-grid me-1"></i>
              {showCardControl ? 'ปิดตั้งค่าการ์ด' : 'จัดการการ์ด'}
            </Button>
          </div>
        }
      />

      {showCardControl && (
        <div className="mb-3">
          <Card className="p-3">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
              <div className="fw-semibold">เลือกการ์ดที่ต้องการแสดงบน Dashboard</div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setCardVisibility({ ...DASHBOARD_CARD_DEFAULTS })}
              >
                รีเซ็ตค่าเริ่มต้น
              </Button>
            </div>
            <div className="row g-2">
              {(
                [
                  ['kpis', 'KPI Cards'],
                  ['invoices', 'Invoices'],
                  ['products', 'Products'],
                  ['quotations', 'Quotations'],
                  ['salesOrders', 'Sale Orders'],
                  ['accounting', 'รายงานบัญชี'],
                  ['purchaseOrders', 'Purchase Orders'],
                  ['purchaseRequests', 'Purchase Requests'],
                  ['ai', 'ERPTH AI'],
                  ['excel', 'Excel Import'],
                  ['backend', 'Backend'],
                  ['connection', 'Connection'],
                ] as Array<[DashboardCardKey, string]>
              ).map(([key, label]) => (
                <div className="col-6 col-md-4 col-xl-3" key={key}>
                  <label className="form-check form-switch mb-0 rounded border bg-light px-3 py-2 w-100">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      checked={Boolean(cardVisibility[key])}
                      onChange={() =>
                        setCardVisibility((prev) => ({
                          ...prev,
                          [key]: !prev[key],
                        }))
                      }
                    />
                    <span className="form-check-label ms-2">{label}</span>
                  </label>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      <div className="row g-4">
        {canSeeKpis && cardVisibility.kpis && (
          <>
            <div className="col-md-6 col-xl-3">
              <Card>
                <p className="small fw-medium text-muted mb-2">Sales (Posted)</p>
                <p className="h6 fw-semibold mb-2">
                  {kpiQuery.isLoading
                    ? 'กำลังโหลด...'
                    : kpiQuery.isError
                      ? '—'
                      : kpiQuery.data?.salesInvoices.postedTotal.toLocaleString('th-TH', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                </p>
                <p className="small text-muted mb-0">
                  {kpiQuery.data
                    ? `${kpiQuery.data.salesInvoices.postedCount} ใบ`
                    : 'ยอดขายที่โพสต์แล้ว'}
                </p>
              </Card>
            </div>
            <div className="col-md-6 col-xl-3">
              <Card>
                <p className="small fw-medium text-muted mb-2">Receivables (Open)</p>
                <p className="h6 fw-semibold mb-2">
                  {kpiQuery.isLoading
                    ? 'กำลังโหลด...'
                    : kpiQuery.isError
                      ? '—'
                      : kpiQuery.data?.receivables.openTotal.toLocaleString('th-TH', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                </p>
                <p className="small text-muted mb-0">
                  {kpiQuery.data
                    ? `${kpiQuery.data.receivables.openCount} ใบ`
                    : 'ยอดค้างชำระ'}
                </p>
              </Card>
            </div>
            <div className="col-md-6 col-xl-3">
              <Card>
                <p className="small fw-medium text-muted mb-2">Overdue</p>
                <p className="h6 fw-semibold mb-2">
                  {kpiQuery.isLoading
                    ? 'กำลังโหลด...'
                    : kpiQuery.isError
                      ? '—'
                      : kpiQuery.data?.receivables.overdueTotal.toLocaleString('th-TH', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                </p>
                <p className="small text-muted mb-0">
                  {kpiQuery.data
                    ? `${kpiQuery.data.receivables.overdueCount} ใบ`
                    : 'เกินกำหนด'}
                </p>
              </Card>
            </div>
            {/* Payment status cards - use API data if available, otherwise calculate from invoices */}
            {(kpiQuery.data?.payments || paymentStats) && (
              <>
                <div className="col-md-6 col-xl-3">
                  <Card>
                    <p className="small fw-medium text-muted mb-2">ชำระครบแล้ว</p>
                    <p className="h6 fw-semibold mb-2 text-success">
                      {kpiQuery.isLoading || invoicesQuery.isLoading
                        ? 'กำลังโหลด...'
                        : kpiQuery.isError && invoicesQuery.isError
                          ? '—'
                          : (kpiQuery.data?.payments?.paidTotal ?? paymentStats?.paidTotal ?? 0).toLocaleString('th-TH', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                    </p>
                    <p className="small text-muted mb-0">
                      {kpiQuery.data?.payments?.paidCount ?? paymentStats?.paidCount ?? 0} ใบ
                    </p>
                  </Card>
                </div>
                {((kpiQuery.data?.payments?.partialCount ?? paymentStats?.partialCount ?? 0) > 0) && (
                  <div className="col-md-6 col-xl-3">
                    <Card>
                      <p className="small fw-medium text-muted mb-2">ชำระบางส่วน</p>
                      <p className="h6 fw-semibold mb-2 text-warning">
                        {(kpiQuery.data?.payments?.partialTotal ?? paymentStats?.partialTotal ?? 0).toLocaleString('th-TH', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                      <p className="small text-muted mb-0">
                        {kpiQuery.data?.payments?.partialCount ?? paymentStats?.partialCount ?? 0} ใบ
                      </p>
                    </Card>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {cardVisibility.invoices && <div className="col-md-6 col-xl-3">
          <Card
            onClick={() => navigate('/sales/invoices')}
            role="button"
            tabIndex={0}
            className="qf-dashboard-card qf-dashboard-card-invoices h-100"
          >
            <div className="d-flex align-items-center justify-content-between mb-2">
              <p className="small fw-medium text-muted mb-0">Invoices</p>
              <i className="bi bi-receipt text-primary" style={{ fontSize: '1.5rem' }}></i>
            </div>
            <p className="h6 fw-semibold mb-2">
              ไปจัดการใบแจ้งหนี้
            </p>
            <p className="small text-muted mb-0">
              สร้าง/แก้ไข/โพสต์ใบแจ้งหนี้
            </p>
          </Card>
        </div>}
        {cardVisibility.products && <div className="col-md-6 col-xl-3">
          <Card
            onClick={() => navigate('/products')}
            role="button"
            tabIndex={0}
            className="qf-dashboard-card h-100"
          >
            <div className="d-flex align-items-center justify-content-between mb-2">
              <p className="small fw-medium text-muted mb-0">Products</p>
              <i className="bi bi-box-seam" style={{ fontSize: '1.5rem', color: '#0ea5e9' }}></i>
            </div>
            <p className="h6 fw-semibold mb-2">
              {productsQuery.isLoading
                ? 'กำลังโหลด...'
                : productsQuery.isError
                  ? '—'
                  : `${productsQuery.data?.total ?? productsQuery.data?.items.length ?? 0} รายการ`}
            </p>
            <p className="small text-muted mb-0">
              จัดการสินค้าและบริการ
            </p>
          </Card>
        </div>}
        {cardVisibility.quotations && <div className="col-md-6 col-xl-3">
          <Card
            onClick={() => navigate('/sales/orders?type=quotation')}
            role="button"
            tabIndex={0}
            className="qf-dashboard-card h-100"
          >
            <div className="d-flex align-items-center justify-content-between mb-2">
              <p className="small fw-medium text-muted mb-0">Quotations</p>
              <i className="bi bi-file-earmark-text" style={{ fontSize: '1.5rem', color: '#0ea5e9' }}></i>
            </div>
            <p className="h6 fw-semibold mb-2">
              จัดการใบเสนอราคา
            </p>
            <p className="small text-muted mb-0">
              สร้าง/ติดตามใบเสนอราคา
            </p>
          </Card>
        </div>}
        {cardVisibility.salesOrders && <div className="col-md-6 col-xl-3">
          <Card
            onClick={() => navigate('/sales/orders?type=sale')}
            role="button"
            tabIndex={0}
            className="qf-dashboard-card h-100"
          >
            <div className="d-flex align-items-center justify-content-between mb-2">
              <p className="small fw-medium text-muted mb-0">Sale Orders</p>
              <i className="bi bi-cart-check" style={{ fontSize: '1.5rem', color: '#16a34a' }}></i>
            </div>
            <p className="h6 fw-semibold mb-2">
              จัดการ Sale Order
            </p>
            <p className="small text-muted mb-0">
              ยืนยันและติดตามคำสั่งขาย
            </p>
          </Card>
        </div>}
        {cardVisibility.accounting && <div className="col-md-6 col-xl-3">
          <Card
            onClick={() => navigate('/accounting/reports')}
            role="button"
            tabIndex={0}
            className="qf-dashboard-card qf-dashboard-card-accounting h-100"
          >
            <div className="d-flex align-items-center justify-content-between mb-2">
              <p className="small fw-medium text-muted mb-0">รายงานบัญชี</p>
              <i className="bi bi-graph-up-arrow" style={{ fontSize: '1.5rem', color: '#06b6d4' }}></i>
            </div>
            <p className="h6 fw-semibold mb-2">
              ศูนย์รวมรายงาน
            </p>
            <p className="small text-muted mb-0">
              งบการเงิน · เล่มบัญชี · ภาษี (คลิกเพื่อดูรายงาน)
            </p>
          </Card>
        </div>}
        {cardVisibility.purchaseOrders && <div className="col-md-6 col-xl-3">
          <Card
            onClick={() => navigate('/purchases/orders')}
            role="button"
            tabIndex={0}
            className="qf-dashboard-card qf-dashboard-card-purchases h-100"
          >
            <div className="d-flex align-items-center justify-content-between mb-2">
              <p className="small fw-medium text-muted mb-0">Purchase Orders</p>
              <i className="bi bi-cart text-success" style={{ fontSize: '1.5rem' }}></i>
            </div>
            <p className="h6 fw-semibold mb-2">
              {purchaseOrdersQuery.isLoading
                ? 'กำลังโหลด...'
                : purchaseOrdersQuery.isError
                  ? '—'
                  : purchaseStats
                    ? `${purchaseStats.doneCount + purchaseStats.purchaseCount} ใบ`
                    : '0 ใบ'}
            </p>
            <p className="small text-muted mb-0">
              {purchaseStats
                ? `มูลค่า ${purchaseStats.totalValue.toLocaleString('th-TH', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`
                : 'จัดการใบสั่งซื้อ'}
            </p>
          </Card>
        </div>}
        {cardVisibility.purchaseRequests && <div className="col-md-6 col-xl-3">
          <Card
            onClick={() => navigate('/purchases/requests')}
            role="button"
            tabIndex={0}
            className="qf-dashboard-card qf-dashboard-card-requests h-100"
          >
            <div className="d-flex align-items-center justify-content-between mb-2">
              <p className="small fw-medium text-muted mb-0">Purchase Requests</p>
              <i className="bi bi-clipboard-check" style={{ fontSize: '1.5rem', color: '#ec4899' }}></i>
            </div>
            <p className="h6 fw-semibold mb-2">
              {purchaseRequestsQuery.isLoading
                ? 'กำลังโหลด...'
                : purchaseRequestsQuery.isError
                  ? '—'
                  : purchaseRequestStats
                    ? `${purchaseRequestStats.totalCount} รายการ`
                    : '0 รายการ'}
            </p>
            <p className="small text-muted mb-0">
              {purchaseRequestStats
                ? `มูลค่า ${purchaseRequestStats.totalValue.toLocaleString('th-TH', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`
                : 'จัดการคำขอซื้อ'}
            </p>
          </Card>
        </div>}
        {cardVisibility.ai && <div className="col-md-6 col-xl-3">
          <Card
            onClick={() => navigate('/agent')}
            role="button"
            tabIndex={0}
            className="qf-dashboard-card qf-dashboard-card-ai h-100"
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              cursor: 'pointer',
            }}
          >
            <div className="d-flex align-items-center justify-content-between mb-2">
              <p className="small fw-medium mb-0" style={{ opacity: 0.9 }}>
                ERPTH AI
              </p>
              <div className="d-flex align-items-center gap-2">
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
                <i
                  className="bi bi-magic"
                  style={{ fontSize: '1.5rem', color: 'white' }}
                ></i>
              </div>
            </div>
            <p className="h6 fw-semibold mb-2" style={{ color: 'white' }}>
              สร้างด้วย AI
            </p>
            <p className="small mb-2" style={{ opacity: 0.95 }}>
              ภาษา Assistant: {assistantLang === 'th_TH' ? 'ไทย (ค่าเริ่มต้น)' : 'English'}
            </p>
            <div className="small" style={{ opacity: 0.95 }}>
              {aiTasksQuery.isLoading ? (
                <div>กำลังโหลด task...</div>
              ) : aiTasksQuery.isError ? (
                <div>โหลด task ไม่สำเร็จ</div>
              ) : (aiTasksQuery.data || []).length === 0 ? (
                <div>ยังไม่มี task</div>
              ) : (
                <div className="d-flex flex-column gap-1">
                  {(aiTasksQuery.data || []).slice(0, 3).map((task) => {
                    const meta = statusMeta(task.status)
                    return (
                      <div
                        key={task.session_id}
                        className="rounded p-2"
                        style={{ background: 'rgba(255,255,255,0.16)' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="fw-semibold text-truncate" title={task.title}>
                          {task.title}
                        </div>
                        <div className="d-flex align-items-center justify-content-between mt-1">
                          <span className={`badge ${meta.cls}`}>{meta.label}</span>
                          <button
                            type="button"
                            className="btn btn-link btn-sm p-0 text-white text-decoration-underline"
                            onClick={() => navigate(task.source?.route || '/agent')}
                          >
                            {task.source?.label || 'Source'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </Card>
        </div>}
        {cardVisibility.excel && <div className="col-md-6 col-xl-3">
          <Card
            onClick={() => navigate('/excel-import')}
            role="button"
            tabIndex={0}
            className="qf-dashboard-card qf-dashboard-card-excel h-100"
          >
            <div className="d-flex align-items-center justify-content-between mb-2">
              <p className="small fw-medium text-muted mb-0">Excel Import</p>
              <i className="bi bi-file-earmark-spreadsheet text-warning" style={{ fontSize: '1.5rem' }}></i>
            </div>
            <p className="h6 fw-semibold mb-2">
              นำเข้าข้อมูลจาก Excel
            </p>
            <p className="small text-muted mb-0">
              อัปโหลด .xlsx เพื่อสร้างข้อมูล
            </p>
          </Card>
        </div>}
        {cardVisibility.backend && <div className="col-md-6 col-xl-3">
          <Card
            onClick={() => navigate('/backend-connection')}
            role="button"
            tabIndex={0}
            className="qf-dashboard-card qf-dashboard-card-backend h-100"
          >
            <div className="d-flex align-items-center justify-content-between mb-2">
              <p className="small fw-medium text-muted mb-0">Backend</p>
              <i className="bi bi-plug text-purple" style={{ fontSize: '1.5rem', color: '#8b5cf6' }}></i>
            </div>
            <p className="h6 fw-semibold mb-2">
              ตั้งค่า/Provisioning
            </p>
            <p className="small text-muted mb-0">
              สร้างบริษัทและ admin ใหม่
            </p>
          </Card>
        </div>}
        {cardVisibility.connection && <div className="col-md-6 col-xl-3">
          <Card className="h-100">
            <p className="small fw-medium text-muted mb-2">Connection</p>
            <p className="h6 fw-semibold mb-2">
              {pingQuery.isLoading
                ? 'กำลังตรวจสอบ...'
                : pingQuery.isError
                  ? 'เชื่อมต่อไม่ได้'
                  : pingQuery.data?.pong
                    ? 'เชื่อมต่อได้ (pong)'
                    : 'ไม่ทราบสถานะ'}
            </p>
            <p className="small text-muted mb-0">
              Instance ID: {instancePublicId ?? '—'}
            </p>
          </Card>
        </div>}
      </div>

      <div className="row g-4 mt-4">
        <div className="col-12">
          <Card className="p-3">
            <div className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-2 mb-3">
              <div>
                <div className="h6 fw-semibold mb-1">สรุปบัญชี (เดือนนี้)</div>
                <div className="small text-muted">
                  ช่วงวันที่ {accFilterFrom} ถึง {accFilterTo}
                  {!canSeeReports && (
                    <span className="ms-2">
                      (ถ้าเรียกไม่ได้ ให้เปิด scope: <code>reports</code>)
                    </span>
                  )}
                </div>
              </div>
              <div className="d-flex gap-2 flex-wrap">
                <div className="d-flex gap-2 align-items-center flex-wrap">
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    style={{ width: 150 }}
                    value={accDateFrom}
                    onChange={(e) => setAccDateFrom(e.target.value)}
                  />
                  <span className="small text-muted">ถึง</span>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    style={{ width: 150 }}
                    value={accDateTo}
                    onChange={(e) => setAccDateTo(e.target.value)}
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={applyAccountingRange}
                    disabled={
                      !accDateFrom ||
                      !accDateTo ||
                      new Date(accDateFrom).getTime() > new Date(accDateTo).getTime()
                    }
                  >
                    ใช้ช่วงวันที่
                  </Button>
                  <Button size="sm" variant="ghost" onClick={resetAccountingRange}>
                    เดือนนี้
                  </Button>
                </div>
                <Button size="sm" variant="secondary" onClick={() => navigate('/accounting/reports')}>
                  ไปหน้ารายงานบัญชี
                </Button>
              </div>
            </div>

            {profitLossQuery.isError ? (
              <div className="alert alert-danger mb-0">
                <div className="fw-semibold">โหลดสรุปบัญชีไม่สำเร็จ</div>
                <div className="small">
                  {profitLossQuery.error instanceof Error ? profitLossQuery.error.message : 'Unknown error'}
                </div>
              </div>
            ) : (
              <div className="row g-3">
                <div className="col-12">
                  <div className="row g-2">
                    <div className="col-12 col-md-4">
                      <div
                        className="rounded bg-light p-3 h-100 qf-clickable-metric qf-clickable-metric--income"
                        role="button"
                        tabIndex={0}
                        aria-label="เปิดรายละเอียดรายได้"
                        onClick={() => goToProfitLossDetail('income')}
                        onKeyDown={(e) => onMetricCardKeyDown(e, 'income')}
                      >
                        <div className="small text-muted">รายได้รวม</div>
                        <div className="h4 fw-semibold mb-0 font-monospace">
                          {accountingSnapshot.income.toLocaleString('th-TH')}
                        </div>
                        <div className="qf-clickable-metric__hint">
                          คลิกเพื่อดูรายละเอียด
                          <i className="bi bi-arrow-right-short ms-1" />
                        </div>
                      </div>
                    </div>
                    <div className="col-12 col-md-4">
                      <div
                        className="rounded bg-light p-3 h-100 qf-clickable-metric qf-clickable-metric--expense"
                        role="button"
                        tabIndex={0}
                        aria-label="เปิดรายละเอียดรายจ่าย"
                        onClick={() => goToProfitLossDetail('expense')}
                        onKeyDown={(e) => onMetricCardKeyDown(e, 'expense')}
                      >
                        <div className="small text-muted">รายจ่ายรวม</div>
                        <div className="h4 fw-semibold mb-0 font-monospace">
                          {accountingSnapshot.expense.toLocaleString('th-TH')}
                        </div>
                        <div className="qf-clickable-metric__hint">
                          คลิกเพื่อดูรายละเอียด
                          <i className="bi bi-arrow-right-short ms-1" />
                        </div>
                      </div>
                    </div>
                    <div className="col-12 col-md-4">
                      <div
                        className={`rounded p-3 h-100 qf-profit-metric ${
                          accountingSnapshot.profit >= 0 ? 'qf-profit-metric--gain' : 'qf-profit-metric--loss'
                        }`}
                      >
                        <div className="small text-muted">กำไรสุทธิ</div>
                        <div className="h4 fw-semibold mb-0 font-monospace">
                          {accountingSnapshot.profit.toLocaleString('th-TH')}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-12">
                  <div className="rounded bg-light p-3">
                    <div className="small text-muted mb-2">กราฟสรุป</div>
                    <div style={{ height: 280 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={accountingChartData} margin={{ top: 12, right: 20, left: 8, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" tick={{ fontSize: 13 }} />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Bar dataKey="value" radius={[8, 8, 0, 0]} isAnimationActive={false} barSize={72}>
                            {accountingChartData.map((d, idx) => (
                              <Cell key={idx} fill={d.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
        <div className="col-12">
          <Card>
            <p className="h6 fw-semibold mb-2">
              Next: KPI จริงจาก Odoo
            </p>
            <p className="small text-muted mb-0">
              ตอนนี้ยังไม่มี endpoint KPI/แดชบอร์ดใน addon แต่ระบบ auth + instance
              ทำงานแล้ว (เริ่มดึง sales/invoices ต่อได้เลย)
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}

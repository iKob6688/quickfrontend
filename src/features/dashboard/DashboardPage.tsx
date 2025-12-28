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
import { hasScope } from '@/lib/scopes'
import { useMemo } from 'react'

export function DashboardPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const instancePublicId = useAuthStore((s) => s.instancePublicId)
  const canSeeKpis = hasScope('dashboard')

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
          </div>
        }
      />

      <div className="row g-4">
        {canSeeKpis && (
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

        <div className="col-md-6 col-xl-3">
          <Card
            onClick={() => navigate('/sales/invoices')}
            role="button"
            tabIndex={0}
            className="qf-dashboard-card qf-dashboard-card-invoices"
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
        </div>
        <div className="col-md-6 col-xl-3">
          <Card
            onClick={() => navigate('/accounting/overview')}
            role="button"
            tabIndex={0}
            className="qf-dashboard-card qf-dashboard-card-accounting"
          >
            <div className="d-flex align-items-center justify-content-between mb-2">
              <p className="small fw-medium text-muted mb-0">Accounting</p>
              <i className="bi bi-graph-up-arrow" style={{ fontSize: '1.5rem', color: '#06b6d4' }}></i>
            </div>
            <p className="h6 fw-semibold mb-2">
              ภาพรวมบัญชี (เดือนนี้)
            </p>
            <p className="small text-muted mb-0">
              รายได้ · ค่าใช้จ่าย · กำไร (คลิกเพื่อ drilldown)
            </p>
          </Card>
        </div>
        <div className="col-md-6 col-xl-3">
          <Card
            onClick={() => navigate('/purchases/orders')}
            role="button"
            tabIndex={0}
            className="qf-dashboard-card qf-dashboard-card-purchases"
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
        </div>
        <div className="col-md-6 col-xl-3">
          <Card
            onClick={() => navigate('/purchases/requests')}
            role="button"
            tabIndex={0}
            className="qf-dashboard-card qf-dashboard-card-requests"
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
        </div>
        <div className="col-md-6 col-xl-3">
          <Card
            onClick={() => navigate('/excel-import')}
            role="button"
            tabIndex={0}
            className="qf-dashboard-card qf-dashboard-card-excel"
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
        </div>
        <div className="col-md-6 col-xl-3">
          <Card
            onClick={() => navigate('/backend-connection')}
            role="button"
            tabIndex={0}
            className="qf-dashboard-card qf-dashboard-card-backend"
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
        </div>
        <div className="col-md-6 col-xl-3">
          <Card>
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
        </div>
      </div>

      <div className="row g-4 mt-4">
        <div className="col-lg-8">
          <Card>
            <p className="h6 fw-semibold mb-3">ผู้ใช้งานปัจจุบัน</p>
            <div className="row g-2">
              <div className="col-sm-6">
                <div className="rounded bg-light p-3">
                  <p className="small fw-medium text-muted mb-1">
                    ชื่อ
                  </p>
                  <p className="fw-semibold mb-0">{user?.name ?? '—'}</p>
                </div>
              </div>
              <div className="col-sm-6">
                <div className="rounded bg-light p-3">
                  <p className="small fw-medium text-muted mb-1">
                    Login
                  </p>
                  <p className="fw-semibold mb-0 font-monospace">{user?.login ?? '—'}</p>
                </div>
              </div>
              <div className="col-sm-6">
                <div className="rounded bg-light p-3">
                  <p className="small fw-medium text-muted mb-1">
                    Company
                  </p>
                  <p className="fw-semibold mb-0">{user?.companyName ?? '—'}</p>
                </div>
              </div>
              <div className="col-sm-6">
                <div className="rounded bg-light p-3">
                  <p className="small fw-medium text-muted mb-1">
                    Companies
                  </p>
                  <p className="fw-semibold mb-0 font-monospace">
                    {user?.companies?.length ?? 0}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
        <div className="col-lg-4">
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



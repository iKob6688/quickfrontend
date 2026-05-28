import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { AppLogo } from '@/components/icons/AppLogo'
import { Button } from '@/components/ui/Button'
import { PageContainer } from '@/components/layout/PageContainer'
import { useAuthStore } from '@/features/auth/store'
import { hasScope } from '@/lib/scopes'
import { ConfigBanner } from '@/components/system/ConfigBanner'
import { AvatarAssistant } from '@/features/assistant/AvatarAssistant'
import { listApprovalTasks } from '@/api/services/approval.service'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { getThemeMode, setThemeMode, type ThemeMode } from '@/lib/themeMode'

type NavItem = { path: string; label: string; scope?: string }

export function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const logout = useAuthStore((s) => s.logout)
  const switchCompany = useAuthStore((s) => s.switchCompany)
  const isSwitchingCompany = useAuthStore((s) => s.isSwitchingCompany)
  const user = useAuthStore((s) => s.user)
  const isWide =
    location.pathname.startsWith('/reports-studio/editor') ||
    location.pathname.startsWith('/reports-studio/preview')
  const hideMobileNav =
    /\/sales\/orders\/new(?:\/)?$/.test(location.pathname) ||
    /\/sales\/orders\/\d+\/edit(?:\/)?$/.test(location.pathname) ||
    /\/sales\/invoices\/new(?:\/)?$/.test(location.pathname) ||
    /\/sales\/invoices\/\d+\/edit(?:\/)?$/.test(location.pathname) ||
    /\/purchases\/orders\/new(?:\/)?$/.test(location.pathname) ||
    /\/purchases\/orders\/\d+\/edit(?:\/)?$/.test(location.pathname)

  const approvalTasksQuery = useQuery({
    queryKey: ['approvalTasks', 'nav'],
    queryFn: () => listApprovalTasks(20),
    staleTime: 20_000,
  })
  const approvalBadgeCount = approvalTasksQuery.data?.pendingCount ?? 0
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => getThemeMode())

  const restrictedScopeTitle = (scope?: string) =>
    scope
      ? `สิทธิ์ของคุณยังไม่ครอบคลุมเมนูนี้ ต้องเปิดสิทธิ์ ${scope} ก่อน เมนูจะพยายามเปิดตามสิทธิ์ที่ backend อนุญาต`
      : undefined

  // Scope gating (prod-grade): only hide items that would 403 consistently.
  // Dashboard stays visible even if KPI scope is missing; page will degrade gracefully.
  const navItems: Array<
    NavItem & {
      icon: string
      mobileLabel?: string
    }
  > = [
    { path: '/dashboard', label: 'แดชบอร์ด', icon: 'bi-speedometer2' },
    { path: '/sales/orders', label: 'ใบเสนอราคา/SO', scope: 'invoice', icon: 'bi-file-earmark-text' },
    { path: '/sales/invoices', label: 'ใบแจ้งหนี้', scope: 'invoice', icon: 'bi-receipt' },
    { path: '/sales/receipts', label: 'ใบเสร็จรับเงิน', scope: 'invoice', icon: 'bi-receipt-cutoff' },
    { path: '/notes', label: 'ใบเพิ่ม/ลดหนี้', scope: 'invoice', icon: 'bi-journal-minus' },
    { path: '/purchases/orders', label: 'ใบสั่งซื้อ', scope: 'purchase', icon: 'bi-cart' },
    { path: '/purchases/requests', label: 'คำขอซื้อ', scope: 'purchase', icon: 'bi-clipboard-check' },
    { path: '/expenses', label: 'รายจ่าย', scope: 'expense', icon: 'bi-cash-stack' },
    { path: '/accounting/document-review', label: 'กล่องงานตรวจสอบ', scope: 'accounting_reports', icon: 'bi-inboxes' },
    { path: '/accounting/reports', label: 'รายงานบัญชี', scope: 'accounting_reports', icon: 'bi-graph-up-arrow' },
    { path: '/accounting/etax', label: 'เอกสาร e-Tax', scope: 'etax', icon: 'bi-receipt-cutoff' },
    { path: '/accounting/tax-settings', label: 'ตั้งค่า VAT/ภาษี', scope: 'accounting_reports', icon: 'bi-percent' },
    { path: '/customers', label: 'รายชื่อติดต่อ', scope: 'contacts', icon: 'bi-people' },
    { path: '/products', label: 'สินค้า/บริการ', scope: 'products', icon: 'bi-box-seam' },
    { path: '/excel-import', label: 'นำเข้า Excel', scope: 'excel', icon: 'bi-file-earmark-spreadsheet' },
    { path: '/reports-studio', label: 'สตูดิโอรายงาน', mobileLabel: 'สตูดิโอ\nรายงาน', icon: 'bi-layout-text-window-reverse' },
    // Provisioning is an admin/dev feature; keep behind auth scope.
    { path: '/backend-connection', label: 'ตั้งค่าการเชื่อมต่อ', scope: 'auth', icon: 'bi-plug' },
  ]

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const toggleThemeMode = () => {
    const nextMode: ThemeMode = themeMode === 'light' ? 'dark' : 'light'
    setThemeMode(nextMode)
    setThemeModeState(nextMode)
  }

  const canSwitchCompany = Boolean(user && user.companies && user.companies.length > 1)

  return (
    <div className={`d-flex flex-column min-vh-100 ${hideMobileNav ? 'qf-layout--mobile-form' : ''}`}>
      {/* PEAK-like Top Gradient Header */}
      <header className={`sticky-top ${hideMobileNav ? 'qf-header--mobile-form' : ''}`} style={{ zIndex: 1030 }}>
        <div className="text-white" style={{
          background: 'linear-gradient(90deg, #5B6CFF 0%, #3C9BEF 45%, #18D2C0 100%)',
          boxShadow: '0 14px 28px rgba(15, 23, 42, 0.10)'
        }}>
          <div className="container-fluid px-4 py-3">
            <div className="d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="btn btn-link p-0 text-white text-decoration-none"
                >
                  <AppLogo size="sm" tone="light" />
                </button>
                <div className="d-none d-sm-block">
                  <p className="small fw-semibold mb-0 text-truncate" style={{ maxWidth: '200px' }}>
                    {user?.companyName ?? 'Odoo 18'}
                  </p>
                  <p className="small mb-0 text-truncate" style={{ maxWidth: '200px', fontSize: '0.6875rem' }}>
                    ระบบงานบัญชีสำหรับธุรกิจไทย
                  </p>
                </div>
                {canSwitchCompany ? (
                  <div className="d-none d-md-block">
                    <select
                      className="form-select form-select-sm bg-white bg-opacity-90"
                      style={{ minWidth: '240px' }}
                      value={String(user?.companyId ?? '')}
                      onChange={(e) => {
                        const nextCompanyId = Number(e.target.value)
                        if (!Number.isFinite(nextCompanyId) || !user || nextCompanyId === user.companyId) return
                        void switchCompany(nextCompanyId)
                      }}
                      disabled={isSwitchingCompany}
                      aria-label="เลือกบริษัทที่ต้องการใช้งาน"
                    >
                      {user?.companies.map((company) => (
                        <option key={company.id} value={company.id}>
                          {company.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>
              <div className="d-flex align-items-center gap-2">
                <button
                  type="button"
                  onClick={toggleThemeMode}
                  className="btn btn-sm btn-link text-white text-decoration-none border border-white border-opacity-25 qf-theme-toggle"
                  title={themeMode === 'light' ? 'สลับเป็นโหมดมืด' : 'สลับเป็นโหมดสว่าง'}
                  aria-label={themeMode === 'light' ? 'สลับเป็นโหมดมืด' : 'สลับเป็นโหมดสว่าง'}
                >
                  <span className="d-inline-flex align-items-center gap-2">
                    <i className={`bi ${themeMode === 'light' ? 'bi-moon-stars' : 'bi-sun'}`} aria-hidden="true" />
                    <span className="d-none d-sm-inline">{themeMode === 'light' ? 'โหมดมืด' : 'โหมดสว่าง'}</span>
                  </span>
                </button>
                <span className="badge bg-white bg-opacity-15 d-none d-sm-inline">
                  TH
                </span>
                {user && (
                  <span className="small fw-semibold d-none d-sm-inline">
                    {user.name}
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="text-white"
                >
                  ออกจากระบบ
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Tab navigation (desktop) */}
        <div className="d-none d-sm-block border-bottom qf-top-nav-surface" style={{ backdropFilter: 'blur(12px)' }}>
          <div className="container-fluid px-4 py-2">
            <nav className="d-flex gap-1">
              {navItems.map((item) => {
                const allowed = !item.scope || hasScope(item.scope)
                const active = location.pathname.startsWith(item.path)
                
                // Debug: Log scope checking in development
                if (import.meta.env.DEV && item.scope) {
                  const allowedScopes = typeof window !== 'undefined' ? window.localStorage.getItem('qf18_allowed_scopes') : null
                  console.debug(`[AppLayout] Nav item "${item.label}": scope="${item.scope}", allowed=${allowed}`, {
                    path: item.path,
                    hasScope: allowed,
                    runtimeAllowedScopes: allowedScopes,
                  })
                }
                
                return (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => {
                      if (allowed) {
                        navigate(item.path)
                      } else {
                        const message = `Navigation blocked for "${item.label}": scope "${item.scope}" not allowed by backend runtime scopes`
                        console.warn(`[AppLayout] ${message}`)
                        // Still allow navigation - backend will enforce scopes
                        // This prevents UI from being completely blocked
                        navigate(item.path)
                      }
                    }}
                    className={`btn btn-sm rounded qf-top-nav-btn ${
                      active
                        ? 'btn-primary qf-top-nav-btn--active'
                        : allowed
                          ? 'btn-outline-secondary qf-top-nav-btn--idle'
                          : 'btn-outline-secondary qf-top-nav-btn--idle opacity-50'
                    }`}
                    title={
                      !allowed && item.scope
                        ? restrictedScopeTitle(item.scope)
                        : undefined
                    }
                  >
                    <span className="d-inline-flex align-items-center gap-2">
                      <span>{item.label}</span>
                      {item.path === '/accounting/document-review' && approvalBadgeCount > 0 ? (
                        <span className="badge rounded-pill bg-danger">{approvalBadgeCount}</span>
                      ) : null}
                    </span>
                  </button>
                )
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* Main content */}
      <PageContainer className={`flex-1 qf-content ${hideMobileNav ? 'qf-content--mobile-form' : ''}`} fluid={isWide}>
        <main className="min-w-0 flex-1">
          <ConfigBanner />
          <Outlet />
        </main>
      </PageContainer>

      {/* Bottom nav for mobile */}
      {!hideMobileNav ? (
        <nav
          className="qf-mobile-nav fixed-bottom d-sm-none border-top"
          style={{
            zIndex: 1020,
            backdropFilter: 'blur(12px)',
          }}
        >
          <div className="qf-mobile-nav__inner container-fluid">
            {navItems.map((item) => {
              const allowed = !item.scope || hasScope(item.scope)
              const active = location.pathname.startsWith(item.path)
              
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => {
                    if (allowed) {
                      navigate(item.path)
                    } else {
                      const message = `Navigation blocked for "${item.label}": scope "${item.scope}" not allowed by backend runtime scopes`
                      console.warn(`[AppLayout] ${message}`)
                      // Still allow navigation - backend will enforce scopes
                      // This prevents UI from being completely blocked
                      navigate(item.path)
                    }
                  }}
                  className={`qf-mobile-nav__item ${active ? 'is-active' : ''} ${!allowed ? 'opacity-50' : ''}`}
                  title={!allowed && item.scope ? restrictedScopeTitle(item.scope) : undefined}
                >
                  <i className={`bi ${item.icon} qf-mobile-nav__icon`} aria-hidden="true" />
                  <span className="qf-mobile-nav__label">
                    {item.mobileLabel ?? item.label}
                    {item.path === '/accounting/document-review' && approvalBadgeCount > 0 ? (
                      <span className="badge rounded-pill bg-danger ms-1">{approvalBadgeCount}</span>
                    ) : null}
                  </span>
                </button>
              )
            })}
          </div>
        </nav>
      ) : null}
      <AvatarAssistant />
    </div>
  )
}

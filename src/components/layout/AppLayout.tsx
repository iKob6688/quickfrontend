import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { AppLogo } from '@/components/icons/AppLogo'
import { Button } from '@/components/ui/Button'
import { PageContainer } from '@/components/layout/PageContainer'
import { useAuthStore } from '@/features/auth/store'
import { hasScope } from '@/lib/scopes'
import { ConfigBanner } from '@/components/system/ConfigBanner'

type NavItem = { path: string; label: string; scope?: string }

export function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const logout = useAuthStore((s) => s.logout)
  const user = useAuthStore((s) => s.user)
  const isWide =
    location.pathname.startsWith('/reports-studio/editor') ||
    location.pathname.startsWith('/reports-studio/preview')

  // Scope gating (prod-grade): only hide items that would 403 consistently.
  // Dashboard stays visible even if KPI scope is missing; page will degrade gracefully.
  const navItems: NavItem[] = [
    { path: '/dashboard', label: 'แดชบอร์ด' },
    { path: '/customers', label: 'ลูกค้า', scope: 'contacts' },
    { path: '/sales/invoices', label: 'ใบแจ้งหนี้', scope: 'invoice' },
    { path: '/excel-import', label: 'Excel', scope: 'excel' },
    { path: '/reports-studio', label: 'Reports Studio' },
    // Provisioning is an admin/dev feature; keep behind auth scope.
    { path: '/backend-connection', label: 'การเชื่อมต่อ', scope: 'auth' },
  ]

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="d-flex flex-column min-vh-100">
      {/* PEAK-like Top Gradient Header */}
      <header className="sticky-top" style={{ zIndex: 1030 }}>
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
                    Thai SME Accounting
                  </p>
                </div>
              </div>
              <div className="d-flex align-items-center gap-2">
                <span className="badge bg-white bg-opacity-15 d-none d-sm-inline">
                  EN
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
        <div className="d-none d-sm-block border-bottom bg-white bg-opacity-85" style={{ backdropFilter: 'blur(12px)' }}>
          <div className="container-fluid px-4 py-2">
            <nav className="d-flex gap-1">
              {navItems.map((item) => {
                const allowed = !item.scope || hasScope(item.scope)
                const active = location.pathname.startsWith(item.path)
                return (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => allowed && navigate(item.path)}
                    disabled={!allowed}
                    className={`btn btn-sm rounded ${
                      active
                        ? 'btn-primary'
                        : 'btn-outline-secondary'
                    }`}
                    title={
                      !allowed && item.scope
                        ? `ต้องเปิด scope: ${item.scope}`
                        : undefined
                    }
                  >
                    {item.label}
                  </button>
                )
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* Main content */}
      <PageContainer className="flex-1" fluid={isWide}>
        <main className="min-w-0 flex-1">
          <ConfigBanner />
          <Outlet />
        </main>
      </PageContainer>

      {/* Bottom nav for mobile */}
      <nav className="fixed-bottom d-sm-none border-top bg-white bg-opacity-92" style={{ 
        zIndex: 1020,
        backdropFilter: 'blur(12px)'
      }}>
        <div className="container-fluid px-2 py-2">
          <div className="d-flex align-items-center justify-content-around">
            {navItems.map((item) => {
              const allowed = !item.scope || hasScope(item.scope)
              const active = location.pathname.startsWith(item.path)
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => allowed && navigate(item.path)}
                  disabled={!allowed}
                  className={`btn btn-sm flex-fill d-flex flex-column align-items-center rounded ${
                    active
                      ? 'btn-primary'
                      : 'btn-outline-secondary'
                  }`}
                  style={{ fontSize: '0.6875rem' }}
                  title={
                    !allowed && item.scope
                      ? `ต้องเปิด scope: ${item.scope}`
                      : undefined
                  }
                >
                  <span>{item.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </nav>
    </div>
  )
}



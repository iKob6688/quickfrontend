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
import { useEffect, useMemo, useState } from 'react'
import { getThemeMode, setThemeMode, type ThemeMode } from '@/lib/themeMode'
import { toast } from '@/lib/toastStore'

type NavItem = {
  path: string
  label: string
  scope?: string
  icon: string
  mobileLabel?: string
  showOnMobile?: boolean
}

type SidebarItem = {
  path: string
  label: string
  icon: string
  active: boolean
  scope?: string
  children?: Array<Pick<NavItem, 'path' | 'label' | 'scope'>>
}

export function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const logout = useAuthStore((s) => s.logout)
  const switchCompany = useAuthStore((s) => s.switchCompany)
  const isSwitchingCompany = useAuthStore((s) => s.isSwitchingCompany)
  const instancePublicId = useAuthStore((s) => s.instancePublicId)
  const user = useAuthStore((s) => s.user)
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
  const [showAssistantWidget, setShowAssistantWidget] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    return window.innerWidth >= 768
  })
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const restrictedScopeTitle = (scope?: string) =>
    scope
      ? `สิทธิ์ของคุณยังไม่ครอบคลุมเมนูนี้ ต้องเปิดสิทธิ์ ${scope} ก่อน เมนูจะพยายามเปิดตามสิทธิ์ที่ backend อนุญาต`
      : undefined

  const navItems: NavItem[] = [
    { path: '/dashboard', label: 'แดชบอร์ด', mobileLabel: 'หน้าหลัก', icon: 'bi-speedometer2', showOnMobile: true },
    { path: '/sales/orders', label: 'ใบเสนอราคา/SO', mobileLabel: 'ใบเสนอ', scope: 'invoice', icon: 'bi-file-earmark-text', showOnMobile: true },
    { path: '/sales/invoices', label: 'ใบแจ้งหนี้', mobileLabel: 'ใบแจ้งหนี้', scope: 'invoice', icon: 'bi-receipt', showOnMobile: true },
    { path: '/sales/receipts', label: 'ใบเสร็จรับเงิน', mobileLabel: 'ใบเสร็จ', scope: 'invoice', icon: 'bi-receipt-cutoff', showOnMobile: true },
    { path: '/notes', label: 'ใบเพิ่ม/ลดหนี้', scope: 'invoice', icon: 'bi-journal-minus' },
    { path: '/purchases/orders', label: 'ใบสั่งซื้อ', scope: 'purchase', icon: 'bi-cart' },
    { path: '/purchases/requests', label: 'คำขอซื้อ', scope: 'purchase', icon: 'bi-clipboard-check' },
    { path: '/expenses', label: 'รายจ่าย', scope: 'expense', icon: 'bi-cash-stack' },
    { path: '/accounting/document-review', label: 'กล่องงานตรวจสอบ', scope: 'accounting_reports', icon: 'bi-inboxes' },
    { path: '/accounting/reports', label: 'รายงานบัญชี', scope: 'accounting_reports', icon: 'bi-graph-up-arrow' },
    { path: '/accounting/etax', label: 'เอกสาร e-Tax', scope: 'etax', icon: 'bi-receipt-cutoff' },
    { path: '/customers', label: 'รายชื่อติดต่อ', scope: 'contacts', icon: 'bi-people' },
    { path: '/products', label: 'สินค้า/บริการ', scope: 'products', icon: 'bi-box-seam' },
    { path: '/excel-import', label: 'นำเข้า Excel', scope: 'excel', icon: 'bi-file-earmark-spreadsheet' },
    { path: '/reports-studio', label: 'สตูดิโอรายงาน', mobileLabel: 'สตูดิโอ\nรายงาน', icon: 'bi-layout-text-window-reverse' },
    { path: '/backend-connection', label: 'ตั้งค่าการเชื่อมต่อ', scope: 'auth', icon: 'bi-plug' },
    { path: '/accounting/tax-settings', label: 'ตั้งค่า VAT/ภาษี', scope: 'accounting_reports', icon: 'bi-percent' },
  ]
  const mobileNavItems = navItems.filter((item) => item.showOnMobile)
  const mobileMoreNavItems = navItems.filter((item) => !item.showOnMobile)
  const isMobileMoreActive = mobileMoreNavItems.some((item) => location.pathname.startsWith(item.path))

  const canSwitchCompany = Boolean(user && user.companies && user.companies.length > 1)
  const isPathActive = (prefix: string) => location.pathname.startsWith(prefix)

  const sidebarItems: SidebarItem[] = [
    { path: '/dashboard', label: 'แดชบอร์ด', icon: 'bi-grid-1x2', active: isPathActive('/dashboard') },
    {
      path: '/sales/invoices',
      label: 'การขาย',
      icon: 'bi-wallet2',
      active: isPathActive('/sales') || isPathActive('/notes'),
      scope: 'invoice',
      children: [
        { path: '/sales/orders', label: 'ใบเสนอราคา/SO', scope: 'invoice' },
        { path: '/sales/invoices', label: 'ใบแจ้งหนี้', scope: 'invoice' },
        { path: '/sales/receipts', label: 'ใบเสร็จรับเงิน', scope: 'invoice' },
        { path: '/notes', label: 'ใบเพิ่ม/ลดหนี้', scope: 'invoice' },
      ],
    },
    {
      path: '/purchases/orders',
      label: 'การซื้อ',
      icon: 'bi-bag',
      active: isPathActive('/purchases'),
      scope: 'purchase',
      children: [
        { path: '/purchases/orders', label: 'ใบสั่งซื้อ', scope: 'purchase' },
        { path: '/purchases/requests', label: 'คำขอซื้อ', scope: 'purchase' },
      ],
    },
    { path: '/expenses', label: 'รายจ่าย', icon: 'bi-cash-stack', active: isPathActive('/expenses'), scope: 'expense' },
    {
      path: '/accounting/document-review',
      label: 'การบัญชี',
      icon: 'bi-journal-check',
      active: isPathActive('/accounting') && !isPathActive('/accounting/reports') && !isPathActive('/accounting/tax-settings'),
      scope: 'accounting_reports',
      children: [
        { path: '/accounting/document-review', label: 'กล่องงานตรวจสอบ', scope: 'accounting_reports' },
        { path: '/accounting/etax', label: 'เอกสาร e-Tax', scope: 'etax' },
      ],
    },
    { path: '/accounting/reports', label: 'รายงาน', icon: 'bi-bar-chart-line', active: isPathActive('/accounting/reports'), scope: 'accounting_reports' },
    { path: '/customers', label: 'ผู้ติดต่อ', icon: 'bi-person-rolodex', active: isPathActive('/customers'), scope: 'contacts' },
    { path: '/products', label: 'สินค้า', icon: 'bi-box-seam', active: isPathActive('/products'), scope: 'products' },
    {
      path: '/backend-connection',
      label: 'ตั้งค่า',
      icon: 'bi-sliders',
      active: isPathActive('/backend-connection') || isPathActive('/accounting/tax-settings') || isPathActive('/excel-import') || isPathActive('/reports-studio'),
      scope: 'auth',
      children: [
        { path: '/backend-connection', label: 'ตั้งค่าการเชื่อมต่อ', scope: 'auth' },
        { path: '/accounting/tax-settings', label: 'ตั้งค่า VAT/ภาษี', scope: 'accounting_reports' },
        { path: '/excel-import', label: 'นำเข้า Excel', scope: 'excel' },
        { path: '/reports-studio', label: 'สตูดิโอรายงาน' },
      ],
    },
  ]

  const searchCommands = useMemo(
    () => [
      { label: 'สร้างใบแจ้งหนี้', path: '/sales/invoices/new', icon: 'bi-receipt', shortcut: 'INV', scope: 'invoice' },
      { label: 'บันทึกรายจ่าย', path: '/expenses/new', icon: 'bi-cash-stack', shortcut: 'EXP', scope: 'expense' },
      { label: 'สร้างใบเสนอราคา', path: '/sales/orders/new', icon: 'bi-file-earmark-text', shortcut: 'QT', scope: 'invoice' },
      { label: 'ไปหน้าแดชบอร์ด', path: '/dashboard', icon: 'bi-grid-1x2', shortcut: 'DB' },
      { label: 'รายงานกำไรขาดทุน', path: '/accounting/reports/profit-loss', icon: 'bi-graph-up-arrow', shortcut: 'PL', scope: 'accounting_reports' },
      { label: 'เอกสาร e-Tax', path: '/accounting/etax', icon: 'bi-receipt-cutoff', shortcut: 'ETX', scope: 'etax' },
      { label: 'รายชื่อติดต่อ', path: '/customers', icon: 'bi-person-rolodex', shortcut: 'CON', scope: 'contacts' },
      { label: 'สินค้า/บริการ', path: '/products', icon: 'bi-box-seam', shortcut: 'PROD', scope: 'products' },
    ],
    [],
  )

  const filteredCommands = searchCommands.filter((cmd) => {
    const allowed = !cmd.scope || hasScope(cmd.scope)
    const q = searchQuery.trim().toLowerCase()
    return allowed && (!q || cmd.label.toLowerCase().includes(q) || cmd.shortcut.toLowerCase().includes(q))
  })

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const toggleThemeMode = () => {
    const nextMode: ThemeMode = themeMode === 'light' ? 'dark' : 'light'
    setThemeMode(nextMode)
    setThemeModeState(nextMode)
  }

  const closeCommandPalette = () => {
    setShowSearchModal(false)
    setSearchQuery('')
    setSelectedIndex(0)
  }

  const goToCommand = (path: string) => {
    navigate(path)
    closeCommandPalette()
  }

  const handleModalKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (filteredCommands.length > 0) {
        setSelectedIndex((prev) => (prev + 1) % filteredCommands.length)
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (filteredCommands.length > 0) {
        setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length)
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const command = filteredCommands[selectedIndex]
      if (command) goToCommand(command.path)
    } else if (e.key === 'Escape') {
      closeCommandPalette()
    }
  }

  const navigateWithScope = (item: Pick<NavItem, 'path' | 'label' | 'scope'>) => {
    setIsMobileMenuOpen(false)
    if (item.scope && !hasScope(item.scope)) {
      console.warn(`[AppLayout] Navigation opened for "${item.label}" although scope "${item.scope}" is not currently advertised by runtime scopes`)
    }
    navigate(item.path)
  }

  const handleCompanyChange = async (nextCompanyId: number) => {
    if (!user || !Number.isFinite(nextCompanyId) || nextCompanyId === Number(instancePublicId || 0)) return
    try {
      await switchCompany(nextCompanyId)
      window.location.reload()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'เปลี่ยนบริษัทไม่สำเร็จ'
      toast.error('เปลี่ยนบริษัทไม่สำเร็จ', msg)
    }
  }

  useEffect(() => {
    const syncAssistantVisibility = () => {
      setShowAssistantWidget(window.innerWidth >= 768)
    }
    syncAssistantVisibility()
    window.addEventListener('resize', syncAssistantVisibility)
    return () => window.removeEventListener('resize', syncAssistantVisibility)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setShowSearchModal((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    setSelectedIndex(0)
  }, [searchQuery])

  return (
    <div className={`d-flex flex-column min-vh-100 ${hideMobileNav ? 'qf-layout--mobile-form' : ''}`} style={{ background: 'var(--qf-body-bg)' }}>
      <header className={`sticky-top ${hideMobileNav ? 'qf-header--mobile-form' : ''}`} style={{ zIndex: 1030, height: '72px' }}>
        <div className={`qf-shell-header ${themeMode === 'light' ? 'text-dark' : 'text-white'}`}>
          <div className="container-fluid qf-header__inner px-4 h-100">
            <div className="d-flex align-items-center justify-content-between gap-3 h-100">
              <div className="d-flex align-items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="btn btn-link p-0 text-decoration-none border-0"
                  aria-label="กลับไปหน้าแดชบอร์ด"
                >
                  <AppLogo size="sm" tone={themeMode === 'light' ? 'dark' : 'light'} />
                </button>
                <div className="d-none d-sm-block">
                  <p className="small fw-bold mb-0 text-truncate" style={{ maxWidth: '200px', color: 'var(--qf-text-strong)' }}>
                    {user?.companyName ?? 'Odoo 18'}
                  </p>
                  <p className="small mb-0 text-truncate" style={{ maxWidth: '200px', fontSize: '0.6875rem', color: 'var(--qf-text-muted)' }}>
                    ระบบงานบัญชีสำหรับธุรกิจไทย
                  </p>
                </div>
                {canSwitchCompany ? (
                  <div className="d-none d-md-block">
                    <select
                      className="form-select form-select-sm"
                      style={{ minWidth: '240px', height: '36px', borderRadius: '8px' }}
                      value={String(instancePublicId ?? user?.companyId ?? '')}
                      onChange={(e) => void handleCompanyChange(Number(e.target.value))}
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

              <div className="position-relative d-none d-lg-block" style={{ width: '320px' }}>
                <span className="position-absolute top-50 start-0 translate-middle-y ps-3 text-muted">
                  <i className="bi bi-search" />
                </span>
                <input
                  type="text"
                  className="qf-topbar-search"
                  placeholder="ค้นหาเมนู ดำเนินการด่วน... (Ctrl+K)"
                  readOnly
                  onClick={() => setShowSearchModal(true)}
                  style={{ cursor: 'pointer' }}
                />
              </div>

              <div className="d-flex align-items-center gap-3 qf-header__actions">
                <button
                  type="button"
                  className="btn btn-link p-1 text-muted d-lg-none"
                  onClick={() => setShowSearchModal(true)}
                  title="ค้นหาด่วน"
                  aria-label="ค้นหาด่วน"
                >
                  <i className="bi bi-search" style={{ fontSize: '1.2rem' }} />
                </button>
                <button
                  type="button"
                  className="btn btn-link p-1 text-muted position-relative"
                  onClick={() => navigate('/accounting/document-review')}
                  title="งานรอการตรวจสอบและแจ้งเตือน"
                  aria-label="การแจ้งเตือน"
                >
                  <i className="bi bi-bell" style={{ fontSize: '1.25rem' }} />
                  {approvalBadgeCount > 0 ? (
                    <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger border border-light" style={{ padding: '0.25em 0.5em', fontSize: '0.65rem' }}>
                      {approvalBadgeCount}
                    </span>
                  ) : null}
                </button>
                <button
                  type="button"
                  onClick={toggleThemeMode}
                  className="btn btn-sm btn-outline-secondary py-1 px-3 border"
                  style={{ borderRadius: '9999px', fontSize: '0.85rem' }}
                  title={themeMode === 'light' ? 'สลับเป็นโหมดมืด' : 'สลับเป็นโหมดสว่าง'}
                  aria-label={themeMode === 'light' ? 'สลับเป็นโหมดมืด' : 'สลับเป็นโหมดสว่าง'}
                >
                  <span className="d-inline-flex align-items-center gap-2">
                    <i className={`bi ${themeMode === 'light' ? 'bi-moon-stars' : 'bi-sun'}`} aria-hidden="true" />
                    <span className="d-none d-sm-inline">{themeMode === 'light' ? 'โหมดมืด' : 'โหมดสว่าง'}</span>
                  </span>
                </button>
                <span className="badge bg-light text-dark border py-1 px-2 d-none d-sm-inline" style={{ borderRadius: '6px', fontSize: '0.75rem' }}>
                  TH
                </span>
                {user ? (
                  <span className="small fw-semibold d-none d-sm-inline" style={{ color: 'var(--qf-text-strong)' }}>
                    {user.name}
                  </span>
                ) : null}
                <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted p-0 border-0">
                  <i className="bi bi-box-arrow-right d-sm-none" aria-hidden="true" />
                  <span className="d-none d-sm-inline" style={{ fontSize: '0.9rem' }}>ออกจากระบบ</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {canSwitchCompany && !hideMobileNav ? (
        <div className="qf-mobile-company-switch d-md-none">
          <div className="container-fluid px-3 py-2">
            <label className="qf-mobile-company-switch__label" htmlFor="qf-mobile-company-select">
              บริษัทที่ใช้งาน
            </label>
            <select
              id="qf-mobile-company-select"
              className="form-select form-select-sm qf-mobile-company-switch__select"
              value={String(instancePublicId ?? user?.companyId ?? '')}
              onChange={(e) => void handleCompanyChange(Number(e.target.value))}
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
        </div>
      ) : null}

      <div className="qf-layout-container flex-grow-1">
        <aside className="qf-sidebar d-none d-sm-flex" aria-label="แถบเมนูหลัก">
          {sidebarItems.map((item) => {
            const allowed = !item.scope || hasScope(item.scope)
            return (
              <div key={item.path} className={`qf-sidebar-group d-flex flex-column gap-1 ${item.active ? 'is-active-group' : ''}`}>
                <button
                  type="button"
                  onClick={() => navigateWithScope(item)}
                  className={`qf-sidebar-item ${item.active ? 'is-active' : ''} ${!allowed ? 'opacity-50' : ''}`}
                  data-label={item.label}
                  title={!allowed ? restrictedScopeTitle(item.scope) : item.label}
                >
                  <span className="qf-sidebar-item__icon">
                    <i className={`bi ${item.icon}`} />
                  </span>
                  <span className="qf-sidebar-item__label">{item.label}</span>
                </button>
                {item.children ? (
                  <div className="qf-sidebar-submenu">
                    {item.children.map((child) => {
                      const childAllowed = !child.scope || hasScope(child.scope)
                      const childActive = location.pathname.startsWith(child.path)
                      return (
                        <button
                          key={child.path}
                          type="button"
                          onClick={() => navigateWithScope(child)}
                          className={`qf-sidebar-subitem ${childActive ? 'is-active' : ''} ${!childAllowed ? 'opacity-50' : ''}`}
                          title={!childAllowed ? restrictedScopeTitle(child.scope) : child.label}
                        >
                          <span className="qf-sidebar-subitem__dot" />
                          <span className="qf-sidebar-subitem__label">{child.label}</span>
                        </button>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            )
          })}
        </aside>

        <div className="flex-grow-1 d-flex flex-column min-w-0 bg-transparent">
          <PageContainer className={`flex-1 qf-content ${hideMobileNav ? 'qf-content--mobile-form' : ''}`} fluid>
            <main className="min-w-0 flex-1">
              <ConfigBanner />
              <Outlet />
            </main>
          </PageContainer>
        </div>
      </div>

      {!hideMobileNav ? (
        <nav
          className="qf-mobile-nav fixed-bottom d-sm-none border-top"
          style={{ zIndex: 1020, backdropFilter: 'blur(12px)' }}
        >
          <div className="qf-mobile-nav__inner container-fluid">
            {mobileNavItems.map((item) => {
              const allowed = !item.scope || hasScope(item.scope)
              const active = location.pathname.startsWith(item.path)
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => navigateWithScope(item)}
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
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((open) => !open)}
              className={`qf-mobile-nav__item ${isMobileMoreActive || isMobileMenuOpen ? 'is-active' : ''}`}
              aria-expanded={isMobileMenuOpen}
              aria-controls="qf-mobile-more-menu"
            >
              <i className="bi bi-grid-3x3-gap qf-mobile-nav__icon" aria-hidden="true" />
              <span className="qf-mobile-nav__label">เมนู</span>
            </button>
          </div>
        </nav>
      ) : null}

      {!hideMobileNav && isMobileMenuOpen ? (
        <div className="qf-mobile-more d-sm-none" id="qf-mobile-more-menu">
          <div className="qf-mobile-more__panel">
            <div className="qf-mobile-more__head">
              <div className="fw-semibold">เมนูทั้งหมด</div>
              <button type="button" className="btn btn-sm btn-link text-decoration-none" onClick={() => setIsMobileMenuOpen(false)} aria-label="ปิดเมนู">
                <i className="bi bi-x-lg" aria-hidden="true" />
              </button>
            </div>
            <div className="qf-mobile-more__grid">
              {mobileMoreNavItems.map((item) => {
                const allowed = !item.scope || hasScope(item.scope)
                const active = location.pathname.startsWith(item.path)
                return (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => navigateWithScope(item)}
                    className={`qf-mobile-more__item ${active ? 'is-active' : ''} ${!allowed ? 'opacity-50' : ''}`}
                    title={!allowed && item.scope ? restrictedScopeTitle(item.scope) : undefined}
                  >
                    <i className={`bi ${item.icon}`} aria-hidden="true" />
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      ) : null}

      {showAssistantWidget ? <AvatarAssistant /> : null}

      {showSearchModal ? (
        <div className="qf-command-palette-overlay" onClick={closeCommandPalette}>
          <div className="qf-command-palette-container" onClick={(e) => e.stopPropagation()}>
            <div className="qf-command-palette-search-wrapper">
              <i className="bi bi-search qf-command-palette-search-icon" />
              <input
                type="text"
                className="qf-command-palette-input"
                placeholder="พิมพ์ชื่อคำสั่งเพื่อค้นหา..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleModalKeyDown}
                autoFocus
              />
            </div>
            <div className="qf-command-palette-results">
              <div className="qf-command-palette-section-title">คำสั่งลัดด่วน</div>
              {filteredCommands.length === 0 ? (
                <div className="p-3 text-muted text-center small">ไม่พบผลการค้นหา</div>
              ) : (
                filteredCommands.map((cmd, idx) => (
                  <button
                    key={cmd.path}
                    type="button"
                    className={`qf-command-palette-item ${selectedIndex === idx ? 'is-selected' : ''}`}
                    onClick={() => goToCommand(cmd.path)}
                  >
                    <span className="qf-command-palette-item-icon"><i className={`bi ${cmd.icon}`} /></span>
                    <span>{cmd.label}</span>
                    <span className="qf-command-palette-item-shortcut">{cmd.shortcut}</span>
                  </button>
                ))
              )}
            </div>
            <div className="qf-command-palette-footer">
              <span>กด <kbd>↑↓</kbd> เพื่อเลือก และ <kbd>Enter</kbd> เพื่อตกลง</span>
              <span>กด <kbd>ESC</kbd> เพื่อปิด</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

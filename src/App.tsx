import { useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProtectedRoute } from '@/features/auth/ProtectedRoute'
import { LoginPage } from '@/features/auth/LoginPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { InvoicesListPage } from '@/features/sales/InvoicesListPage'
import { InvoiceDetailPage } from '@/features/sales/InvoiceDetailPage'
import { InvoiceFormPage } from '@/features/sales/InvoiceFormPage'
import { CustomersListPage } from '@/features/customers/CustomersListPage'
import { CustomerDetailPage } from '@/features/customers/CustomerDetailPage'
import { CustomerFormPage } from '@/features/customers/CustomerFormPage'
import { BackendConnectionPage } from '@/features/backend-connection/BackendConnectionPage'
import { ExcelImportPage } from '@/features/excel-import/ExcelImportPage'
import { setUnauthorizedHandler } from '@/api/client'
import { useAuthStore } from '@/features/auth/store'
import { ErrorBoundary } from '@/components/system/ErrorBoundary'
import { ToastHost } from '@/components/system/ToastHost'

// Reports Studio (integrated as part of the same ERPTH shell)
import { StudioBootstrap } from '@/app/StudioBootstrap'
import { DashboardPage as ReportsDashboardPage } from '@/app/features/dashboard/DashboardPage'
import { BrandingPage as ReportsBrandingPage } from '@/app/features/branding/BrandingPage'
import { TemplateLibraryPage as ReportsTemplateLibraryPage } from '@/app/features/templates/TemplateLibraryPage'
import { EditorPage as ReportsEditorPage } from '@/app/features/editor/EditorPage'
import { PreviewPage as ReportsPreviewPage, PrintPage as ReportsPrintPage } from '@/app/features/preview/PreviewPage'
import { SettingsPage as ReportsSettingsPage } from '@/app/features/settings/SettingsPage'

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      {/* TODO: /line-entry for LIFF auto-login */}

      <Route element={<ProtectedRoute />}>
        {/* Print route must not include AppLayout chrome */}
        <Route
          path="/reports-studio/print/:templateId"
          element={
            <StudioBootstrap>
              <ReportsPrintPage />
            </StudioBootstrap>
          }
        />

        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/customers" element={<CustomersListPage />} />
          <Route path="/customers/new" element={<CustomerFormPage />} />
          <Route path="/customers/:id" element={<CustomerDetailPage />} />
          <Route path="/customers/:id/edit" element={<CustomerFormPage />} />
          <Route path="/sales/invoices" element={<InvoicesListPage />} />
          <Route path="/sales/invoices/new" element={<InvoiceFormPage />} />
          <Route path="/sales/invoices/:id" element={<InvoiceDetailPage />} />
          <Route path="/sales/invoices/:id/edit" element={<InvoiceFormPage />} />
          <Route
            path="/backend-connection"
            element={<BackendConnectionPage />}
          />
          <Route path="/excel-import" element={<ExcelImportPage />} />

          {/* Reports Studio routes inside the same ERPTH shell */}
          <Route element={<StudioBootstrap />}>
            <Route path="/reports-studio" element={<ReportsDashboardPage />} />
            <Route path="/reports-studio/branding" element={<ReportsBrandingPage />} />
            <Route path="/reports-studio/templates" element={<ReportsTemplateLibraryPage />} />
            <Route path="/reports-studio/editor/:templateId" element={<ReportsEditorPage />} />
            <Route path="/reports-studio/preview/:templateId" element={<ReportsPreviewPage />} />
            <Route path="/reports-studio/settings" element={<ReportsSettingsPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

function App() {
  const navigate = useNavigate()
  const logout = useAuthStore((s) => s.logout)

  useEffect(() => {
    setUnauthorizedHandler(async () => {
      await logout()
      navigate('/login', { replace: true })
    })
  }, [logout, navigate])

  return (
    <ErrorBoundary>
      <div className="qf-app">
        <AppRoutes />
        <ToastHost />
      </div>
    </ErrorBoundary>
  )
}

export default App

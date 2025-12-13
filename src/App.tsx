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

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      {/* TODO: /line-entry for LIFF auto-login */}

      <Route element={<ProtectedRoute />}>
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

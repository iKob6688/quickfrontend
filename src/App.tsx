import { useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProtectedRoute } from '@/features/auth/ProtectedRoute'
import { LoginPage } from '@/features/auth/LoginPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { InvoicesListPage } from '@/features/sales/InvoicesListPage'
import { InvoiceDetailPage } from '@/features/sales/InvoiceDetailPage'
import { InvoiceFormPage } from '@/features/sales/InvoiceFormPage'
import { BackendConnectionPage } from '@/features/backend-connection/BackendConnectionPage'
import { ExcelImportPage } from '@/features/excel-import/ExcelImportPage'
import { setUnauthorizedHandler } from '@/api/client'
import { useAuthStore } from '@/features/auth/store'

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      {/* TODO: /line-entry for LIFF auto-login */}

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
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

  return <div className="qf-app"><AppRoutes /></div>
}

export default App

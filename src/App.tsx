import { useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProtectedRoute } from '@/features/auth/ProtectedRoute'
import { LoginPage } from '@/features/auth/LoginPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { InvoicesListPage } from '@/features/sales/InvoicesListPage'
import { InvoiceDetailPage } from '@/features/sales/InvoiceDetailPage'
import { InvoiceFormPage } from '@/features/sales/InvoiceFormPage'
import { SalesOrdersListPage } from '@/features/sales/SalesOrdersListPage'
import { SalesOrderDetailPage } from '@/features/sales/SalesOrderDetailPage'
import { SalesOrderFormPage } from '@/features/sales/SalesOrderFormPage'
import { SalesOrderPrintPreviewPage } from '@/features/sales/SalesOrderPrintPreviewPage'
import { PurchaseOrdersListPage } from '@/features/purchases/PurchaseOrdersListPage'
import { PurchaseOrderDetailPage } from '@/features/purchases/PurchaseOrderDetailPage'
import { PurchaseOrderFormPage } from '@/features/purchases/PurchaseOrderFormPage'
import { PurchaseRequestsListPage } from '@/features/purchases/PurchaseRequestsListPage'
import { PurchaseRequestFormPage } from '@/features/purchases/PurchaseRequestFormPage'
import { PurchaseRequestDetailPage } from '@/features/purchases/PurchaseRequestDetailPage'
import { ExpensesListPage } from '@/features/expenses/ExpensesListPage'
import { ExpenseDetailPage } from '@/features/expenses/ExpenseDetailPage'
import { CustomersListPage } from '@/features/customers/CustomersListPage'
import { CustomerDetailPage } from '@/features/customers/CustomerDetailPage'
import { CustomerFormPage } from '@/features/customers/CustomerFormPage'
import { ProductsListPage } from '@/features/products/ProductsListPage'
import { ProductFormPage } from '@/features/products/ProductFormPage'
import { AccountingReportsPage } from '@/features/accounting/AccountingReportsPage'
import { ProfitLossReportPage } from '@/features/accounting/ProfitLossReportPage'
import { BalanceSheetReportPage } from '@/features/accounting/BalanceSheetReportPage'
import { GeneralLedgerReportPage } from '@/features/accounting/GeneralLedgerReportPage'
import { TrialBalanceReportPage } from '@/features/accounting/TrialBalanceReportPage'
import { PartnerLedgerReportPage } from '@/features/accounting/PartnerLedgerReportPage'
import { PartnerLedgerPartnerDrilldownPage } from '@/features/accounting/PartnerLedgerPartnerDrilldownPage'
import { AgedReportPage } from '@/features/accounting/AgedReportPage'
import { BookReportPage } from '@/features/accounting/BookReportPage'
import { VatReportPage, WhtReportPage } from '@/features/accounting/TaxReportPages'
import { GeneralLedgerAccountDrilldownPage } from '@/features/accounting/GeneralLedgerAccountDrilldownPage'
import { MoveLineDetailPage } from '@/features/accounting/MoveLineDetailPage'
import { BackendConnectionPage } from '@/features/backend-connection/BackendConnectionPage'
import { ExcelImportPage } from '@/features/excel-import/ExcelImportPage'
import { AgentDashboardPage } from '@/features/agent/AgentDashboardPage'
import { AgentOCRUploadPage } from '@/features/agent/AgentOCRUploadPage'
import { AgentExpenseAutoPostPage } from '@/features/agent/AgentExpenseAutoPostPage'
import { AgentQuotationCreatePage } from '@/features/agent/AgentQuotationCreatePage'
import { AgentContactCreatePage } from '@/features/agent/AgentContactCreatePage'
import { AgentInvoiceCreatePage } from '@/features/agent/AgentInvoiceCreatePage'
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
        <Route path="/sales/orders/:id/print-preview" element={<SalesOrderPrintPreviewPage />} />

        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/customers" element={<CustomersListPage />} />
          <Route path="/customers/new" element={<CustomerFormPage />} />
          <Route path="/customers/:id" element={<CustomerDetailPage />} />
          <Route path="/customers/:id/edit" element={<CustomerFormPage />} />
          <Route path="/products" element={<ProductsListPage />} />
          <Route path="/products/new" element={<ProductFormPage />} />
          <Route path="/products/:id/edit" element={<ProductFormPage />} />
          <Route path="/sales/invoices" element={<InvoicesListPage />} />
          <Route path="/sales/invoices/new" element={<InvoiceFormPage />} />
          <Route path="/sales/invoices/:id" element={<InvoiceDetailPage />} />
          <Route path="/sales/invoices/:id/edit" element={<InvoiceFormPage />} />
          <Route path="/sales/orders" element={<SalesOrdersListPage />} />
          <Route path="/sales/orders/new" element={<SalesOrderFormPage />} />
          <Route path="/sales/orders/:id" element={<SalesOrderDetailPage />} />
          <Route path="/sales/orders/:id/edit" element={<SalesOrderFormPage />} />
          <Route path="/purchases/orders" element={<PurchaseOrdersListPage />} />
          <Route path="/purchases/orders/new" element={<PurchaseOrderFormPage />} />
          <Route path="/purchases/orders/:id" element={<PurchaseOrderDetailPage />} />
          <Route path="/purchases/orders/:id/edit" element={<PurchaseOrderFormPage />} />
          <Route path="/purchases/requests" element={<PurchaseRequestsListPage />} />
          <Route path="/purchases/requests/new" element={<PurchaseRequestFormPage />} />
          <Route path="/purchases/requests/:id" element={<PurchaseRequestDetailPage />} />
          <Route path="/purchases/requests/:id/edit" element={<PurchaseRequestFormPage />} />
          <Route path="/expenses" element={<ExpensesListPage />} />
          <Route path="/expenses/:id" element={<ExpenseDetailPage />} />
          <Route path="/accounting/reports" element={<AccountingReportsPage />} />
          <Route path="/accounting/reports/profit-loss" element={<ProfitLossReportPage />} />
          <Route path="/accounting/reports/balance-sheet" element={<BalanceSheetReportPage />} />
          <Route path="/accounting/reports/general-ledger" element={<GeneralLedgerReportPage />} />
          <Route path="/accounting/reports/trial-balance" element={<TrialBalanceReportPage />} />
          <Route path="/accounting/reports/partner-ledger" element={<PartnerLedgerReportPage />} />
          <Route path="/accounting/reports/partner-ledger/partner/:partnerId" element={<PartnerLedgerPartnerDrilldownPage />} />
          <Route path="/accounting/reports/aged-receivables" element={<AgedReportPage mode="receivables" />} />
          <Route path="/accounting/reports/aged-payables" element={<AgedReportPage mode="payables" />} />
          <Route path="/accounting/reports/cash-book" element={<BookReportPage mode="cash" />} />
          <Route path="/accounting/reports/bank-book" element={<BookReportPage mode="bank" />} />
          <Route path="/accounting/reports/vat" element={<VatReportPage />} />
          <Route path="/accounting/reports/wht" element={<WhtReportPage />} />
          <Route path="/accounting/reports/general-ledger/account/:accountId" element={<GeneralLedgerAccountDrilldownPage />} />
          <Route path="/accounting/reports/move-lines/:moveLineId" element={<MoveLineDetailPage />} />
          {/* Backward-compatible alias */}
          <Route path="/accounting/overview" element={<Navigate to="/accounting/reports" replace />} />
          <Route
            path="/backend-connection"
            element={<BackendConnectionPage />}
          />
          <Route path="/excel-import" element={<ExcelImportPage />} />
          <Route path="/agent" element={<AgentDashboardPage />} />
          <Route path="/agent/ocr" element={<AgentOCRUploadPage />} />
          <Route path="/agent/expense" element={<AgentExpenseAutoPostPage />} />
          <Route path="/agent/quotation" element={<AgentQuotationCreatePage />} />
          <Route path="/agent/contact" element={<AgentContactCreatePage />} />
          <Route path="/agent/invoice" element={<AgentInvoiceCreatePage />} />

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

import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './shell/AppShell'
import { DashboardPage } from './features/dashboard/DashboardPage'
import { BrandingPage } from './features/branding/BrandingPage'
import { TemplateLibraryPage } from './features/templates/TemplateLibraryPage'
import { EditorPage } from './features/editor/EditorPage'
import { PreviewPage, PrintPage } from './features/preview/PreviewPage'
import { SettingsPage } from './features/settings/SettingsPage'

export function StudioRoutes() {
  return (
    <Routes>
      <Route path="/reports-studio/print/:templateId" element={<PrintPage />} />
      <Route element={<AppShell />}>
        <Route path="/reports-studio" element={<DashboardPage />} />
        <Route path="/reports-studio/branding" element={<BrandingPage />} />
        <Route path="/reports-studio/templates" element={<TemplateLibraryPage />} />
        <Route path="/reports-studio/editor/:templateId" element={<EditorPage />} />
        <Route path="/reports-studio/preview/:templateId" element={<PreviewPage />} />
        <Route path="/reports-studio/settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/reports-studio" replace />} />
    </Routes>
  )
}



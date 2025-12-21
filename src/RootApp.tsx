import { Navigate, Route, Routes } from 'react-router-dom'
import LegacyApp from './App'
import ReportsStudioApp from './app/App'

export default function RootApp() {
  return (
    <Routes>
      {/* Reports Studio lives under a safe prefix so it doesn't replace existing ERPTH routes */}
      <Route path="/reports-studio/*" element={<ReportsStudioApp />} />

      {/* Keep existing ERPTH app as the default */}
      <Route path="/*" element={<LegacyApp />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}



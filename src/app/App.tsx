import { useEffect } from 'react'
import { StudioRoutes } from './routes'
import { DEFAULT_TEMPLATES } from './core/storage/defaultTemplates'
import { useTemplateStore } from './core/storage/templateStore'

export default function ReportsStudioApp() {
  const ensureDefaults = useTemplateStore((s) => s.ensureDefaults)

  useEffect(() => {
    document.title = 'erpth Reports Studio'
    ensureDefaults(DEFAULT_TEMPLATES)
  }, [ensureDefaults])

  return <StudioRoutes />
}



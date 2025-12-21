import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { DEFAULT_TEMPLATES } from './core/storage/defaultTemplates'
import { useTemplateStore } from './core/storage/templateStore'

export function StudioBootstrap({ children }: { children?: React.ReactNode }) {
  const ensureDefaults = useTemplateStore((s) => s.ensureDefaults)

  useEffect(() => {
    ensureDefaults(DEFAULT_TEMPLATES)
  }, [ensureDefaults])

  return children ? children : <Outlet />
}



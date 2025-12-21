import { NavLink } from 'react-router-dom'
import { cn } from '@/app/lib/utils'
import { FileText, LayoutDashboard, Palette, Settings, Shapes } from 'lucide-react'

const nav = [
  { to: '/reports-studio', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/reports-studio/branding', label: 'Branding', icon: Palette },
  { to: '/reports-studio/templates', label: 'Templates', icon: Shapes },
  { to: '/reports-studio/preview/quotation_default_v1', label: 'Preview', icon: FileText },
  { to: '/reports-studio/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  return (
    <div className="flex h-full flex-col p-3">
      <div className="px-2 pb-3">
        <div className="text-sm font-semibold text-slate-900">erpth Reports Studio</div>
        <div className="text-xs text-slate-500">Drag & drop documents</div>
      </div>

      <nav className="flex flex-col gap-1">
        {nav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-slate-100',
                isActive && 'bg-slate-900 text-white hover:bg-slate-900',
              )
            }
          >
            <n.icon className="h-4 w-4" />
            {n.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto px-2 pt-3 text-xs text-slate-500">
        Local-first templates • Print-ready A4
      </div>
    </div>
  )
}



import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export function AppShell() {
  return (
    <div className="rs-no-print min-h-screen">
      <div className="flex min-h-screen">
        <aside className="w-64 border-r border-slate-200 bg-white/70 backdrop-blur">
          <Sidebar />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-slate-200 bg-white/70 backdrop-blur">
            <Topbar />
          </header>
          <main className="min-w-0 flex-1 bg-slate-50">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}



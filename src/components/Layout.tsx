import { Outlet, NavLink } from 'react-router-dom'
import { LayoutDashboard, ListTodo, Activity, Info, BookOpen } from 'lucide-react'

const nav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/tasks', icon: ListTodo, label: 'Tasks' },
  { to: '/spec', icon: BookOpen, label: 'Spec' },
  { to: '/status', icon: Info, label: 'Status' },
]

export default function Layout() {
  return (
    <div className="flex h-dvh overflow-hidden">
      {/* Sidebar - hidden on mobile, shown on md+ */}
      <aside className="hidden md:flex w-56 flex-col border-r border-border bg-surface shrink-0">
        <div className="flex items-center gap-2 px-4 h-14 border-b border-border">
          <Activity className="w-5 h-5 text-accent" />
          <span className="font-semibold text-accent text-sm tracking-wide">Orchestrator</span>
        </div>
        <nav className="flex-1 py-2 px-2 space-y-0.5">
          {nav.map(n => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive ? 'bg-border/60 text-accent' : 'text-text-secondary hover:text-text hover:bg-border/30'
                }`
              }
            >
              <n.icon className="w-4 h-4" />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-border text-[11px] text-text-secondary">
          <kbd className="px-1.5 py-0.5 rounded bg-border text-[10px]">⌘K</kbd> Command palette
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="md:hidden flex items-center gap-2 px-4 h-12 border-b border-border bg-surface">
          <Activity className="w-4 h-4 text-accent" />
          <span className="font-semibold text-accent text-sm">Orchestrator</span>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden flex border-t border-border bg-surface">
          {nav.map(n => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center gap-1 py-3 text-[11px] min-h-[48px] ${
                  isActive ? 'text-accent' : 'text-text-secondary'
                }`
              }
            >
              <n.icon className="w-5 h-5" />
              {n.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}

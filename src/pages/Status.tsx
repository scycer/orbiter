import { useEffect, useState } from 'react'
import { Server, Globe, Database, Cpu, Layers, Keyboard, Wifi, Shield, Clock, GitBranch } from 'lucide-react'

interface Health { ok: boolean; tasks: number; uptime: number }

export default function Status() {
  const [health, setHealth] = useState<Health | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch('/api/health').then(r => r.json()).then(setHealth).catch(() => setError(true))
  }, [])

  const uptime = health ? formatUptime(health.uptime) : '—'

  return (
    <div className="p-4 md:p-6 max-w-4xl space-y-6">
      <h1 className="text-lg font-semibold">System Status</h1>

      {/* Live health */}
      <Section icon={Wifi} title="Live Status">
        <Row label="API" value={health ? 'Online' : error ? 'Unreachable' : 'Checking...'} ok={!!health} />
        <Row label="Tasks in store" value={health ? String(health.tasks) : '—'} />
        <Row label="API uptime" value={uptime} />
      </Section>

      {/* Architecture */}
      <Section icon={Layers} title="Architecture">
        <Row label="Type" value="React SPA + Hono API on single VPS" />
        <Row label="Frontend" value="React 19 + TypeScript + Vite 8 + Tailwind CSS 4" />
        <Row label="Backend" value="Hono on Node via tsx (port 3001)" />
        <Row label="UI server" value="Vite dev server (port 5173)" />
        <Row label="State" value="File-based JSON — ./data/tasks.json" />
        <Row label="Real-time" value="Server-Sent Events (SSE) at /api/events" />
        <Row label="PWA" value="vite-plugin-pwa with autoUpdate" />
      </Section>

      {/* Infrastructure */}
      <Section icon={Server} title="Infrastructure">
        <Row label="Host" value="DigitalOcean VPS (devbox)" />
        <Row label="Node" value="v20.20.1 (pnpm 10.33.0)" />
        <Row label="Process manager" value="systemd (orchestrator-api + orchestrator-ui)" />
        <Row label="Healthcheck" value="Cron script restarts services if down" />
        <Row label="Working directory" value="/root/dev/orbiter" />
      </Section>

      {/* Networking */}
      <Section icon={Globe} title="Networking">
        <Row label="Public URL" value="orchestrator-devbox.danhoek.dev" link="https://orchestrator-devbox.danhoek.dev" />
        <Row label="Tunnel" value="Cloudflare Tunnel (cloudflared)" />
        <Row label="Tunnel ID" value="ea11b08c-0009-4567-b652-a7026dbef563" mono />
        <Row label="Auth" value="Cloudflare Access (no app-level auth)" />
        <Row label="SSL" value="Cloudflare edge (Universal SSL)" />
      </Section>

      {/* Data */}
      <Section icon={Database} title="Data Model">
        <Row label="Entity" value="Task" />
        <Row label="Statuses" value="pending → assigned → in-progress → review → approved / rejected → done" />
        <Row label="Priorities" value="low, medium, high, urgent" />
        <Row label="Fields" value="id, title, description, status, priority, assignee, tags, output, timestamps" />
      </Section>

      {/* API */}
      <Section icon={Cpu} title="API Routes">
        <Row label="GET" value="/api/tasks — list (supports ?status= filter)" mono />
        <Row label="POST" value="/api/tasks — create task" mono />
        <Row label="GET" value="/api/tasks/:id — get single task" mono />
        <Row label="PATCH" value="/api/tasks/:id — partial update" mono />
        <Row label="POST" value="/api/tasks/:id/approve — approve" mono />
        <Row label="POST" value="/api/tasks/:id/reject — reject" mono />
        <Row label="DELETE" value="/api/tasks/:id — delete task" mono />
        <Row label="GET" value="/api/events — SSE stream" mono />
        <Row label="GET" value="/api/health — health check" mono />
      </Section>

      {/* UI Features */}
      <Section icon={Shield} title="UI Features">
        <Row label="Dashboard" value="Status summary cards, urgent tasks, recent activity" />
        <Row label="Task list" value="Filterable by status, sorted by priority, j/k keyboard nav" />
        <Row label="Task detail" value="View/edit, status change, approve/reject, delete" />
        <Row label="New task" value="Modal with title, description, priority" />
        <Row label="Command palette" value="Ctrl+K / Cmd+K — search tasks, navigate" />
        <Row label="Real-time" value="SSE auto-refreshes on any task change" />
        <Row label="Responsive" value="Sidebar on desktop, bottom nav on mobile, 48px touch targets" />
        <Row label="Theme" value="Dark only — #0f0f17 bg, #c4b5fd accent" />
      </Section>

      {/* Keyboard shortcuts */}
      <Section icon={Keyboard} title="Keyboard Shortcuts">
        <Row label="⌘K" value="Command palette" />
        <Row label="N" value="New task" />
        <Row label="J / K" value="Navigate task list" />
        <Row label="Enter" value="Open selected task" />
        <Row label="A" value="Approve (detail view)" />
        <Row label="R" value="Reject (detail view)" />
        <Row label="Esc" value="Close / go back" />
        <Row label="?" value="Shortcut help" />
      </Section>

      {/* Dependencies */}
      <Section icon={GitBranch} title="Dependencies">
        <Row label="react" value="^19.2.4" mono />
        <Row label="hono" value="^4.12.9" mono />
        <Row label="vite" value="^8.0.1" mono />
        <Row label="tailwindcss" value="^4.2.2" mono />
        <Row label="react-router-dom" value="^7.13.2" mono />
        <Row label="@tanstack/react-query" value="^5.95.2" mono />
        <Row label="cmdk" value="^1.1.1" mono />
        <Row label="sonner" value="^2.0.7" mono />
        <Row label="lucide-react" value="^1.6.0" mono />
        <Row label="typescript" value="~5.9.3" mono />
      </Section>

      {/* Files */}
      <Section icon={Clock} title="Project Structure">
        <Pre>{`orbiter/
├── server/index.ts          # Hono API (all routes + SSE)
├── src/
│   ├── App.tsx               # Router + QueryClient + Toaster
│   ├── main.tsx              # Entry point
│   ├── index.css             # Tailwind + theme + cmdk styles
│   ├── lib/
│   │   ├── api.ts            # react-query hooks for all endpoints
│   │   └── useSSE.ts         # SSE auto-refresh hook
│   ├── components/
│   │   ├── Layout.tsx        # Shell: sidebar + mobile nav
│   │   ├── CommandPalette.tsx # cmdk integration
│   │   ├── NewTaskModal.tsx   # Task creation form
│   │   └── ShortcutHelp.tsx   # Keyboard shortcut overlay
│   └── pages/
│       ├── Dashboard.tsx      # Status cards + recent activity
│       ├── TaskList.tsx       # Filterable task list + kbd nav
│       ├── TaskDetail.tsx     # Full task view + actions
│       └── Status.tsx         # This page
├── data/tasks.json           # File-based task store
├── scripts/healthcheck.sh    # Cron watchdog
├── systemd/                  # Service unit files
├── vite.config.ts            # Vite + PWA + proxy config
└── CLAUDE.md                 # Project spec`}</Pre>
      </Section>
    </div>
  )
}

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4 md:p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-accent" />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function Row({ label, value, ok, mono, link }: { label: string; value: string; ok?: boolean; mono?: boolean; link?: string }) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <span className="text-text-secondary shrink-0 w-28 md:w-36 text-right text-xs pt-0.5">{label}</span>
      {ok !== undefined && <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${ok ? 'bg-success' : 'bg-error'}`} />}
      {link ? (
        <a href={link} target="_blank" rel="noreferrer" className={`text-accent hover:underline ${mono ? 'font-mono text-xs' : ''}`}>{value}</a>
      ) : (
        <span className={mono ? 'font-mono text-xs text-text-secondary' : ''}>{value}</span>
      )}
    </div>
  )
}

function Pre({ children }: { children: React.ReactNode }) {
  return <pre className="text-xs font-mono text-text-secondary bg-bg border border-border rounded-lg p-3 overflow-x-auto">{children}</pre>
}

function formatUptime(secs: number) {
  const d = Math.floor(secs / 86400)
  const h = Math.floor((secs % 86400) / 3600)
  const m = Math.floor((secs % 3600) / 60)
  return [d && `${d}d`, h && `${h}h`, `${m}m`].filter(Boolean).join(' ')
}

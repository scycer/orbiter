import { useTasks } from '../lib/api'
import type { Task } from '../lib/api'
import { Link } from 'react-router-dom'
import { Clock, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'

const STATUS_GROUPS = [
  { label: 'Pending', statuses: ['pending', 'assigned'], icon: Clock, color: 'text-warning' },
  { label: 'In Progress', statuses: ['in-progress'], icon: Loader2, color: 'text-accent' },
  { label: 'Review', statuses: ['review'], icon: AlertTriangle, color: 'text-warning' },
  { label: 'Done', statuses: ['approved', 'done'], icon: CheckCircle2, color: 'text-success' },
] as const

function count(tasks: Task[], statuses: readonly string[]) {
  return tasks.filter(t => statuses.includes(t.status)).length
}

export default function Dashboard() {
  const { data: tasks = [], isLoading } = useTasks()

  const recent = [...tasks].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 8)
  const urgent = tasks.filter(t => t.priority === 'urgent' && !['done', 'approved'].includes(t.status))

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl">
      <h1 className="text-lg font-semibold">Dashboard</h1>

      {isLoading ? (
        <div className="text-text-secondary text-sm">Loading...</div>
      ) : (
        <>
          {/* Status cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {STATUS_GROUPS.map(g => (
              <div key={g.label} className="bg-surface border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <g.icon className={`w-4 h-4 ${g.color}`} />
                  <span className="text-xs text-text-secondary">{g.label}</span>
                </div>
                <div className="text-2xl font-semibold">{count(tasks, g.statuses)}</div>
              </div>
            ))}
          </div>

          {/* Urgent */}
          {urgent.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-error mb-2">Urgent</h2>
              <div className="space-y-1.5">
                {urgent.map(t => (
                  <Link
                    key={t.id}
                    to={`/tasks/${t.id}`}
                    className="block bg-surface border border-error/30 rounded-lg px-4 py-3 text-sm hover:border-error/60 transition-colors"
                  >
                    {t.title}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Recent */}
          <div>
            <h2 className="text-sm font-medium text-text-secondary mb-2">Recent Activity</h2>
            <div className="space-y-1.5">
              {recent.map(t => (
                <Link
                  key={t.id}
                  to={`/tasks/${t.id}`}
                  className="flex items-center gap-3 bg-surface border border-border rounded-lg px-4 py-3 hover:border-accent/30 transition-colors"
                >
                  <StatusDot status={t.status} />
                  <span className="text-sm truncate flex-1">{t.title}</span>
                  <span className="text-[11px] text-text-secondary shrink-0">
                    {new Date(t.updatedAt).toLocaleDateString()}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === 'done' || status === 'approved' ? 'bg-success'
    : status === 'rejected' ? 'bg-error'
    : status === 'in-progress' ? 'bg-accent'
    : status === 'review' ? 'bg-warning'
    : 'bg-text-secondary'
  return <div className={`w-2 h-2 rounded-full shrink-0 ${color}`} />
}

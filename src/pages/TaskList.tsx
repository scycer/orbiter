import { useState, useEffect, useCallback, useRef } from 'react'
import { useTasks } from '../lib/api'
import type { Task } from '../lib/api'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import NewTaskModal from '../components/NewTaskModal'

const STATUSES = ['all', 'pending', 'assigned', 'in-progress', 'review', 'approved', 'rejected', 'done'] as const
const PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3 }

export default function TaskList() {
  const [filter, setFilter] = useState<string>('all')
  const [selected, setSelected] = useState(0)
  const [showNew, setShowNew] = useState(false)
  const navigate = useNavigate()
  const listRef = useRef<HTMLDivElement>(null)

  const { data: tasks = [], isLoading } = useTasks(filter === 'all' ? undefined : filter)

  const sorted = [...tasks].sort((a, b) => {
    const pd = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
    if (pd !== 0) return pd
    return b.updatedAt.localeCompare(a.updatedAt)
  })

  // Clamp selection
  useEffect(() => {
    if (selected >= sorted.length) setSelected(Math.max(0, sorted.length - 1))
  }, [sorted.length, selected])

  // Keyboard nav
  const onKey = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
    if (showNew) return
    if (e.key === 'j') { e.preventDefault(); setSelected(s => Math.min(s + 1, sorted.length - 1)) }
    if (e.key === 'k') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    if (e.key === 'Enter' && sorted[selected]) { e.preventDefault(); navigate(`/tasks/${sorted[selected].id}`) }
    if (e.key === 'n') { e.preventDefault(); setShowNew(true) }
  }, [sorted, selected, navigate, showNew])

  useEffect(() => {
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onKey])

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.children[selected] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Tasks</h1>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-accent/15 text-accent rounded-lg text-sm hover:bg-accent/25 transition-colors min-h-[48px]"
        >
          <Plus className="w-4 h-4" />
          New
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-3 mb-4 -mx-4 px-4 md:mx-0 md:px-0">
        {STATUSES.map(s => (
          <button
            key={s}
            onClick={() => { setFilter(s); setSelected(0) }}
            className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap min-h-[36px] transition-colors ${
              filter === s ? 'bg-accent/20 text-accent' : 'bg-surface text-text-secondary hover:text-text'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-text-secondary text-sm">Loading...</div>
      ) : sorted.length === 0 ? (
        <div className="text-text-secondary text-sm text-center py-12">No tasks found</div>
      ) : (
        <div ref={listRef} className="space-y-1.5">
          {sorted.map((t, i) => (
            <TaskCard
              key={t.id}
              task={t}
              isSelected={i === selected}
              onClick={() => navigate(`/tasks/${t.id}`)}
              onMouseEnter={() => setSelected(i)}
            />
          ))}
        </div>
      )}

      {showNew && <NewTaskModal onClose={() => setShowNew(false)} />}
    </div>
  )
}

function TaskCard({ task: t, isSelected, onClick, onMouseEnter }: { task: Task; isSelected: boolean; onClick: () => void; onMouseEnter: () => void }) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors min-h-[48px] ${
        isSelected ? 'bg-surface border-accent/40' : 'bg-surface border-border hover:border-border'
      }`}
    >
      <PriorityIndicator priority={t.priority} />
      <div className="flex-1 min-w-0">
        <div className="text-sm truncate">{t.title}</div>
        <div className="flex items-center gap-2 mt-0.5">
          <StatusBadge status={t.status} />
          {t.assignee && <span className="text-[11px] text-text-secondary">{t.assignee}</span>}
        </div>
      </div>
      {t.tags.length > 0 && (
        <div className="hidden md:flex gap-1">
          {t.tags.slice(0, 2).map(tag => (
            <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-border text-text-secondary">{tag}</span>
          ))}
        </div>
      )}
    </button>
  )
}

function PriorityIndicator({ priority }: { priority: string }) {
  const color =
    priority === 'urgent' ? 'bg-error' : priority === 'high' ? 'bg-warning' : priority === 'medium' ? 'bg-accent' : 'bg-text-secondary'
  return <div className={`w-1.5 h-8 rounded-full shrink-0 ${color}`} />
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === 'done' || status === 'approved' ? 'text-success'
    : status === 'rejected' ? 'text-error'
    : status === 'in-progress' ? 'text-accent'
    : status === 'review' ? 'text-warning'
    : 'text-text-secondary'
  return <span className={`text-[11px] ${color}`}>{status}</span>
}

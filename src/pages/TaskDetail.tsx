import { useParams, useNavigate } from 'react-router-dom'
import { useTask, useApproveTask, useRejectTask, useUpdateTask, useDeleteTask } from '../lib/api'
import { useEffect, useCallback, useState } from 'react'
import { toast } from 'sonner'
import { ArrowLeft, Check, X, Trash2, Pencil, Activity } from 'lucide-react'

const STATUSES = ['pending', 'assigned', 'in-progress', 'review', 'approved', 'rejected', 'done'] as const

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: task, isLoading } = useTask(id!)
  const approve = useApproveTask()
  const reject = useRejectTask()
  const update = useUpdateTask()
  const remove = useDeleteTask()
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')

  useEffect(() => {
    if (task) { setTitle(task.title); setDesc(task.description) }
  }, [task])

  const onKey = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
    if (editing) return
    if (e.key === 'a' && task) {
      e.preventDefault()
      approve.mutate(task.id, { onSuccess: () => toast.success('Approved') })
    }
    if (e.key === 'r' && task) {
      e.preventDefault()
      reject.mutate(task.id, { onSuccess: () => toast.success('Rejected') })
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      navigate(-1)
    }
  }, [task, approve, reject, navigate, editing])

  useEffect(() => {
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onKey])

  if (isLoading) return <div className="p-6 text-text-secondary text-sm">Loading...</div>
  if (!task) return <div className="p-6 text-text-secondary text-sm">Task not found</div>

  const handleSave = () => {
    update.mutate({ id: task.id, title, description: desc }, {
      onSuccess: () => { setEditing(false); toast.success('Updated') },
    })
  }

  const handleDelete = () => {
    if (confirm('Delete this task?')) {
      remove.mutate(task.id, { onSuccess: () => { toast.success('Deleted'); navigate('/tasks') } })
    }
  }

  const priorityColor =
    task.priority === 'urgent' ? 'text-error' : task.priority === 'high' ? 'text-warning' : task.priority === 'medium' ? 'text-accent' : 'text-text-secondary'

  const statusColor =
    task.status === 'done' || task.status === 'approved' ? 'text-success'
    : task.status === 'rejected' ? 'text-error'
    : task.status === 'in-progress' ? 'text-accent'
    : task.status === 'review' ? 'text-warning'
    : 'text-text-secondary'

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      {/* Back */}
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-text-secondary text-sm mb-4 hover:text-text min-h-[48px]">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="bg-surface border border-border rounded-xl p-5 md:p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {editing ? (
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-lg font-semibold focus:outline-none focus:border-accent"
              />
            ) : (
              <h1 className="text-lg font-semibold">{task.title}</h1>
            )}
            <div className="flex items-center gap-3 mt-1.5 text-xs">
              <span className={statusColor}>{task.status}</span>
              <span className={priorityColor}>{task.priority}</span>
              {task.assignee && <span className="text-text-secondary">{task.assignee}</span>}
              <span className="text-text-secondary font-mono">{task.id}</span>
            </div>
          </div>
          <button
            onClick={() => editing ? handleSave() : setEditing(true)}
            className="p-2.5 rounded-lg hover:bg-border/50 text-text-secondary hover:text-text min-w-[48px] min-h-[48px] flex items-center justify-center"
          >
            {editing ? <Check className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
          </button>
        </div>

        {/* Description */}
        <div>
          <h2 className="text-xs text-text-secondary mb-1.5">Description</h2>
          {editing ? (
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              rows={4}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent resize-none"
            />
          ) : (
            <p className="text-sm text-text-secondary whitespace-pre-wrap">
              {task.description || 'No description'}
            </p>
          )}
        </div>

        {/* Status selector */}
        <div>
          <h2 className="text-xs text-text-secondary mb-1.5">Status</h2>
          <div className="flex flex-wrap gap-1.5">
            {STATUSES.map(s => (
              <button
                key={s}
                onClick={() => update.mutate({ id: task.id, status: s }, { onSuccess: () => toast.success(`Status: ${s}`) })}
                className={`px-3 py-1.5 rounded-lg text-xs min-h-[36px] transition-colors ${
                  task.status === s ? 'bg-accent/20 text-accent' : 'bg-bg text-text-secondary hover:text-text'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Tags */}
        {task.tags.length > 0 && (
          <div>
            <h2 className="text-xs text-text-secondary mb-1.5">Tags</h2>
            <div className="flex flex-wrap gap-1.5">
              {task.tags.map(tag => (
                <span key={tag} className="text-xs px-2 py-1 rounded-lg bg-border text-text-secondary">{tag}</span>
              ))}
            </div>
          </div>
        )}

        {/* Output */}
        {task.output && (
          <div>
            <h2 className="text-xs text-text-secondary mb-1.5">Output</h2>
            <pre className="text-xs bg-bg border border-border rounded-lg p-3 overflow-x-auto font-mono whitespace-pre-wrap text-text-secondary">
              {task.output}
            </pre>
          </div>
        )}

        {/* Activity Feed */}
        {task.activity && task.activity.length > 0 && (
          <div>
            <h2 className="flex items-center gap-1.5 text-xs text-text-secondary mb-2">
              <Activity className="w-3.5 h-3.5" /> Activity
              <span className="text-[10px] opacity-60">({task.activity.length})</span>
            </h2>
            <div className="bg-bg border border-border rounded-lg max-h-64 overflow-y-auto">
              {[...task.activity].reverse().map((entry, i) => {
                const eventColor =
                  entry.event === 'PostToolUseFailure' ? 'text-error'
                  : entry.event === 'Stop' ? 'text-accent'
                  : entry.event === 'SessionStart' || entry.event === 'SessionEnd' ? 'text-warning'
                  : entry.event === 'SubagentStart' || entry.event === 'SubagentStop' ? 'text-success'
                  : 'text-text-secondary'
                return (
                  <div key={i} className="flex items-start gap-2 px-3 py-1.5 border-b border-border/50 last:border-0 text-[11px]">
                    <span className="text-text-secondary opacity-60 font-mono whitespace-nowrap shrink-0">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                    {entry.tool && (
                      <span className="text-accent font-mono shrink-0">{entry.tool}</span>
                    )}
                    <span className={`${eventColor} truncate`} title={entry.summary}>
                      {entry.summary}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Timestamps */}
        <div className="flex gap-4 text-[11px] text-text-secondary pt-2 border-t border-border">
          <span>Created: {new Date(task.createdAt).toLocaleString()}</span>
          <span>Updated: {new Date(task.updatedAt).toLocaleString()}</span>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-2">
          <button
            onClick={() => approve.mutate(task.id, { onSuccess: () => toast.success('Approved') })}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-success/15 text-success rounded-lg text-sm hover:bg-success/25 min-h-[48px]"
          >
            <Check className="w-4 h-4" /> Approve <kbd className="text-[10px] ml-1 opacity-60">A</kbd>
          </button>
          <button
            onClick={() => reject.mutate(task.id, { onSuccess: () => toast.success('Rejected') })}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-error/15 text-error rounded-lg text-sm hover:bg-error/25 min-h-[48px]"
          >
            <X className="w-4 h-4" /> Reject <kbd className="text-[10px] ml-1 opacity-60">R</kbd>
          </button>
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-border/50 text-text-secondary rounded-lg text-sm hover:text-error hover:bg-error/15 min-h-[48px] ml-auto"
          >
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        </div>
      </div>
    </div>
  )
}

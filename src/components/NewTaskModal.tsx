import { useState } from 'react'
import { useCreateTask } from '../lib/api'
import { toast } from 'sonner'
import { X } from 'lucide-react'

export default function NewTaskModal({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<string>('medium')
  const create = useCreateTask()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    create.mutate(
      { title: title.trim(), description: description.trim(), priority: priority as 'low' | 'medium' | 'high' | 'urgent' },
      {
        onSuccess: () => { toast.success('Task created'); onClose() },
        onError: () => toast.error('Failed to create task'),
      }
    )
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <form
        onSubmit={handleSubmit}
        onClick={e => e.stopPropagation()}
        className="relative bg-surface border border-border rounded-xl p-5 w-full max-w-md space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">New Task</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-border/50 text-text-secondary min-w-[48px] min-h-[48px] flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <input
          autoFocus
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Task title"
          className="w-full bg-bg border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-accent min-h-[48px]"
        />

        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Description (optional)"
          rows={3}
          className="w-full bg-bg border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-accent resize-none"
        />

        <div>
          <label className="text-xs text-text-secondary mb-1.5 block">Priority</label>
          <div className="flex gap-1.5">
            {['low', 'medium', 'high', 'urgent'].map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={`flex-1 px-2 py-2 rounded-lg text-xs min-h-[40px] transition-colors ${
                  priority === p ? 'bg-accent/20 text-accent' : 'bg-bg text-text-secondary hover:text-text'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={!title.trim() || create.isPending}
          className="w-full py-2.5 bg-accent/20 text-accent rounded-lg text-sm font-medium hover:bg-accent/30 disabled:opacity-50 min-h-[48px]"
        >
          {create.isPending ? 'Creating...' : 'Create Task'}
        </button>
      </form>
    </div>
  )
}

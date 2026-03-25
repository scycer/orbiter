import { Command } from 'cmdk'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTasks } from '../lib/api'
import { LayoutDashboard, ListTodo, Plus, Keyboard } from 'lucide-react'
import ShortcutHelp from './ShortcutHelp'

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const navigate = useNavigate()
  const { data: tasks = [] } = useTasks()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      }
      if (e.key === '?' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault()
        setShowHelp(h => !h)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const go = (path: string) => { navigate(path); setOpen(false) }

  return (
    <>
      {open && (
        <div>
          <div className="fixed inset-0 bg-black/60 z-50" onClick={() => setOpen(false)} />
          <div className="fixed top-[20%] left-1/2 -translate-x-1/2 w-[min(90vw,500px)] z-51">
            <Command label="Command palette">
              <Command.Input placeholder="Search tasks, navigate..." />
              <Command.List>
                <Command.Empty>No results</Command.Empty>
                <Command.Group heading="Navigation">
                  <Command.Item onSelect={() => go('/')}>
                    <LayoutDashboard className="w-4 h-4" /> Dashboard
                  </Command.Item>
                  <Command.Item onSelect={() => go('/tasks')}>
                    <ListTodo className="w-4 h-4" /> All Tasks
                  </Command.Item>
                  <Command.Item onSelect={() => { setOpen(false); window.dispatchEvent(new CustomEvent('open-new-task')) }}>
                    <Plus className="w-4 h-4" /> New Task
                  </Command.Item>
                  <Command.Item onSelect={() => { setOpen(false); setShowHelp(true) }}>
                    <Keyboard className="w-4 h-4" /> Keyboard Shortcuts
                  </Command.Item>
                </Command.Group>
                {tasks.length > 0 && (
                  <Command.Group heading="Tasks">
                    {tasks.slice(0, 10).map(t => (
                      <Command.Item key={t.id} onSelect={() => go(`/tasks/${t.id}`)}>
                        <span className="text-text-secondary text-[11px] font-mono">{t.id}</span>
                        {t.title}
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
              </Command.List>
            </Command>
          </div>
        </div>
      )}
      {showHelp && <ShortcutHelp onClose={() => setShowHelp(false)} />}
    </>
  )
}

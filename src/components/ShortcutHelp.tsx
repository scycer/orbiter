import { X } from 'lucide-react'

const shortcuts = [
  { keys: ['⌘K'], desc: 'Command palette' },
  { keys: ['N'], desc: 'New task' },
  { keys: ['J'], desc: 'Next task' },
  { keys: ['K'], desc: 'Previous task' },
  { keys: ['Enter'], desc: 'Open task' },
  { keys: ['A'], desc: 'Approve (detail view)' },
  { keys: ['R'], desc: 'Reject (detail view)' },
  { keys: ['Esc'], desc: 'Go back / close' },
  { keys: ['?'], desc: 'This help' },
]

export default function ShortcutHelp({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div onClick={e => e.stopPropagation()} className="relative bg-surface border border-border rounded-xl p-5 w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">Keyboard Shortcuts</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-border/50 text-text-secondary min-w-[48px] min-h-[48px] flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-2">
          {shortcuts.map(s => (
            <div key={s.desc} className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">{s.desc}</span>
              <div className="flex gap-1">
                {s.keys.map(k => (
                  <kbd key={k} className="px-2 py-1 rounded bg-border text-[11px] font-mono text-text-secondary">{k}</kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

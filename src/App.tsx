import { useEffect, useState } from 'react'

interface HealthStatus { ok: boolean; tasks: number; uptime: number }

export default function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/health').then(r => r.json()).then(setHealth).catch(e => setError(e.message))
  }, [])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui', padding: '2rem', textAlign: 'center' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '1rem', color: '#c4b5fd' }}>Orchestrator</h1>
      {error && <div style={{ color: '#ef4444', marginBottom: '1rem' }}>API Error: {error}<br/><small style={{ color: '#888' }}>Is the Hono server running on port 3001?</small></div>}
      {health && (
        <div style={{ background: '#16161e', border: '1px solid #2a2a3a', borderRadius: '12px', padding: '1.5rem 2rem', maxWidth: '400px', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center', marginBottom: '1rem' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: health.ok ? '#22c55e' : '#ef4444' }} />
            <span style={{ color: health.ok ? '#22c55e' : '#ef4444', fontWeight: 600 }}>{health.ok ? 'System Online' : 'System Error'}</span>
          </div>
          <div style={{ color: '#888', fontSize: '0.875rem' }}>Tasks: {health.tasks} · Uptime: {Math.floor(health.uptime)}s</div>
          <div style={{ marginTop: '1.5rem', color: '#888', fontSize: '0.75rem' }}>Phase 0 complete. Claude Code is building the full UI.</div>
        </div>
      )}
      {!health && !error && <div style={{ color: '#888' }}>Connecting to API...</div>}
    </div>
  )
}

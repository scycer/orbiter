import { useState, useCallback } from 'react'
import { BookOpen, Play, CheckCircle2, XCircle, Loader2, ArrowRight } from 'lucide-react'

type TestStatus = 'idle' | 'running' | 'pass' | 'fail'
interface TestResult { name: string; status: TestStatus; detail?: string; ms?: number }

export default function Spec() {
  const [tests, setTests] = useState<TestResult[]>([])
  const [running, setRunning] = useState(false)

  const runTests = useCallback(async () => {
    setRunning(true)
    setTests([])
    const results: TestResult[] = []

    const push = (r: TestResult) => {
      results.push(r)
      setTests([...results])
    }

    // 1. Health check
    await runTest(push, 'Health endpoint returns ok', async () => {
      const res = await fetch('/api/health')
      const data = await res.json()
      assert(res.ok, `Expected 200, got ${res.status}`)
      assert(data.ok === true, `Expected ok:true, got ${JSON.stringify(data.ok)}`)
      assert(typeof data.tasks === 'number', `Expected tasks count, got ${typeof data.tasks}`)
      assert(typeof data.uptime === 'number', `Expected uptime number, got ${typeof data.uptime}`)
      return `tasks: ${data.tasks}, uptime: ${Math.floor(data.uptime)}s`
    })

    // 2. List tasks
    await runTest(push, 'GET /api/tasks returns array', async () => {
      const res = await fetch('/api/tasks')
      const data = await res.json()
      assert(res.ok, `Expected 200, got ${res.status}`)
      assert(Array.isArray(data), `Expected array, got ${typeof data}`)
      return `${data.length} tasks`
    })

    // 3. Create task
    let testTaskId = ''
    await runTest(push, 'POST /api/tasks creates a task', async () => {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '__spec_test__', description: 'Automated spec test', priority: 'low', tags: ['test'] }),
      })
      const data = await res.json()
      assert(res.status === 201, `Expected 201, got ${res.status}`)
      assert(data.id, 'Expected id in response')
      assert(data.title === '__spec_test__', `Expected title __spec_test__, got ${data.title}`)
      assert(data.status === 'pending', `Expected status pending, got ${data.status}`)
      testTaskId = data.id
      return `id: ${data.id}`
    })

    // 4. Get single task
    await runTest(push, 'GET /api/tasks/:id returns the task', async () => {
      assert(!!testTaskId, 'No test task to fetch')
      const res = await fetch(`/api/tasks/${testTaskId}`)
      const data = await res.json()
      assert(res.ok, `Expected 200, got ${res.status}`)
      assert(data.id === testTaskId, `ID mismatch`)
      assert(data.title === '__spec_test__', `Title mismatch`)
      return `fetched ${data.id}`
    })

    // 5. Update task
    await runTest(push, 'PATCH /api/tasks/:id updates fields', async () => {
      assert(!!testTaskId, 'No test task to update')
      const res = await fetch(`/api/tasks/${testTaskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'in-progress', assignee: 'spec-runner' }),
      })
      const data = await res.json()
      assert(res.ok, `Expected 200, got ${res.status}`)
      assert(data.status === 'in-progress', `Expected in-progress, got ${data.status}`)
      assert(data.assignee === 'spec-runner', `Expected assignee spec-runner, got ${data.assignee}`)
      return `status: ${data.status}, assignee: ${data.assignee}`
    })

    // 6. Status filter
    await runTest(push, 'GET /api/tasks?status= filters correctly', async () => {
      const res = await fetch('/api/tasks?status=in-progress')
      const data = await res.json()
      assert(res.ok, `Expected 200, got ${res.status}`)
      assert(Array.isArray(data), 'Expected array')
      const found = data.find((t: { id: string }) => t.id === testTaskId)
      assert(found, 'Test task not found in filtered results')
      const allMatch = data.every((t: { status: string }) => t.status === 'in-progress')
      assert(allMatch, 'Not all results have status in-progress')
      return `${data.length} in-progress tasks`
    })

    // 7. Approve
    await runTest(push, 'POST /api/tasks/:id/approve sets status approved', async () => {
      assert(!!testTaskId, 'No test task')
      const res = await fetch(`/api/tasks/${testTaskId}/approve`, { method: 'POST' })
      const data = await res.json()
      assert(res.ok, `Expected 200, got ${res.status}`)
      assert(data.status === 'approved', `Expected approved, got ${data.status}`)
      return `status: ${data.status}`
    })

    // 8. Reject
    await runTest(push, 'POST /api/tasks/:id/reject sets status rejected', async () => {
      assert(!!testTaskId, 'No test task')
      const res = await fetch(`/api/tasks/${testTaskId}/reject`, { method: 'POST' })
      const data = await res.json()
      assert(res.ok, `Expected 200, got ${res.status}`)
      assert(data.status === 'rejected', `Expected rejected, got ${data.status}`)
      return `status: ${data.status}`
    })

    // 9. Delete
    await runTest(push, 'DELETE /api/tasks/:id removes the task', async () => {
      assert(!!testTaskId, 'No test task')
      const res = await fetch(`/api/tasks/${testTaskId}`, { method: 'DELETE' })
      const data = await res.json()
      assert(res.ok, `Expected 200, got ${res.status}`)
      assert(data.ok === true, `Expected ok:true`)
      // Verify gone
      const check = await fetch(`/api/tasks/${testTaskId}`)
      assert(check.status === 404, `Expected 404 after delete, got ${check.status}`)
      return 'deleted and confirmed 404'
    })

    // 10. SSE connects
    await runTest(push, 'SSE /api/events connects and sends handshake', async () => {
      return new Promise<string>((resolve, reject) => {
        const es = new EventSource('/api/events')
        const timeout = setTimeout(() => { es.close(); reject(new Error('SSE timeout after 3s')) }, 3000)
        es.addEventListener('connected', (e) => {
          clearTimeout(timeout)
          es.close()
          const data = JSON.parse(e.data)
          resolve(`connected at ${data.time}`)
        })
        es.onerror = () => { clearTimeout(timeout); es.close(); reject(new Error('SSE connection error')) }
      })
    })

    // 11. 404 for missing task
    await runTest(push, 'GET /api/tasks/:id returns 404 for missing', async () => {
      const res = await fetch('/api/tasks/nonexistent999')
      assert(res.status === 404, `Expected 404, got ${res.status}`)
      return '404 confirmed'
    })

    setRunning(false)
  }, [])

  const passed = tests.filter(t => t.status === 'pass').length
  const failed = tests.filter(t => t.status === 'fail').length

  return (
    <div className="p-4 md:p-6 max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">App Spec</h1>
        <button
          onClick={runTests}
          disabled={running}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-accent/15 text-accent rounded-lg text-sm hover:bg-accent/25 disabled:opacity-50 min-h-[48px]"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {running ? 'Running...' : 'Run All Tests'}
        </button>
      </div>

      {/* Purpose */}
      <Section title="What This Is">
        <p>
          Orchestrator is a <strong>self-referential AI development system</strong>. It's a task
          dashboard that manages its own development — the app you're looking at was built by
          Claude Code agents picking up tasks from this very system.
        </p>
        <p className="mt-2">
          Daniel creates tasks describing features, bugs, or improvements. <strong>Claude Code
          agents</strong> claim tasks via the API, make changes to the codebase, and submit results
          for human review. Daniel approves or rejects from the dashboard, and the cycle continues.
        </p>
        <p className="mt-2">
          It's the <strong>human-in-the-loop control plane</strong> — the place where you see what
          every agent is doing, what needs attention, and what's been completed.
        </p>
      </Section>

      {/* Architecture */}
      <Section title="Environments">
        <p className="mb-3">Two fully isolated environments — separate APIs, separate data:</p>
        <div className="space-y-2">
          <div className="bg-bg border border-border rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-success" />
              <strong className="text-sm">Production</strong>
              <code className="text-xs text-accent ml-auto">orchestrator-devbox.danhoek.dev</code>
            </div>
            <p className="text-xs text-text-secondary">Built static app served by Hono API on :3001. Data in <code>./data/tasks.json</code>.</p>
          </div>
          <div className="bg-bg border border-border rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-warning" />
              <strong className="text-sm">Development</strong>
              <code className="text-xs text-accent ml-auto">dev-orchestrator-devbox.danhoek.dev</code>
            </div>
            <p className="text-xs text-text-secondary">Vite dev server with HMR. Own API on :3002. Data in <code>./data-dev/tasks.json</code>.</p>
          </div>
        </div>
        <p className="mt-3 text-xs">Environments are fully isolated — changes to dev data never affect prod.</p>
      </Section>

      {/* Containers */}
      <Section title="Container Architecture">
        <p className="mb-3">Everything runs in Docker Compose on a single VPS:</p>
        <pre className="bg-bg border border-border rounded-lg p-3 text-xs font-mono text-text-secondary overflow-x-auto">{`docker compose up
├── prod        Hono: static dist/ + API    :3001  ./data/
├── dev-api     Hono: API only              :3002  ./data-dev/
├── dev         Vite dev server + HMR       :5173  → dev-api:3002
└── tunnel      cloudflared → Cloudflare edge`}</pre>
        <div className="mt-3 space-y-1.5 text-xs text-text-secondary">
          <p><strong className="text-text">prod</strong> — Multi-stage Docker build. Serves built static app + API. Uses <code>./data/</code> for prod tasks.</p>
          <p><strong className="text-text">dev-api</strong> — Same Hono image, different port + data dir. Uses <code>./data-dev/</code> for dev tasks.</p>
          <p><strong className="text-text">dev</strong> — Mounts the full repo for live editing. Proxies <code>/api</code> to dev-api on :3002.</p>
          <p><strong className="text-text">tunnel</strong> — Cloudflare Tunnel (host network mode). Routes both hostnames through Cloudflare Access.</p>
        </div>
        <p className="mt-2 text-xs">To deploy changes: <code className="text-accent">docker compose build prod && docker compose up -d prod</code></p>
      </Section>

      {/* Task Lifecycle */}
      <Section title="Task Lifecycle">
        <p className="mb-3">Every task follows this flow. Transitions happen via the API or UI.</p>
        <div className="bg-bg border border-border rounded-xl p-4 overflow-x-auto">
          <Flow steps={[
            { label: 'pending', desc: 'Created, waiting to be picked up', color: 'text-text-secondary' },
            { label: 'assigned', desc: 'Claimed by an agent', color: 'text-text-secondary' },
            { label: 'in-progress', desc: 'Agent is actively working', color: 'text-accent' },
            { label: 'review', desc: 'Work done, awaiting human review', color: 'text-warning' },
          ]} />
          <div className="flex items-center gap-3 mt-3 ml-4">
            <ArrowRight className="w-4 h-4 text-text-secondary shrink-0" />
            <div className="flex gap-3">
              <span className="px-3 py-1.5 rounded-lg bg-success/15 text-success text-xs">approved</span>
              <span className="text-text-secondary text-xs pt-1.5">or</span>
              <span className="px-3 py-1.5 rounded-lg bg-error/15 text-error text-xs">rejected</span>
            </div>
            <ArrowRight className="w-4 h-4 text-text-secondary shrink-0" />
            <span className="px-3 py-1.5 rounded-lg bg-success/15 text-success text-xs">done</span>
          </div>
        </div>
        <div className="mt-3 space-y-1.5 text-sm text-text-secondary">
          <p><strong className="text-text">pending → assigned:</strong> An agent claims the task (PATCH status + assignee).</p>
          <p><strong className="text-text">assigned → in-progress:</strong> Agent begins work.</p>
          <p><strong className="text-text">in-progress → review:</strong> Agent finishes and sets output with results.</p>
          <p><strong className="text-text">review → approved/rejected:</strong> Daniel reviews in the UI. Approve (A key) or reject (R key). Rejected tasks can be re-assigned.</p>
          <p><strong className="text-text">approved → done:</strong> Final state. Task is complete.</p>
        </div>
      </Section>

      {/* The Agent */}
      <Section title="The Agent: /agent Command">
        <p className="mb-3">
          Agents are <strong>Claude Code sessions</strong> running on the devbox. The <code className="text-accent">/agent</code> slash
          command automates the full workflow:
        </p>
        <div className="bg-bg border border-border rounded-xl p-4 space-y-2 font-mono text-xs text-text-secondary">
          <p className="text-text"># In Claude Code, run:</p>
          <p className="text-accent">/agent</p>
          <p className="text-text-secondary mt-2"># Or target a specific task:</p>
          <p className="text-accent">/agent seed0001</p>
        </div>
        <p className="mt-3 mb-2">What happens:</p>
        <ol className="list-decimal list-inside space-y-1.5 text-sm text-text-secondary">
          <li>Fetches pending tasks from the API, picks highest priority</li>
          <li>Claims the task (<code className="text-accent">status: assigned, assignee: claude</code>)</li>
          <li>Sets status to <code className="text-accent">in-progress</code></li>
          <li>Reads the codebase, makes changes, runs type checks</li>
          <li>Submits for review with an output summary</li>
        </ol>
        <p className="mt-3 text-xs text-text-secondary">
          The agent has access to Read, Write, Edit, Bash, Glob, Grep, and Agent tools.
          It follows CLAUDE.md conventions and runs <code className="text-accent">npx tsc --noEmit</code> before submitting.
        </p>
      </Section>

      {/* API Flow */}
      <Section title="Agent API Flow">
        <p className="mb-3">Under the hood, the agent makes these API calls:</p>
        <div className="bg-bg border border-border rounded-xl p-4 space-y-2 font-mono text-xs text-text-secondary">
          <p className="text-text-secondary"># 1. Find pending tasks</p>
          <p className="text-accent">GET /api/tasks?status=pending</p>
          <p className="text-text-secondary mt-3"># 2. Claim one</p>
          <p className="text-accent">PATCH /api/tasks/:id</p>
          <p className="text-text-secondary pl-4">{`{ "status": "assigned", "assignee": "claude" }`}</p>
          <p className="text-text-secondary mt-3"># 3. Start working</p>
          <p className="text-accent">PATCH /api/tasks/:id</p>
          <p className="text-text-secondary pl-4">{`{ "status": "in-progress" }`}</p>
          <p className="text-text-secondary mt-3"># 4. Submit results for review</p>
          <p className="text-accent">PATCH /api/tasks/:id</p>
          <p className="text-text-secondary pl-4">{`{ "status": "review", "output": "Summary of changes..." }`}</p>
          <p className="text-text-secondary mt-3"># 5. Daniel reviews in UI → approves or rejects</p>
        </div>
      </Section>

      {/* Real-time */}
      <Section title="Real-time Updates">
        <p className="mb-2">
          When any task changes (created, updated, deleted) — from the UI, an agent, or any API call —
          the server broadcasts the change to all connected clients via <strong>Server-Sent Events</strong>.
        </p>
        <div className="bg-bg border border-border rounded-xl p-4 space-y-1.5 font-mono text-xs text-text-secondary">
          <p className="text-text-secondary"># SSE events emitted:</p>
          <p><span className="text-accent">task:created</span> — new task added</p>
          <p><span className="text-accent">task:updated</span> — any field changed (status, assignee, output, etc.)</p>
          <p><span className="text-accent">task:deleted</span> — task removed</p>
        </div>
        <p className="mt-2 text-sm text-text-secondary">
          The UI auto-refreshes via react-query invalidation on every SSE event.
          If an agent updates a task via the API, the dashboard updates instantly without polling.
        </p>
      </Section>

      {/* Human Review Flow */}
      <Section title="Human Review Flow">
        <p className="mb-2">When a task enters <strong>review</strong> status:</p>
        <ol className="list-decimal list-inside space-y-1.5 text-sm text-text-secondary">
          <li>Task appears on the <strong className="text-text">Dashboard</strong> in the activity feed</li>
          <li>Daniel opens the task detail view (click or Enter key)</li>
          <li>Reads the <strong className="text-text">output</strong> field — the agent's work summary</li>
          <li>Presses <kbd className="px-1.5 py-0.5 rounded bg-border text-[10px] font-mono">A</kbd> to approve or <kbd className="px-1.5 py-0.5 rounded bg-border text-[10px] font-mono">R</kbd> to reject</li>
          <li>If rejected, the task can be reassigned to an agent for another attempt</li>
        </ol>
      </Section>

      {/* Priority System */}
      <Section title="Priority System">
        <p className="mb-3">Tasks are sorted by priority in the task list. Visual indicators:</p>
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 rounded-full bg-error" />
            <span className="text-sm"><strong className="text-error">urgent</strong> — needs immediate attention, shown in dashboard alert</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 rounded-full bg-warning" />
            <span className="text-sm"><strong className="text-warning">high</strong> — important, do soon</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 rounded-full bg-accent" />
            <span className="text-sm"><strong className="text-accent">medium</strong> — default priority</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 rounded-full bg-text-secondary" />
            <span className="text-sm"><strong className="text-text-secondary">low</strong> — backlog / nice to have</span>
          </div>
        </div>
      </Section>

      {/* Test Results */}
      <div className="bg-surface border border-border rounded-xl p-4 md:p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold">API Contract Tests</h2>
          </div>
          {tests.length > 0 && (
            <div className="flex items-center gap-3 text-xs">
              <span className="text-success">{passed} passed</span>
              {failed > 0 && <span className="text-error">{failed} failed</span>}
            </div>
          )}
        </div>

        {tests.length === 0 && !running && (
          <p className="text-sm text-text-secondary">
            Click "Run All Tests" to execute live API tests. Creates a test task, runs it through the full lifecycle, then cleans up.
          </p>
        )}

        <div className="space-y-1">
          {tests.map((t, i) => (
            <div key={i} className="flex items-start gap-2.5 py-1.5">
              {t.status === 'running' && <Loader2 className="w-4 h-4 text-accent animate-spin shrink-0 mt-0.5" />}
              {t.status === 'pass' && <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />}
              {t.status === 'fail' && <XCircle className="w-4 h-4 text-error shrink-0 mt-0.5" />}
              {t.status === 'idle' && <div className="w-4 h-4 rounded-full border border-border shrink-0 mt-0.5" />}
              <div className="min-w-0">
                <div className="text-sm">{t.name}</div>
                {t.detail && (
                  <div className={`text-xs font-mono mt-0.5 ${t.status === 'fail' ? 'text-error' : 'text-text-secondary'}`}>
                    {t.detail}
                    {t.ms !== undefined && <span className="text-text-secondary ml-2">({t.ms}ms)</span>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Helpers

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4 md:p-5">
      <h2 className="text-sm font-semibold mb-3">{title}</h2>
      <div className="text-sm text-text-secondary">{children}</div>
    </div>
  )
}

function Flow({ steps }: { steps: { label: string; desc: string; color: string }[] }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {steps.map((s, i) => (
        <div key={s.label} className="flex items-center gap-2">
          {i > 0 && <ArrowRight className="w-4 h-4 text-text-secondary shrink-0" />}
          <div className="text-center">
            <div className={`px-3 py-1.5 rounded-lg bg-border/50 text-xs font-medium ${s.color}`}>{s.label}</div>
            <div className="text-[10px] text-text-secondary mt-1 max-w-[100px]">{s.desc}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg)
}

async function runTest(
  push: (r: TestResult) => void,
  name: string,
  fn: () => Promise<string>,
) {
  push({ name, status: 'running' })
  const start = performance.now()
  try {
    const detail = await fn()
    const ms = Math.round(performance.now() - start)
    push({ name, status: 'pass', detail, ms })
  } catch (e) {
    const ms = Math.round(performance.now() - start)
    push({ name, status: 'fail', detail: e instanceof Error ? e.message : String(e), ms })
  }
}

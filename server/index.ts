import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { readFileSync, writeFileSync, existsSync, renameSync } from 'fs'
import { randomUUID } from 'crypto'

const app = new Hono()
const DATA_FILE = process.env.DATA_FILE || './data/tasks.json'
const PORT = parseInt(process.env.PORT || '3001', 10)
const startTime = Date.now()
const sseClients = new Set<ReadableStreamDefaultController>()

function broadcast(event: string, data: unknown) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const c of sseClients) { try { c.enqueue(new TextEncoder().encode(msg)) } catch { sseClients.delete(c) } }
}

interface Task { id: string; title: string; description: string; status: string; priority: string; assignee?: string; createdAt: string; updatedAt: string; output?: string; tags: string[] }

function readTasks(): Task[] { if (!existsSync(DATA_FILE)) return []; try { return JSON.parse(readFileSync(DATA_FILE, 'utf-8')) } catch { return [] } }
function writeTasks(tasks: Task[]) { const tmp = DATA_FILE + '.tmp'; writeFileSync(tmp, JSON.stringify(tasks, null, 2)); renameSync(tmp, DATA_FILE) }

app.use('*', cors())
app.get('/api/health', (c) => { const t = readTasks(); return c.json({ ok: true, tasks: t.length, uptime: (Date.now() - startTime) / 1000 }) })
app.get('/api/events', (c) => {
  const stream = new ReadableStream({ start(ctrl) { sseClients.add(ctrl); ctrl.enqueue(new TextEncoder().encode(`event: connected\ndata: ${JSON.stringify({ time: new Date().toISOString() })}\n\n`)) }, cancel() {} })
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' } })
})
app.get('/api/tasks', (c) => { let t = readTasks(); const s = c.req.query('status'); if (s) t = t.filter(x => x.status === s); return c.json(t) })
app.post('/api/tasks', async (c) => { const b = await c.req.json(); const t = readTasks(); const task = { id: randomUUID().slice(0,8), title: b.title||'Untitled', description: b.description||'', status: b.status||'pending', priority: b.priority||'medium', assignee: b.assignee, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), output: b.output, tags: b.tags||[] }; t.push(task); writeTasks(t); broadcast('task:created', task); return c.json(task, 201) })
app.get('/api/tasks/:id', (c) => { const t = readTasks().find(x => x.id === c.req.param('id')); return t ? c.json(t) : c.json({ error: 'Not found' }, 404) })
app.patch('/api/tasks/:id', async (c) => { const b = await c.req.json(); const t = readTasks(); const i = t.findIndex(x => x.id === c.req.param('id')); if (i===-1) return c.json({error:'Not found'},404); t[i] = { ...t[i], ...b, updatedAt: new Date().toISOString() }; writeTasks(t); broadcast('task:updated', t[i]); return c.json(t[i]) })
app.post('/api/tasks/:id/approve', (c) => { const t = readTasks(); const i = t.findIndex(x => x.id === c.req.param('id')); if (i===-1) return c.json({error:'Not found'},404); t[i] = { ...t[i], status:'approved', updatedAt: new Date().toISOString() }; writeTasks(t); broadcast('task:updated', t[i]); return c.json(t[i]) })
app.post('/api/tasks/:id/reject', (c) => { const t = readTasks(); const i = t.findIndex(x => x.id === c.req.param('id')); if (i===-1) return c.json({error:'Not found'},404); t[i] = { ...t[i], status:'rejected', updatedAt: new Date().toISOString() }; writeTasks(t); broadcast('task:updated', t[i]); return c.json(t[i]) })
app.delete('/api/tasks/:id', (c) => { const t = readTasks(); const i = t.findIndex(x => x.id === c.req.param('id')); if (i===-1) return c.json({error:'Not found'},404); const [r] = t.splice(i,1); writeTasks(t); broadcast('task:deleted', {id:r.id}); return c.json({ok:true}) })

// Serve static files from dist/ (prod)
app.use('*', serveStatic({ root: './dist' }))

// SPA fallback — serve index.html for any non-API route
app.get('*', (c) => {
  try {
    const html = readFileSync('./dist/index.html', 'utf-8')
    return c.html(html)
  } catch {
    return c.text('Not found', 404)
  }
})

console.log(`Hono API running on http://localhost:${PORT} (data: ${DATA_FILE})`)
serve({ fetch: app.fetch, port: PORT })

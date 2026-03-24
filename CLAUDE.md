# CLAUDE.md — Orchestrator Dashboard

## What This Is
A React + TypeScript PWA served from a VPS for orchestrating AI agents.
Single user (Daniel). Accessed via Cloudflare tunnel on tablet/phone/desktop.

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + vite-plugin-pwa
- **Backend**: Hono (TypeScript) running on Node via tsx
- **State**: File-based JSON store in `./data/` (NOT a database — keep it simple)
- **Real-time**: Server-Sent Events (SSE) from Hono to React
- **Routing**: react-router-dom v7
- **UI components**: Build from scratch with Tailwind. No component library.
- **Icons**: lucide-react
- **Command palette**: cmdk
- **Toasts**: sonner

## Architecture Rules
1. Vite dev server proxies `/api/*` to the Hono server on port 3001
2. All API routes are in `server/` — Hono serves JSON and SSE
3. All UI code is in `src/` — standard React SPA
4. Data is stored in `./data/tasks.json` — read/write with fs
5. SSE endpoint at `/api/events` pushes task updates to all connected clients
6. The app MUST work on mobile/tablet (responsive, touch-friendly)
7. Dark theme ONLY. Muted colors. No pure white. No high contrast animations.
8. Minimum touch target 48px on all interactive elements

## Design System
- Background: #0f0f17 (near black)
- Surface: #16161e (dark gray)
- Border: #2a2a3a
- Text primary: #e0e0e0
- Text secondary: #888
- Accent: #c4b5fd (soft purple)
- Success: #22c55e
- Warning: #f59e0b
- Error: #ef4444
- Font: system-ui, -apple-system, sans-serif
- Monospace: 'JetBrains Mono', 'Fira Code', monospace

## Task Data Model
```typescript
interface Task {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'assigned' | 'in-progress' | 'review' | 'approved' | 'rejected' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignee?: string;
  createdAt: string;
  updatedAt: string;
  output?: string;
  tags: string[];
}
```

## API Routes
```
GET    /api/tasks              — list all tasks (supports ?status= filter)
POST   /api/tasks              — create task
GET    /api/tasks/:id          — get single task
PATCH  /api/tasks/:id          — update task (partial)
POST   /api/tasks/:id/approve  — shortcut: set status to 'approved'
POST   /api/tasks/:id/reject   — shortcut: set status to 'rejected'
DELETE /api/tasks/:id          — delete task
GET    /api/events             — SSE stream of task changes
GET    /api/health             — health check (returns { ok: true, tasks: count })
```

## Keyboard Shortcuts
- Ctrl+K / Cmd+K — Command palette
- n — New task (when not in an input)
- j / k — Navigate task list up/down
- Enter — Open selected task
- a — Approve task (in detail view)
- r — Reject task (in detail view)
- Escape — Close modals, go back
- ? — Show keyboard shortcut help

## What NOT To Do
- Don't add a database. File JSON is intentional.
- Don't add authentication — Cloudflare Access handles that.
- Don't add SSR/Next.js — this is a Vite SPA.
- Don't use a CSS-in-JS solution — Tailwind only.
- Don't add Redux/Zustand — react-query + local state is enough.

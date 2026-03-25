---
description: Pick up a task from the Orchestrator, do the work, and submit for review
argument-hint: [task-id]
allowed-tools: [Read, Write, Edit, Bash, Glob, Grep, Agent]
---

# Orchestrator Agent

You are an autonomous agent working on the Orchestrator project. Your job is to pick up a task, do the work in the codebase, and submit your results for review.

## API

The Orchestrator API runs at `http://localhost:3001`. All task operations go through this API.

## Workflow

### Step 1: Find a task

If a task ID was provided as an argument (`$ARGUMENTS`), fetch that specific task:

```
GET http://localhost:3001/api/tasks/{id}
```

Otherwise, list pending tasks and pick the highest priority one:

```
GET http://localhost:3001/api/tasks?status=pending
```

Show the user what task you're picking up. If there are no pending tasks, inform the user and stop.

### Step 2: Claim the task

```
PATCH http://localhost:3001/api/tasks/{id}
Content-Type: application/json

{ "status": "assigned", "assignee": "claude" }
```

### Step 3: Start working

```
PATCH http://localhost:3001/api/tasks/{id}
Content-Type: application/json

{ "status": "in-progress" }
```

Now do the actual work described in the task. You have full access to the codebase at `/root/dev/orbiter`. Use your tools to:

- Read and understand relevant code
- Make the necessary changes
- Run type checks (`npx tsc --noEmit`)
- Test that your changes work

### Step 4: Submit for review

When done, update the task with your results:

```
PATCH http://localhost:3001/api/tasks/{id}
Content-Type: application/json

{
  "status": "review",
  "output": "Summary of what you did, what files you changed, and how to verify."
}
```

## Rules

- Always run `npx tsc --noEmit` before submitting
- Follow the project conventions in CLAUDE.md
- Dark theme only, Tailwind only, no component libraries
- Keep changes focused on the task — don't refactor unrelated code
- If the task is unclear, update the task output with your questions and set status to "review" so the human can clarify
- If you're rebuilding the frontend, run `docker compose build prod && docker compose up -d prod` to deploy

# Agentix Orchestration System — Master Plan

**Owner:** Dan H, CTO / Tech Lead
**Product Owner:** Justin
**Context:** 12-person company, ~$30M ARR legacy products, shipping one new LXP product (Next.js/Vercel/Supabase). Dan going on 5-week holiday with ad-hoc availability (few hours/day). Two senior devs, one junior + COO learning to code. Justin (PO) is primary bottleneck.

---

## 1. The System Diagnosis

### What's actually happening

Dan is the human routing layer. Every decision, every context translation, every quality check flows through one person. The company has tools (ClickUp, GitHub, Slack, deployment platforms) but no connective tissue between them — Dan *is* the connective tissue.

### The two vicious cycles

**Cycle A — The Context Gap:**
Justin needs information → information is scattered across tools → Justin is slow to decide → work stalls → Dan steps in to unblock → Dan becomes more central → less gets externalized → information stays scattered → repeat

**Cycle B — The Standards Drift:**
No enforced templates in ClickUp → tickets are messy → Dan spends hours reorganizing → team learns Dan will fix it → less incentive to follow standards → tickets stay messy → repeat

### The leverage point

Both cycles share one root cause: **the rules are in Dan's head, not in the system.** Externalizing those rules is the single highest-leverage action. Everything else — webhooks, automations, dashboards — is plumbing. The rules are the water.

---

## 2. The Scorecard (3 Metrics Only)

Track weekly. Start with manual collection if needed. Automate later.

| #   | Metric                                | What It Measures   | Target Direction | How to Collect                                                                                              |
| --- | ------------------------------------- | ------------------ | ---------------- | ----------------------------------------------------------------------------------------------------------- |
| 1   | **Decisions made without Dan**        | Team independence  | ↑ Up             | Count Slack DMs/mentions to Dan that are questions. Track how many the system or team handles autonomously. |
| 2   | **Cycle time: "ready" → "in review"** | Execution velocity | ↓ Down           | ClickUp timestamps on status changes. Pull via MCP/API weekly.                                              |
| 3   | **PO decision queue age**             | Bottleneck health  | ↓ Down           | ClickUp items assigned to or waiting on PO — average age in days.                                           |

**Why these three:** Metric 1 tells you if the brain-export is working. Metric 2 tells you if the team is actually shipping. Metric 3 tells you if the biggest human bottleneck is improving. Everything else is vanity until these move.

---

## 3. Infrastructure Architecture

### Stack

```
┌─────────────────────────────────────────────────┐
│  Android Tablet                                  │
│  → Cloudflare Zero Trust tunnel                  │
│  → VS Code Server (browser-based dev)            │
└──────────────┬──────────────────────────────────┘
               │ HTTPS
┌──────────────▼──────────────────────────────────┐
│  Digital Ocean VPS (Ubuntu)                      │
│  ┌────────────────────────────────────────────┐  │
│  │  Docker Compose                            │  │
│  │                                            │  │
│  │  ┌──────────────┐  ┌───────────────────┐   │  │
│  │  │ VS Code      │  │ Agentix           │   │  │
│  │  │ Server       │  │ (Node.js/TS)      │   │  │
│  │  │ Port 8443    │  │ Port 3000         │   │  │
│  │  └──────────────┘  │                   │   │  │
│  │                     │ - Webhook receiver│   │  │
│  │  ┌──────────────┐  │ - MCP clients     │   │  │
│  │  │ SQLite/      │  │ - Rules engine    │   │  │
│  │  │ Postgres     │  │ - Claude API      │   │  │
│  │  │ (metrics +   │  │ - Metrics logger  │   │  │
│  │  │  state)      │  └───────────────────┘   │  │
│  │  └──────────────┘                          │  │
│  └────────────────────────────────────────────┘  │
│                                                   │
│  Cloudflare Tunnel (zero trust)                   │
└──────────────┬──────────────────────────────────┘
               │
    ┌──────────▼──────────┐
    │  Incoming Webhooks   │
    │  - ClickUp events    │
    │  - GitHub events     │
    │  - Slack events      │
    └─────────────────────┘
```

### Docker Compose Services

1. **code-server** — VS Code in browser, your dev environment from the tablet
2. **agentix** — The orchestration brain (your existing TS codebase)
3. **db** — SQLite (simple) or Postgres (if you want more later) for metrics, state, decision logs
4. **cloudflared** — Cloudflare tunnel daemon

### Webhook Endpoints (Agentix)

```
POST /webhooks/clickup    → ticket created, updated, status changed, comment added
POST /webhooks/github     → PR opened, review requested, checks passed/failed
POST /webhooks/slack      → messages in key channels, DMs to Agentix bot
GET  /health              → uptime check
GET  /metrics             → scorecard dashboard (simple HTML)
```

---

## 4. The Decision Playbook (Write This First)

This is the single most important deliverable before the holiday. It's a structured set of markdown files that Agentix can reference when making decisions.

### Structure

```
/playbook
  /standards
    ticket-template.md        → what a good ClickUp ticket looks like
    definition-of-done.md     → when a task is actually done
    pr-standards.md           → what a mergeable PR looks like
    naming-conventions.md     → code, branches, tickets
  /architecture
    tech-decisions.md         → stack choices and WHY (so team doesn't re-debate)
    patterns.md               → established code patterns in the LXP codebase
    boundaries.md             → what NOT to do, anti-patterns, known pitfalls
  /process
    escalation-rules.md       → when to decide yourself vs. wait for Dan
    priority-framework.md     → how to decide what to work on next
    release-process.md        → how code gets to production
  /context
    product-vision.md         → what the LXP is, who it's for, what matters
    current-sprint-goals.md   → what the team is focused on RIGHT NOW
    known-debt.md             → tech debt the team knows about, prioritized
  /qa
    common-questions.md       → the 20 questions Dan gets asked most, answered
    decision-log.md           → past decisions and their rationale
```

### How to write these fast

Don't write essays. Each file should be:
- **Rule/Standard:** one sentence
- **Why:** one sentence
- **Example of good:** a concrete example
- **Example of bad:** a concrete example
- **When to escalate:** the boundary condition

Example entry in `ticket-template.md`:
```markdown
## Every ticket must have:
- A clear outcome statement (what is true when this is done?)
- Acceptance criteria (how do we verify it?)
- Link to parent user story or feature
- Estimated scope: S/M/L

## Why
Without these, devs guess at scope and intent. Dan ends up clarifying in Slack.

## Good example
"As a learner, I can see my progress on the dashboard.
AC: Progress bar shows % of modules completed. Updates on page load.
Parent: US-142. Size: M"

## Bad example
"Fix the dashboard progress thing"

## Escalation
If you can't write the outcome statement, the work isn't defined enough yet.
Tag PO for clarification before starting.
```

**Time estimate:** 4-6 hours total to write v1 of the playbook. This is worth more than any code you write this week.

---

## 5. The Three Autonomous Loops

Build these in order. Each one is a complete feedback loop: trigger → reason → act → measure.

### Loop 1: The Ticket Guardian (Build Before Holiday)

**Purpose:** Break Cycle B. Stop Dan from being the ticket cleaner.

```
TRIGGER:  ClickUp webhook → ticket created or moved to "Ready"
OBSERVE:  Pull ticket content via MCP
REASON:   Compare against playbook/standards/ticket-template.md
          Ask: does it have outcome, AC, link, size?
DECIDE:   Score completeness 0-100%
ACT:      If < 80%: comment on ticket with specific gaps
          "This ticket is missing acceptance criteria. See [template link]."
          If >= 80%: do nothing (don't create noise for good tickets)
MEASURE:  Log: ticket_id, score, gaps_found, timestamp
          Weekly metric: % of tickets that pass on first creation
```

**Escalation boundary:** Never blocks anyone. Only comments with guidance. No enforcement — just visibility.

### Loop 2: The Context Router (Build Before Holiday)

**Purpose:** Break Cycle A. Replace Dan as the "who should I ask / where is that info" person.

```
TRIGGER:  Slack message to @agentix or in #ask-agentix channel
          OR ClickUp Q&A list item created
OBSERVE:  Parse the question
          Pull relevant context: ClickUp tasks, GitHub recent PRs,
          playbook files, decision log
REASON:   Can I answer this from the playbook + tool context?
          Confidence: high / medium / low
DECIDE:   High confidence: answer directly, cite source
          Medium: answer with caveat, suggest verification
          Low: say "I don't have enough context. Here's what I found.
               Escalate to [senior dev] or wait for Dan's async check-in."
ACT:      Post response in Slack thread or ClickUp comment
MEASURE:  Log: question, confidence, answered_autonomously (bool),
          escalated_to, timestamp
          Weekly metric: autonomous answer rate (this IS scorecard metric 1)
```

**Escalation boundary:** Senior dev is the human fallback, not Dan. Dan reviews the escalation log in his async check-in (30 min, twice a week max).

### Loop 3: Justin Decision Accelerator (Build After Holiday — Phase 2)

**Purpose:** Directly attack Justin bottleneck.

```
TRIGGER:  Daily at 8am (cron) OR on-demand from PO
OBSERVE:  Scan ClickUp for items assigned to / waiting on PO
          Pull context: related tickets, recent Slack threads,
          any linked docs or prototypes
REASON:   For each item, summarize:
          - What decision is needed
          - What context exists already
          - What the playbook/priority framework suggests
          - How long it's been waiting
DECIDE:   Rank by: age × impact (linked to how many tasks are blocked)
ACT:      Post daily digest to PO in Slack DM or dedicated channel:
          "You have 4 decisions pending. Here's the priority order
          and the context for each. #1 is blocking 3 dev tasks."
MEASURE:  Log: items_pending, avg_age, items_resolved_today
          Weekly metric: PO decision queue age (scorecard metric 3)
```

**Escalation boundary:** Never makes decisions for Justin. Only surfaces, summarizes, and prioritizes.

---

## 6. Timeline

### This Week (Before Holiday)

| Day | Task                                                                              | Hours | Output                                  |
| --- | --------------------------------------------------------------------------------- | ----- | --------------------------------------- |
| 1   | Write the Decision Playbook — standards + process sections                        | 3-4h  | /playbook v1 (standards, process, QA)   |
| 2   | Write the Decision Playbook — architecture + context sections                     | 2-3h  | /playbook v1 complete                   |
| 2   | Set up DO VPS: Docker Compose, code-server, Cloudflare tunnel                     | 2h    | Working remote dev environment          |
| 3   | Build Loop 1 (Ticket Guardian): webhook receiver + ClickUp MCP + template checker | 3-4h  | Tickets get auto-commented on gaps      |
| 4   | Build Loop 2 (Context Router): Slack bot + playbook search + ClickUp/GitHub MCP   | 3-4h  | Team can ask questions to @agentix      |
| 5   | Test both loops with the senior devs. Tune confidence thresholds. Brief the team. | 2-3h  | Team knows how to use it, Dan can leave |

**Total: ~16-20 hours across 5 days. Aggressive but focused.**

### During Holiday (5 Weeks — Ad-Hoc, Few Hours/Day)

**Week 1-2: Observe and tune**
- Check metrics log daily (15 min)
- Review escalation log twice per week (30 min each)
- Tune confidence thresholds and playbook based on what the system gets wrong
- Add to common-questions.md as new questions surface
- Do NOT add features. Just make the existing loops more accurate.

**Week 3-4: Stabilize and measure**
- Generate first weekly scorecards
- Compare week 3-4 metrics to week 1-2: is autonomous answer rate going up? Is ticket quality improving?
- Start sketching Loop 3 (PO accelerator) design based on observed PO bottleneck patterns
- If loops are stable: reduce check-in to 3x/week

**Week 5: Prepare for return**
- Full scorecard review: what moved, what didn't
- Document what surprised you — these become v2 design inputs
- Identify top 3 things to build in Phase 2

### After Holiday (Phase 2 — Weeks 6-10)

- Build Loop 3 (PO Decision Accelerator)
- Add ClickUp → GitHub context bridge (link PRs to tickets automatically, surface relevant code context in ticket comments)
- Build the metrics dashboard (replace manual collection with automated scorecard)
- Start loosening escalation boundaries on Loops 1 and 2 based on data
- Introduce the reinforcing loop: better metrics → looser boundaries → more autonomy → better metrics

---

## 7. Principles to Hold Onto

1. **Rules before code.** Every hour spent writing the playbook saves 10 hours of automation tweaking. The AI is only as good as the judgment you give it.

2. **Measure the outcome, not the activity.** "Agentix processed 47 webhooks" means nothing. "The team made 12 decisions without Dan this week, up from 3" means everything.

3. **Escalation boundaries are the design.** The automation logic is easy. Knowing when to stop and ask a human — that's the hard engineering. Start tight, loosen with data.

4. **Justin is the bottleneck, not the devs.** Most of your instinct will be to automate dev workflows (code review, CI, etc.). Resist that. The highest-leverage automation is the one that helps Justin make faster decisions, because every hour he's blocked, 2-3 devs are blocked downstream.

5. **Don't automate what you haven't standardized.** If there's no written rule for what a good ticket looks like, no AI can enforce it. Write the rule, THEN automate the enforcement.

6. **The system should make Dan less necessary, not more productive.** There's a subtle but critical difference. "Dan can do more" keeps Dan as the bottleneck. "The team needs Dan less" removes the bottleneck entirely.

7. **Start boring.** Webhook + check against template + comment if gaps = boring. Also: it works on day one and provides data immediately. Fancy reasoning chains that sometimes fail are worse than simple rules that always work.

---

## 8. Technical Notes

### MCP Server Reliability

You mentioned MCP to ClickUp is "hacky and sometimes fails." Before holiday:
- Add retry logic (3 attempts, exponential backoff)
- Add a dead-letter queue: if MCP call fails after retries, log it and move on. Don't let one failed call block the loop.
- Add health-check ping every 5 min. If MCP server is down, post to Slack: "ClickUp MCP is down, restarting." Auto-restart the container.

### State and Logging

Use SQLite (single file, zero config, perfect for a one-VPS setup):
```
decisions        → every autonomous decision: what, why, confidence, outcome
escalations      → every escalation: what, to whom, resolved (bool), how
metrics_weekly   → scorecard snapshots
playbook_hits    → which playbook files are referenced most (shows what's useful)
```

This log IS your feedback data. When you review weekly, you're reading this to find patterns.

### Claude API Usage

For the reasoning layer, use Claude Sonnet (fast, cheap, good enough for rule-checking and context summarization). Reserve Opus for complex architectural questions if you route those through the system later. Structure every prompt as:

```
SYSTEM: You are an AI assistant for a development team. You have access to
the team's decision playbook and project management tools.

Your job is to [specific loop purpose].

Rules you must follow:
[inject relevant playbook sections]

Context from tools:
[inject ClickUp/GitHub data from MCP]

Confidence calibration:
- HIGH: the playbook explicitly covers this, and the data is clear
- MEDIUM: the playbook is relevant but the situation has nuance
- LOW: this is outside what the playbook covers

Always state your confidence. If LOW, escalate. Never guess.
```

### Security While Away

- Cloudflare Zero Trust: only your devices can access code-server and Agentix admin
- Webhook endpoints: validate signatures (ClickUp, GitHub, Slack all support HMAC verification)
- Claude API key: use environment variable, never in code
- VPS: enable DO firewall, only allow ports 443 (Cloudflare tunnel) and SSH (your IP only)

---

## 9. What Success Looks Like

**After 5 weeks away, if this works, you'll see:**

- The senior dev ran the team without messaging you daily
- ClickUp tickets are measurably more complete (Ticket Guardian data)
- The team asked 50+ questions to Agentix and got useful answers for 60%+ of them
- You have a log of every decision the system made and every escalation it flagged
- You know exactly where the system fell short, which tells you exactly what to build next
- Justin's decision queue is visible and measured, even if not yet automated

**The real test:** When you get back, do you slot back in as the routing layer? Or does the team say "we've got a rhythm, here's what we need from you"? If it's the latter, the system worked.
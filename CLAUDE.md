# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Orbiter is a two-phase project for AI agent development infrastructure:

- **Phase 1 (complete):** `do-dev-box-test/` — Parallel benchmarking of 4 DigitalOcean regions, selecting optimal region (TOR1 won) for AI agent workloads.
- **Phase 2 (planned):** Agentix orchestration system — 3 autonomous decision loops (Ticket Guardian, Context Router, PO Decision Accelerator) for team workflow automation.

The strategic blueprint lives in `Agentix Orchestration System — Master Plan.md`.

## Technology

This is infrastructure automation, not a traditional app. No package.json or build system.

- **Orchestration:** Bash scripts + Docker
- **Infrastructure:** DigitalOcean (doctl CLI, wrapped in `do-dev-box-test/bin/doctl`)
- **Remote access:** Cloudflare Zero Trust tunnel (zero public attack surface)
- **AI APIs:** Anthropic Claude, OpenAI GPT (benchmarked for latency)
- **Planned (Phase 2):** Node.js/TypeScript, SQLite, MCP clients for ClickUp/GitHub/Slack

## Architecture

### Lead + Subagent Delegation Pattern

The core pattern throughout the project: a lead orchestrator spawns fully independent subagents for parallel work, then coordinates results.

**Phase 1 flow** (`do-dev-box-test/orchestrate.sh`):
1. Lead provisions 4 test droplets across regions (parallel via doctl)
2. Lead spawns 4 subagents — each runs `scripts/test-region.sh <region> <ip>` independently
3. Lead runs `scripts/compare-results.sh` — weighted scoring: 70% AI API latency, 20% build infra, 10% SSH RTT
4. Lead destroys test droplets
5. Lead runs `scripts/provision-real.sh <winner>` — CPU-Optimized 4v/8GB, 100GB block storage, firewall lockdown

Subagents share no state and can run simultaneously. Each outputs to `results/<region>.json`.

### Phase 2: Three Autonomous Loops (Planned)

1. **Ticket Guardian** — Webhook-triggered ClickUp ticket quality scoring against decision playbook
2. **Context Router** — Slack/ClickUp Q&A with confidence-based escalation (answer / caveat / escalate)
3. **PO Decision Accelerator** — Daily scan of decision queue, ranked summary to PO

Core design principles: rules before code (decision playbook is the foundation), tight escalation boundaries initially (loosen with data), measure everything (3 KPIs: autonomous decisions, cycle time, PO queue age).

## Running Phase 1

### Prerequisites

```bash
doctl auth list          # must show authenticated account
doctl compute ssh-key list  # must show at least one key
jq --version             # must be installed
bc                       # must be installed
```

API tokens must be set in `do-dev-box-test/.env`.

### Commands

```bash
cd do-dev-box-test
chmod +x orchestrate.sh scripts/*.sh
./orchestrate.sh                          # full orchestration (all phases)
./scripts/test-region.sh <region> <ip>    # test a single region
./scripts/compare-results.sh              # compare all region results
./scripts/deep-test.sh                    # detailed latency percentile analysis (run on droplet)
./scripts/provision-real.sh <region>      # provision production droplet
```

### Benchmark Results

Stored in `do-dev-box-test/results/`. TOR1 was selected as optimal (97ms Anthropic TTFB, 123ms p95).

## Key Files

| File | Purpose |
|------|---------|
| `Agentix Orchestration System — Master Plan.md` | Full system design, timelines, KPIs |
| `do-dev-box-test/CLAUDE.md` | Phase 1 lead agent instructions and delegation model |
| `do-dev-box-test/orchestrate.sh` | Main orchestrator entry point |
| `do-dev-box-test/scripts/test-region.sh` | Subagent: benchmark one region |
| `do-dev-box-test/scripts/compare-results.sh` | Score and rank regions |
| `do-dev-box-test/scripts/provision-real.sh` | Provision production droplet |
| `do-dev-box-test/PROVISION-TOR1.md` | Post-benchmark provisioning steps for TOR1 |

## Security Model

- Firewall denies ALL inbound traffic — only Cloudflare tunnel allowed
- Secrets in `.env` files, never hardcoded
- SSH keys registered with DigitalOcean, deployed during provisioning
- Cloudflare Zero Trust: only authenticated users can access devbox

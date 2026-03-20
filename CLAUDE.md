# CLAUDE.md

## Project Overview

Orbiter is Dan's AI agent development workspace, hosted on a DigitalOcean devbox in TOR1 (Toronto).

## Infrastructure

- **Devbox:** DO CPU-Optimized 4v/8GB, Ubuntu 22.04, 100GB block storage at `/mnt/data`
- **Access:** Cloudflare Zero Trust tunnel (zero public inbound ports)
- **SSH:** `ssh devbox.danhoek.dev` via cloudflared proxy
- **Secrets:** `/mnt/data/secrets/.env`
- **State reference:** `archive/region-benchmarks/devbox-state.yaml`

## Archive

`archive/` contains completed setup work:
- `region-benchmarks/` — Phase 1 region benchmarking scripts, results (TOR1 won), devbox provisioning, and setup log
- `master-plan.md` — Original Agentix orchestration system design doc

# CLAUDE.md — Lead Agent Instructions

## What this project does

Spins up 4 test droplets across DigitalOcean regions, benchmarks them in parallel, picks the best region for an AI-agent dev workflow, then provisions a permanent dev box there.

## Your role

You are the **lead orchestrator**. You do NOT do the testing yourself. You delegate to **4 parallel subagents** (one per region) and coordinate results.

## Prerequisites — verify before starting

1. `doctl auth list` — must show authenticated account
2. `doctl compute ssh-key list` — must show at least one key
3. `jq --version` — must be installed
4. `bc` — must be installed

## Execution plan

### Step 1: Provision (you do this)

Run Phase 1 from `orchestrate.sh` — or just execute:

```bash
chmod +x orchestrate.sh scripts/*.sh
```

Then create all 4 droplets in parallel:

```bash
for region in nyc3 tor1 sfo3 syd1; do
  doctl compute droplet create "test-${region}" \
    --region "$region" --size s-1vcpu-1gb \
    --image ubuntu-24-04-x64 \
    --ssh-keys $(doctl compute ssh-key list --format ID --no-header | head -1) \
    --wait &
done
wait
```

Collect IPs into `results/droplets.json`. Wait 30s for SSH daemons.

### Step 2: Parallel testing (delegate to 4 subagents)

**Spawn 4 subagents simultaneously.** Each gets this task:

> "You are a test subagent for region `<REGION>`. SSH into `<IP>` and run `./scripts/test-region.sh <REGION> <IP>`. Wait for it to complete. Report back when done."

The subagent tasks are:

| Subagent | Command |
|----------|---------|
| Agent NYC | `./scripts/test-region.sh nyc3 <nyc3_ip>` |
| Agent TOR | `./scripts/test-region.sh tor1 <tor1_ip>` |
| Agent SFO | `./scripts/test-region.sh sfo3 <sfo3_ip>` |
| Agent SYD | `./scripts/test-region.sh syd1 <syd1_ip>` |

**These are fully independent — no shared state, no coordination needed.** Each writes to its own `results/<region>.json`. All 4 can and should run at the same time.

Wait for all 4 to finish (check that all 4 JSON files exist in `results/`).

### Step 3: Compare (you do this)

```bash
./scripts/compare-results.sh
```

Review `results/comparison.txt`. The script auto-picks the winner based on weighted scoring (70% AI API latency, 20% build infra, 10% your SSH latency).

Present the results table and winner to the user. Ask for confirmation.

### Step 4: Cleanup (you do this)

```bash
for region in nyc3 tor1 sfo3 syd1; do
  doctl compute droplet delete "test-${region}" --force &
done
wait
```

### Step 5: Provision real box (you do this, or delegate)

```bash
WINNER=$(cat results/winner.txt)
./scripts/provision-real.sh $WINNER
```

This creates the CPU-Optimized 4v/8GB droplet, attaches 100GB block storage, locks down the firewall, installs Docker + cloudflared + dev tools. Takes ~5 min.

### Step 6: Final manual steps (tell the user)

After provision-real.sh completes, the user needs to:

1. SSH into the droplet IP (before firewall fully propagates)
2. Run `cloudflared tunnel login` (authenticates with Cloudflare)
3. Run `cloudflared tunnel create devbox`
4. Edit `/etc/cloudflared/config.yml` with their domain
5. Run `cloudflared service install && systemctl start cloudflared`
6. Configure CF Access policy in dashboard
7. Fill in `/mnt/data/secrets/.env` with API keys

## Error handling

- If a test droplet fails to create: skip that region, note it in results
- If a test script times out on a droplet: record 999ms for all metrics
- If SSH can't connect: wait 30s more, retry once, then skip
- If compare finds a tie: prefer NYC3 (closest to most AI API infrastructure)

## Important notes

- Test droplets cost ~$0.01/hr each. Total test cost: <$0.10
- The real droplet costs $84/mo. Block storage $10/mo. Backups ~$17/mo.
- All scripts are idempotent — safe to re-run
- The firewall denies ALL inbound traffic. After cloudflared is running, the droplet has zero public attack surface.

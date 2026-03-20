# Provision Dev Box — TOR1 (Toronto)

## Decision

TOR1. Here's why it's not even close when you look at what we're actually building:

Claude Code agents do the work. That's Anthropic API all day long. TOR1 has the best Anthropic TTFB at 97ms and the tightest P95 at 123ms. That consistency matters enormously for agent chains — SFO3's Anthropic P95 spikes to 247ms, nearly double its median. When an agent is 25 calls deep into an orchestration chain and one call takes 247ms instead of 132ms, that jitter cascades. TOR1 barely wobbles.

SFO3's OpenAI advantage (105ms vs 138ms) is real but smaller in impact — that's 33ms difference, and OpenAI is the secondary API. If we were building primarily on GPT, SFO3 would win. But we're not.

The SSH difference from Canberra (223ms vs 181ms) is 42ms. In an orchestration workflow where you're reviewing diffs and approving agent output, you won't notice it. And during the Canada trip, TOR1 is essentially local at ~15ms.

## Benchmark Results (2026-03-19)

| Region | Anthropic TTFB (median/p95) | OpenAI TTFB (median/p95) | SSH RTT | Ping |
|--------|----------------------------|--------------------------|---------|------|
| **TOR1** | **97ms / 123ms** | 138ms / 189ms | 3520ms | 223ms |
| NYC3 | 116ms / 185ms | 282ms / 316ms | 4196ms | 239ms |
| SFO3 | 132ms / 247ms | 105ms / 155ms | 3122ms | 181ms |
| SYD1 | 276ms / 399ms | 258ms / 291ms | 990ms | 8ms |

Full results in `results/` — both initial (`<region>.json`) and deep (`<region>-deep.json`).

## Provisioning Steps

### 1. Provision the droplet

```bash
cd /home/scycer/dev/orbit/tmp/do-dev-box-test
./scripts/provision-real.sh tor1
```

This creates:
- CPU-Optimized 4v/8GB droplet (`c-4`) in `tor1`
- 100GB block storage volume mounted at `/mnt/data`
- Firewall denying ALL inbound traffic (zero public attack surface)
- Base setup: Docker (data-root on block storage), cloudflared, Node 20, dev tools

Takes ~5 minutes. Monthly cost: ~$111 (droplet $84 + storage $10 + backups $17).

### 2. SSH in immediately (before firewall propagates)

```bash
ssh root@<DROPLET_IP>
```

The firewall takes ~30s to propagate. Get in quickly.

### 3. Set up Cloudflare Tunnel

```bash
cloudflared tunnel login
cloudflared tunnel create devbox
```

Create the config:

```bash
cat > /etc/cloudflared/config.yml << 'EOF'
tunnel: <TUNNEL_ID>
credentials-file: /root/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: devbox.danhoek.dev
    service: ssh://localhost:22
  - service: http_status:404
EOF
```

Install as service:

```bash
cloudflared service install
systemctl start cloudflared
```

### 4. Configure DNS in Cloudflare Dashboard

Add a CNAME record: `devbox.danhoek.dev` → `<TUNNEL_ID>.cfargotunnel.com`

### 5. Set up CF Access policy

In the Cloudflare Zero Trust dashboard, create an Access application for `devbox.danhoek.dev` with your Google login (`scycer2@gmail.com`).

### 6. Fill in API keys

```bash
cp /mnt/data/secrets/.env.template /mnt/data/secrets/.env
nano /mnt/data/secrets/.env
```

Fill in: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GITHUB_TOKEN`, and any webhook secrets.

### 7. Verify

From your local machine:
```bash
ssh devbox.danhoek.dev
```

Should connect through the Cloudflare tunnel with zero open ports.

## Future: Migration to SYD1

When back from Canada (~5 weeks), migrate to SYD1 for the 8ms SSH experience:

1. `./scripts/provision-real.sh syd1`
2. `rsync -az root@<tor1-ip>:/mnt/data/ root@<syd1-ip>:/mnt/data/`
3. Update tunnel DNS to point to new box
4. Destroy TOR1 droplet

The API latency tradeoff (97ms → 276ms Anthropic) is worth it when you're home and SSH feel matters more. ~30 min migration.

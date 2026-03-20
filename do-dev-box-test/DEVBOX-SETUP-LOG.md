# Devbox Setup Log — 2026-03-20

## Overview

Provisioned a DigitalOcean devbox in TOR1 (Toronto) with Cloudflare Zero Trust for secure remote access. The box is for remote dev work from Windows (VS Code), Android (Termux), hosting web apps, and receiving webhooks — all with zero public inbound ports.

## What Was Provisioned

- **Droplet:** CPU-Optimized 4v/8GB, Ubuntu 22.04 + Docker, TOR1 region
  - ID: `559457842`, Public IP: `159.203.8.62`, Private IPs: `10.118.0.2` (eth1), `10.20.0.5` (eth0)
- **Block storage:** 100GB volume mounted at `/mnt/data`
  - Docker data-root: `/mnt/data/docker`
  - Workspace: `~/workspace` → `/mnt/data/workspace`
  - Repos: `~/repos` → `/mnt/data/repos`
  - Secrets: `/mnt/data/secrets/.env.template`
- **Installed:** Docker, Docker Compose v5.1.0, cloudflared 2026.3.0, Node v20.20.1 (via nvm), standard dev tools
- **DO Firewall:** `devbox-lockdown` (ID: `93cdff05-1d73-4ddf-a0cf-2751aa0b28d3`) — zero inbound ports, all outbound allowed
- **SSH keys registered:** `scycer-devbox` (Linux box key, ID: 55000721) + Windows key + Android tablet + Android phone added to `authorized_keys`

## Cloudflare Zero Trust Setup

### Tunnel

- **Tunnel name:** `devbox`, **ID:** `ea11b08c-0009-4567-b652-a7026dbef563`
- **Config:** `/etc/cloudflared/config.yml`
  ```yaml
  tunnel: ea11b08c-0009-4567-b652-a7026dbef563
  credentials-file: /root/.cloudflared/ea11b08c-0009-4567-b652-a7026dbef563.json

  warp-routing:
    enabled: true

  ingress:
    - hostname: devbox.danhoek.dev
      service: ssh://localhost:22
    - service: http_status:404
  ```
- **IP route:** `10.118.0.2/32` routed through the tunnel (for WARP clients)
- **DNS:** CNAME `devbox.danhoek.dev` → tunnel

### Access for Infrastructure (WARP-based SSH)

- **Infrastructure target:** `devbox` → `10.118.0.2` (virtual network: `e1dffd4f-5e62-4b82-a296-b2ee4edfcec9`)
- **Infrastructure application:** SSH on port 22, policy allows `scycer2@gmail.com`, SSH user `root`
- **SSH CA (Infrastructure):** installed at `/etc/ssh/ca.pub`, sshd configured with `PubkeyAuthentication yes` + `TrustedUserCAKeys /etc/ssh/ca.pub`
- **Result:** terminal SSH via `ssh root@10.118.0.2` works with short-lived certs (no SSH keys needed on device, just WARP enrolled)

### Gateway

- **Proxy:** TCP + UDP enabled (Traffic policies → Traffic settings → "Allow Secure Web Gateway to proxy traffic")
- **Network policies:**
  1. `Allow devbox SSH direct` (precedence 1000) — `net.dst.ip == 10.118.0.2 and net.dst.port == 22`, identity: `scycer2@gmail.com`
  2. `devbox` (precedence 1708) — `access.target` present → Allow
  3. `devbox2` (precedence 3640) — `net.dst.ip in {10.0.0.0/8}` → Block

### WARP Client / Device Profiles

- **Onboarding profile** (ID: `fdaae54f-d2dc-4c6f-9a50-2f1b87d7fe3c`, precedence 1000) — matches `scycer2@gmail.com`
  - Exclude mode with `10.0.0.0/8` split into sub-ranges that carve out `10.118.0.0/20` so it routes through WARP
- **Default profile** — Include mode with `10.118.0.2/32`
- **Enrolled devices:** Windows (`danmain-nov2024`), Android (`Xiaomi 13T`)

### CF Access

- Identity provider: Google (OAuth — was initially broken/deleted, had to recreate credentials in Google Cloud Console)
- One-time PIN also available as fallback

## Connection Methods — Current State

| Method | Path | Status |
|--------|------|--------|
| VS Code SSH (Windows) | cloudflared proxy → `devbox.danhoek.dev` | **Works** |
| Terminal SSH (Windows) | WARP → `10.118.0.2` (short-lived certs) | **Works** |
| Terminal SSH (Linux box) | cloudflared proxy → `devbox.danhoek.dev` | **Works** |
| Terminal SSH (Android tablet) | cloudflared proxy → `devbox.danhoek.dev` | **Works** |
| Terminal SSH (Android phone) | cloudflared proxy → `devbox.danhoek.dev` | **Works** |
| Dynamic dev ports (browser) | `p{PORT}.devbox.danhoek.dev` → `localhost:{PORT}` | **Partially ready** (DNS + CF Access created, needs reverse proxy + tunnel ingress) |
| Webhooks | `webhooks-orbiter.danhoek.dev` → `localhost:8080` | **Partially ready** (DNS + CF Access bypass created, needs tunnel ingress) |

### Windows SSH Config (`c:\Users\scyce\.ssh\config`)

```
Host devbox.danhoek.dev
  ProxyCommand "C:\Program Files (x86)\cloudflared\cloudflared.exe" access ssh --hostname %h
  User root

Host devbox
  HostName 10.118.0.2
  User root
```

### Linux SSH Config (`~/.ssh/config`)

```
Host devbox.danhoek.dev
  ProxyCommand cloudflared access ssh --hostname %h
  User root
```

## Issues Hit & How They Were Resolved

### 1. DO firewall blocked SSH before setup could run

**Problem:** `provision-real.sh` creates the firewall (zero inbound) before the SSH setup completes. The firewall propagated in ~30s, faster than SSH could connect.

**Fix:** Temporarily added inbound SSH rule to the firewall via `doctl compute firewall update`, ran setup, then removed the rule.

### 2. Google OAuth "deleted_client" error on CF Access

**Problem:** When authenticating via CF Access, got `Error 401: deleted_client`. The Google OAuth app configured in CF Access identity provider had been deleted.

**Fix:** Created new OAuth credentials in Google Cloud Console, updated them in CF Access identity provider settings.

### 3. Windows SSH "Permission denied (publickey)"

**Problem:** Windows machine had a different SSH key than the Linux box. The droplet only had the Linux box's key authorized.

**Fix:** Added the Windows public key (`ssh-ed25519 ... scyce@dan-sep-22`) to `~/.ssh/authorized_keys` on the droplet.

### 4. VS Code couldn't find cloudflared for ProxyCommand

**Problem:** VS Code uses `C:\Windows\System32\OpenSSH\ssh.exe` which doesn't search the user PATH. `cloudflared` was installed but not found.

**Fix:** Used the full path in SSH config: `ProxyCommand "C:\Program Files (x86)\cloudflared\cloudflared.exe" access ssh --hostname %h`

### 5. WARP `gateway=off` despite being connected

**Problem:** WARP showed "Connected" and `warp=on` but `gateway=off` in the trace. Traffic wasn't routing through Gateway.

**Fix:** Had to set the "Gateway DoH Subdomain" in the WARP client preferences to `danhoek` (the team name), AND log into the Zero Trust organization via the Account tab.

### 6. Split tunnel excluding devbox IP

**Problem:** `tracert 10.118.0.2` went to local router (`192.168.1.1`) instead of through WARP. The Onboarding device profile (auto-created during WARP enrollment) had `10.0.0.0/8` in its exclude list, and it overrode the Default profile because it had higher priority.

**Fix (attempt 1 — wrong):** Split `10.0.0.0/8` into sub-ranges but used `10.0.0.0/5` which is a /5 CIDR covering `8.0.0.0 - 15.255.255.255` — still included `10.118.0.2`.

**Fix (correct):** Used proper CIDR split of `10.0.0.0/8` minus `10.118.0.0/20`:
- `10.0.0.0/10`, `10.64.0.0/11`, `10.96.0.0/12`, `10.112.0.0/14`, `10.116.0.0/15`, `10.119.0.0/16`, `10.118.128.0/17`, `10.118.64.0/18`, `10.118.32.0/19`, `10.118.16.0/20`, `10.120.0.0/13`, `10.128.0.0/9`

Updated via CF API: `PUT /accounts/{id}/devices/policy/{policy_id}/exclude`

### 7. WARP routing traffic but "Destination host unreachable"

**Problem:** After fixing split tunnels, `tracert` showed traffic going to Cloudflare (`172.68.x.x`) but getting "Destination host unreachable."

**Fix:** The tunnel config only had hostname-based ingress. Added `warp-routing: enabled: true` to `/etc/cloudflared/config.yml` and restarted cloudflared. The IP route (`cloudflared tunnel route ip add 10.118.0.2/32 devbox`) was already in place but the tunnel wasn't accepting WARP-routed traffic.

### 8. VS Code SSH via WARP — "Connection closed by remote host"

**Problem:** Terminal SSH via WARP works, but VS Code's port-forwarding tunnel (`-L` flag) gets killed immediately.

**Root cause:** Access for Infrastructure has a documented limitation: **no local/remote port forwarding, no SSH agent forwarding, no X11 forwarding.** VS Code Remote-SSH requires `-L` port forwarding to tunnel to the VS Code server process.

**Resolution:** Use cloudflared proxy (`devbox.danhoek.dev`) for VS Code, WARP (`10.118.0.2`) for terminal SSH. Both go through Cloudflare Zero Trust.

### 9. UFW rate limiting SSH

**Problem:** UFW on the droplet had SSH set to `LIMIT` (6 connections per 30 seconds) which could cause issues with VS Code opening multiple connections.

**Fix:** Changed from `ufw limit 22/tcp` to `ufw allow 22/tcp`. The DO firewall + CF tunnel already provide protection.

## Cloudflare API Token

Stored in `do-dev-box-test/.env` as `CF_API_TOKEN`. Permissions: Zero Trust Write, Access Apps & Policies Write, Access SSH Auditing Write. Account ID: `1ac38d5d4b3eb39c98c1ef5ddf137d6d`.

## Session 2 — 2026-03-20 (continued)

### Android Termux SSH Setup

Set up cloudflared-based SSH access on both Android devices (tablet + phone).

**On each device in Termux:**
```bash
pkg install openssh
curl -Lo cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64
chmod +x cloudflared
mv cloudflared /data/data/com.termux/files/usr/bin/

mkdir -p ~/.ssh
cat >> ~/.ssh/config << 'EOF'
Host devbox
  ProxyCommand cloudflared access ssh --hostname devbox.danhoek.dev
  User root
EOF
```

**Issue:** `Permission denied (publickey)` after Google auth succeeded. The Android devices had SSH keys the droplet didn't recognize.

**Fix:** Added both device public keys to `~/.ssh/authorized_keys` on the droplet:
- Tablet: `ssh-ed25519 ...47Em u0_a728@localhost`
- Phone: `ssh-ed25519 ...9qhy u0_a217@localhost`

### Wildcard Subdomain + Webhooks — DNS & CF Access (partial)

Created infrastructure for dynamic dev port routing and webhook endpoint. **Not yet wired into tunnel or reverse proxy.**

**What was created:**
- DNS CNAME: `*.devbox.danhoek.dev` → tunnel (via `cloudflared tunnel route dns` on droplet)
- DNS CNAME: `webhooks-orbiter.danhoek.dev` → tunnel
- CF Access app: `devbox-wildcard` (ID: `26f8debb-6478-4f3c-8e27-463a34c79137`) — `*.devbox.danhoek.dev`, allow `scycer2@gmail.com`
- CF Access app: `webhooks-orbiter` (ID: `69323c50-0b04-423e-bac6-7d24e47e97aa`) — `webhooks-orbiter.danhoek.dev`, bypass (public)

**Note:** The CF API token does NOT have DNS edit permission. DNS routes must be added via `cloudflared tunnel route dns` on the droplet.

**What still needs to be done to make these work:**
1. Install a reverse proxy on the droplet (e.g. Caddy) that maps `p{PORT}.devbox.danhoek.dev` → `localhost:{PORT}`
2. Update `/etc/cloudflared/config.yml` ingress to route `*.devbox.danhoek.dev` → reverse proxy and `webhooks-orbiter.danhoek.dev` → `localhost:8080`
3. Restart cloudflared

### Declarative State File

Created [devbox-state.yaml](devbox-state.yaml) — a YAML reference of the complete devbox infrastructure state including all IDs, configs, connection methods, and remaining TODOs.

## Next Steps — Not Yet Done

### 1. Wire up wildcard dev port routing

- Install reverse proxy (Caddy) on droplet
- Map `p{PORT}.devbox.danhoek.dev` → `localhost:{PORT}`
- Add `*.devbox.danhoek.dev` to tunnel ingress config
- Restart cloudflared

### 2. Wire up webhooks endpoint

- Add `webhooks-orbiter.danhoek.dev` → `http://localhost:8080` to tunnel ingress
- Restart cloudflared
- Validate via webhook signatures (Stripe signing secret, GitHub webhook secret)

### 3. Fill in API keys

```bash
ssh devbox.danhoek.dev
cp /mnt/data/secrets/.env.template /mnt/data/secrets/.env
nano /mnt/data/secrets/.env
```

### 4. System restart

The droplet shows `*** System restart required ***` — schedule a reboot when convenient:
```bash
ssh devbox.danhoek.dev "reboot"
```

## Architecture Diagram

```
                    Cloudflare Edge
                    ┌──────────────────────────────────────────┐
                    │                                          │
Windows ─── WARP ───┤  Gateway ── 10.118.0.2:22 ──────────────┼──┐
  (terminal SSH)    │  (short-lived certs)                     │  │
                    │                                          │  │
Windows ─── cloudflared proxy ──┐                              │  │  DO Firewall
  (VS Code SSH)    │            │                              │  │  (zero inbound)
                    │  devbox.danhoek.dev ── SSH ──────────────┼──┤       │
                    │                                          │  ├──────┼── Droplet
Android ─── cloudflared proxy ──┘                              │  │      │   159.203.8.62
  (Termux SSH)      │  (Google auth → SSH key)                 │  │      │   10.118.0.2
                    │                                          │  │
Browser ────────────┤  p{PORT}.devbox.danhoek.dev ── proxy ────┼──┤  (needs reverse proxy)
  (dev servers)     │  (CF Access: Google auth)                │  │
                    │                                          │  │
Stripe/GitHub ──────┤  webhooks-orbiter.danhoek.dev ── :8080 ──┼──┘  (needs tunnel ingress)
  (webhooks)        │  (bypass, no auth)                       │
                    │                                          │
                    │  cloudflared tunnel (outbound only)       │
                    └──────────────────────────────────────────┘
```

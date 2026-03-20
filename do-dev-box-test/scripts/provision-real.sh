#!/bin/bash
# =============================================================================
# PROVISION REAL DEV BOX
# =============================================================================
# Usage: ./scripts/provision-real.sh <region>
# 
# Creates:
#   - CPU-Optimized 4v/8GB droplet
#   - 100GB block storage volume
#   - Firewall (deny all inbound)
#   - Runs base config (Docker on block storage, cloudflared, tools)
#
# After this script: configure CF Zero Trust in the dashboard
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Add dockerized doctl wrapper to PATH and export DO token
export PATH="$PROJECT_DIR/bin:$PATH"
if [ -f "$PROJECT_DIR/.env" ]; then
  source "$PROJECT_DIR/.env"
  export DIGITALOCEAN_ACCESS_TOKEN="${DO_API_TOKEN:-}"
fi

REGION="${1:?Usage: $0 <region> (e.g. nyc3)}"
DROPLET_NAME="devbox"
VOLUME_NAME="devbox-data"
FIREWALL_NAME="devbox-lockdown"
SSH_KEY_ID=$(doctl compute ssh-key list --format ID --no-header | head -1)

echo "═══════════════════════════════════════════════════════"
echo "Provisioning real dev box in ${REGION}"
echo "═══════════════════════════════════════════════════════"

# ─── Create droplet ───
echo "[provision] Creating CPU-Optimized 4v/8GB droplet..."
doctl compute droplet create "$DROPLET_NAME" \
  --region "$REGION" \
  --size c-4 \
  --image docker-20-04 \
  --ssh-keys "$SSH_KEY_ID" \
  --enable-monitoring \
  --tag-names "devbox,production" \
  --wait

DROPLET_ID=$(doctl compute droplet list --format ID,Name --no-header | grep "$DROPLET_NAME" | awk '{print $1}')
DROPLET_IP=$(doctl compute droplet get "$DROPLET_ID" --format PublicIPv4 --no-header)
echo "[provision] Droplet created: ${DROPLET_IP} (ID: ${DROPLET_ID})"

# ─── Create and attach block storage ───
echo "[provision] Creating 100GB block storage volume..."
doctl compute volume create "$VOLUME_NAME" \
  --region "$REGION" \
  --size 100GiB \
  --desc "Dev box persistent storage — repos, Docker volumes, data"

sleep 5
VOL_ID=$(doctl compute volume list --format ID,Name --no-header | grep "$VOLUME_NAME" | awk '{print $1}')

echo "[provision] Attaching volume to droplet..."
doctl compute volume-action attach "$VOL_ID" "$DROPLET_ID" --wait

# ─── Create firewall — DENY ALL INBOUND ───
echo "[provision] Creating lockdown firewall (deny all inbound)..."
doctl compute firewall create \
  --name "$FIREWALL_NAME" \
  --droplet-ids "$DROPLET_ID" \
  --outbound-rules "protocol:tcp,ports:all,address:0.0.0.0/0,address:::/0 protocol:udp,ports:all,address:0.0.0.0/0,address:::/0 protocol:icmp,address:0.0.0.0/0,address:::/0"

echo "[provision] Firewall created — zero inbound ports open."
echo "[provision] NOTE: SSH will still work until firewall propagates (~30s)."
echo "[provision] Waiting 30s for SSH to be ready..."
sleep 30

# Accept host key
ssh-keyscan -H "$DROPLET_IP" >> ~/.ssh/known_hosts 2>/dev/null || true

# ─── Run base configuration on the droplet ───
echo "[provision] Running base configuration..."

ssh -o StrictHostKeyChecking=no root@"$DROPLET_IP" << 'SETUP_SCRIPT'
#!/bin/bash
set -euo pipefail

echo ">>> Mounting block storage..."
# Find the attached volume device
VOLUME_DEV=$(ls /dev/disk/by-id/scsi-0DO_Volume_devbox-data 2>/dev/null || echo "")
if [ -z "$VOLUME_DEV" ]; then
  echo "ERROR: Volume not found. Check attachment."
  exit 1
fi

# Format only if not already formatted
if ! blkid "$VOLUME_DEV" | grep -q ext4; then
  mkfs.ext4 -F "$VOLUME_DEV"
fi

mkdir -p /mnt/data
if ! grep -q "devbox-data" /etc/fstab; then
  echo '/dev/disk/by-id/scsi-0DO_Volume_devbox-data /mnt/data ext4 defaults,nofail,discard 0 0' >> /etc/fstab
fi
mount -a
echo "    Mounted at /mnt/data ($(df -h /mnt/data | tail -1 | awk '{print $2}') total)"

echo ">>> Configuring Docker to use block storage..."
systemctl stop docker
mkdir -p /mnt/data/docker
cat > /etc/docker/daemon.json << 'DOCKER_CONF'
{
  "data-root": "/mnt/data/docker",
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "default-address-pools": [
    {"base": "172.17.0.0/16", "size": 24}
  ]
}
DOCKER_CONF
systemctl start docker
echo "    Docker data-root: /mnt/data/docker"

echo ">>> Installing cloudflared..."
curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o /tmp/cloudflared.deb
dpkg -i /tmp/cloudflared.deb
echo "    cloudflared installed: $(cloudflared --version)"

echo ">>> Installing dev tools..."
apt-get update -qq
apt-get install -y -qq \
  git curl wget htop tmux mosh \
  build-essential jq unzip \
  > /dev/null 2>&1

# Node via nvm
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm install 20
echo "    Node: $(node --version)"

# Docker compose plugin (v2)
mkdir -p /usr/local/lib/docker/cli-plugins
curl -fsSL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64" -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
echo "    Docker Compose: $(docker compose version)"

echo ">>> Creating workspace structure on block storage..."
mkdir -p /mnt/data/{workspace,repos,secrets,backups}
ln -sf /mnt/data/workspace /root/workspace
ln -sf /mnt/data/repos /root/repos

# Secrets directory with restricted permissions
chmod 700 /mnt/data/secrets

echo ">>> Setting up .env template..."
cat > /mnt/data/secrets/.env.template << 'ENV_TEMPLATE'
# AI API Keys
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

# GitHub
GITHUB_TOKEN=

# Webhook secrets
STRIPE_WEBHOOK_SECRET=
GITHUB_WEBHOOK_SECRET=

# App config
NODE_ENV=production
PORT=3000
WEBHOOK_PORT=8080
ENV_TEMPLATE

echo ">>> System tuning..."
# Increase file watchers for Node.js dev
echo "fs.inotify.max_user_watches=524288" >> /etc/sysctl.conf
sysctl -p > /dev/null 2>&1

# Enable automatic security updates
apt-get install -y -qq unattended-upgrades > /dev/null 2>&1
echo 'Unattended-Upgrade::Automatic-Reboot "false";' > /etc/apt/apt.conf.d/51auto-upgrades

echo ""
echo "════════════════════════════════════════════════════"
echo "BASE SETUP COMPLETE"
echo ""
echo "  Block storage: /mnt/data (100 GB)"
echo "  Docker root:   /mnt/data/docker"
echo "  Workspace:     ~/workspace → /mnt/data/workspace"
echo "  Repos:         ~/repos → /mnt/data/repos"
echo "  Secrets:       /mnt/data/secrets/.env.template"
echo ""
echo "  NEXT STEPS (manual):"
echo "  1. cloudflared tunnel login"
echo "  2. cloudflared tunnel create devbox"
echo "  3. Configure /etc/cloudflared/config.yml"
echo "  4. cloudflared service install && systemctl start cloudflared"
echo "  5. Set up CF Access policy in dashboard"
echo "  6. Copy .env.template → .env, fill in API keys"
echo "════════════════════════════════════════════════════"
SETUP_SCRIPT

echo ""
echo "═══════════════════════════════════════════════════════"
echo "DROPLET READY"
echo ""
echo "  Region: ${REGION}"
echo "  IP:     ${DROPLET_IP}"
echo "  ID:     ${DROPLET_ID}"
echo "  Volume: ${VOL_ID}"
echo ""
echo "  SSH in to finish cloudflared setup:"
echo "    ssh root@${DROPLET_IP}"
echo ""
echo "  Firewall will lock out SSH once propagated."
echo "  Complete the cloudflared tunnel setup ASAP."
echo "═══════════════════════════════════════════════════════"

# Save details for reference
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cat > "$(dirname "$SCRIPT_DIR")/results/devbox-details.json" << EOF
{
  "region": "${REGION}",
  "droplet_id": "${DROPLET_ID}",
  "droplet_ip": "${DROPLET_IP}",
  "volume_id": "${VOL_ID}",
  "droplet_size": "c-4",
  "monthly_cost_estimate": {
    "droplet": 84,
    "block_storage_100gb": 10,
    "backups_20pct": 17,
    "total": 111
  }
}
EOF

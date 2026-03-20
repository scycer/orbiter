#!/bin/bash
# =============================================================================
# ORCHESTRATOR: Remote Dev Box — Parallel Test & Provision
# =============================================================================
# 
# HOW TO USE WITH CLAUDE CODE:
#
# 1. Open Claude Code in your project root
# 2. Tell the lead agent:
#
#    "Run the orchestrator script at ./orchestrate.sh — it will spin up 4 test 
#     droplets in parallel, push a test script to each, collect results, pick 
#     the winner, then provision the real box. You are the lead. Delegate the 
#     4 region tests to subagents running in parallel. Each subagent SSHes 
#     into its assigned droplet, runs the test suite, and writes results to 
#     results/<region>.json. Once all 4 are done, you compare and proceed."
#
# The lead agent will:
#   - Run Phase 1 (provision all 4 droplets — parallel via doctl)
#   - Spawn 4 subagents (one per region) for Phase 2 (parallel testing)
#   - Collect results from all 4, run Phase 3 (compare)
#   - Run Phase 4-6 (destroy losers, provision winner, configure)
#
# PREREQUISITES:
#   - doctl authenticated (doctl auth init)
#   - SSH key registered with DO (doctl compute ssh-key list)
#   - ANTHROPIC_API_KEY set in env (for API latency tests)
#   - jq installed locally
# =============================================================================

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Add dockerized doctl wrapper to PATH and export DO token
export PATH="$PROJECT_DIR/bin:$PATH"
if [ -f "$PROJECT_DIR/.env" ]; then
  source "$PROJECT_DIR/.env"
  export DIGITALOCEAN_ACCESS_TOKEN="${DO_API_TOKEN:-}"
fi
RESULTS_DIR="$PROJECT_DIR/results"
SCRIPTS_DIR="$PROJECT_DIR/scripts"
mkdir -p "$RESULTS_DIR" "$SCRIPTS_DIR"

REGIONS=("nyc3" "tor1" "sfo3" "syd1")
DROPLET_SIZE="s-1vcpu-1gb"
DROPLET_IMAGE="ubuntu-24-04-x64"
SSH_KEY_ID=$(doctl compute ssh-key list --format ID --no-header | head -1)

# =============================================================================
# PHASE 1: Provision all test droplets (parallel — doctl handles concurrency)
# =============================================================================
phase1_provision() {
  echo "═══════════════════════════════════════════════════════"
  echo "PHASE 1: Provisioning 4 test droplets in parallel"
  echo "═══════════════════════════════════════════════════════"

  # Launch all 4 in background
  for region in "${REGIONS[@]}"; do
    echo "[provision] Launching test-${region}..."
    doctl compute droplet create "test-${region}" \
      --region "$region" \
      --size "$DROPLET_SIZE" \
      --image "$DROPLET_IMAGE" \
      --ssh-keys "$SSH_KEY_ID" \
      --wait &
  done

  # Wait for all to finish
  wait
  echo "[provision] All droplets created."

  # Collect IPs into a lookup file
  echo "{}" > "$RESULTS_DIR/droplets.json"
  for region in "${REGIONS[@]}"; do
    IP=$(doctl compute droplet list --format Name,PublicIPv4 --no-header | grep "test-${region}" | awk '{print $2}')
    echo "[provision] test-${region} → ${IP}"
    # Append to JSON
    jq --arg region "$region" --arg ip "$IP" '.[$region] = $ip' "$RESULTS_DIR/droplets.json" > "$RESULTS_DIR/tmp.json" && mv "$RESULTS_DIR/tmp.json" "$RESULTS_DIR/droplets.json"
  done

  echo ""
  cat "$RESULTS_DIR/droplets.json"
  echo ""
  echo "[provision] Waiting 30s for SSH daemons to come up..."
  sleep 30

  # Pre-accept host keys
  for region in "${REGIONS[@]}"; do
    IP=$(jq -r ".${region}" "$RESULTS_DIR/droplets.json")
    ssh-keyscan -H "$IP" >> ~/.ssh/known_hosts 2>/dev/null || true
  done
}

# =============================================================================
# PHASE 2: Run tests — EACH REGION IS A SUBAGENT TASK
# =============================================================================
# The lead agent spawns 4 subagents. Each subagent runs:
#   ./scripts/test-region.sh <region> <ip>
# and writes results to results/<region>.json
#
# To run in parallel from the orchestrator:
phase2_parallel_tests() {
  echo "═══════════════════════════════════════════════════════"
  echo "PHASE 2: Running tests in parallel across all regions"
  echo "═══════════════════════════════════════════════════════"
  echo ""
  echo "SUBAGENT INSTRUCTIONS:"
  echo "Each subagent should run: ./scripts/test-region.sh <region> <droplet_ip>"
  echo "All 4 can run simultaneously — they are fully independent."
  echo ""

  for region in "${REGIONS[@]}"; do
    IP=$(jq -r ".${region}" "$RESULTS_DIR/droplets.json")
    echo "[test] Launching test for ${region} (${IP}) in background..."
    bash "$SCRIPTS_DIR/test-region.sh" "$region" "$IP" &
  done

  echo "[test] Waiting for all region tests to complete..."
  wait
  echo "[test] All tests complete."
}

# =============================================================================
# PHASE 3: Compare results and pick winner
# =============================================================================
phase3_compare() {
  echo "═══════════════════════════════════════════════════════"
  echo "PHASE 3: Comparing results"
  echo "═══════════════════════════════════════════════════════"

  bash "$SCRIPTS_DIR/compare-results.sh"
}

# =============================================================================
# PHASE 4: Destroy test droplets
# =============================================================================
phase4_cleanup() {
  echo "═══════════════════════════════════════════════════════"
  echo "PHASE 4: Destroying test droplets"
  echo "═══════════════════════════════════════════════════════"

  for region in "${REGIONS[@]}"; do
    echo "[cleanup] Destroying test-${region}..."
    doctl compute droplet delete "test-${region}" --force &
  done
  wait
  echo "[cleanup] All test droplets destroyed."
}

# =============================================================================
# PHASE 5-6: Provision real box (lead agent runs this after confirming winner)
# =============================================================================
phase5_provision_real() {
  local WINNER="$1"
  echo "═══════════════════════════════════════════════════════"
  echo "PHASE 5: Provisioning real dev box in ${WINNER}"
  echo "═══════════════════════════════════════════════════════"

  bash "$SCRIPTS_DIR/provision-real.sh" "$WINNER"
}

# =============================================================================
# MAIN — run all phases
# =============================================================================
echo ""
echo "╔═══════════════════════════════════════════════════════╗"
echo "║  REMOTE DEV BOX — PARALLEL TEST & PROVISION          ║"
echo "║  4 regions × parallel subagents → pick winner → go   ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""

phase1_provision
phase2_parallel_tests
phase3_compare
phase4_cleanup

echo ""
echo "═══════════════════════════════════════════════════════"
echo "Review results/comparison.txt then run:"
echo "  ./scripts/provision-real.sh <winning_region>"
echo "═══════════════════════════════════════════════════════"

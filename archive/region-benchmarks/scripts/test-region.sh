#!/bin/bash
# =============================================================================
# SUBAGENT TASK: Test a single region's droplet
# =============================================================================
# Usage: ./scripts/test-region.sh <region> <droplet_ip>
# Output: results/<region>.json
#
# This script is SELF-CONTAINED. Each subagent runs one copy independently.
# All 4 can execute simultaneously with zero coordination needed.
# =============================================================================

set -euo pipefail

REGION="$1"
IP="$2"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RESULTS_DIR="$(dirname "$SCRIPT_DIR")/results"
RESULT_FILE="$RESULTS_DIR/${REGION}.json"

echo "[${REGION}] Starting tests on ${IP}..."

# ─────────────────────────────────────────────────────────────
# TEST 1: Ping from here (your machine) to the droplet
# ─────────────────────────────────────────────────────────────
echo "[${REGION}] Test 1/6: ICMP ping from local machine..."
PING_AVG=$(ping -c 10 -q "$IP" 2>/dev/null | grep 'avg' | awk -F'/' '{print $5}')
echo "[${REGION}]   Ping avg: ${PING_AVG}ms"

# ─────────────────────────────────────────────────────────────
# TEST 2: SSH round-trip (what interactive feels like)
# ─────────────────────────────────────────────────────────────
echo "[${REGION}] Test 2/6: SSH round-trip..."
SSH_RTT_MS=$( (TIMEFORMAT='%3R'; time ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no root@"$IP" 'echo ok' >/dev/null 2>&1) 2>&1 )
SSH_RTT_MS=$(awk "BEGIN {printf \"%d\", $SSH_RTT_MS * 1000}")
echo "[${REGION}]   SSH RTT: ${SSH_RTT_MS}ms"

# ─────────────────────────────────────────────────────────────
# PUSH REMOTE TEST SCRIPT — runs all API tests from the droplet
# ─────────────────────────────────────────────────────────────
echo "[${REGION}] Pushing remote test script to droplet..."

ssh -o StrictHostKeyChecking=no root@"$IP" 'cat > /tmp/run-tests.sh && chmod +x /tmp/run-tests.sh' << 'REMOTE_SCRIPT'
#!/bin/bash
# This runs ON the droplet — measures droplet → external service latency
set -euo pipefail

apt-get update -qq && apt-get install -y -qq bc jq docker.io git > /dev/null 2>&1
systemctl start docker 2>/dev/null || true

RESULTS="/tmp/test-results.json"
echo '{}' > "$RESULTS"

add_result() {
  local key="$1" val="$2"
  jq --arg k "$key" --arg v "$val" '.[$k] = ($v | tonumber)' "$RESULTS" > /tmp/r.json && mv /tmp/r.json "$RESULTS"
}

# ─── Anthropic API (3 runs, take median) ───
echo "  Testing Anthropic API..."
ANTHROPIC_TIMES=()
for i in 1 2 3; do
  T=$(curl -w "%{time_connect}" -o /dev/null -s --max-time 10 https://api.anthropic.com/v1/messages \
    -H "x-api-key: placeholder" \
    -H "content-type: application/json" \
    -H "anthropic-version: 2023-06-01" \
    -d '{"model":"claude-sonnet-4-20250514","max_tokens":1,"messages":[{"role":"user","content":"hi"}]}' || echo "0.999")
  ANTHROPIC_TIMES+=("$T")
  sleep 0.5
done
ANTHROPIC_CONNECT=$(printf '%s\n' "${ANTHROPIC_TIMES[@]}" | sort -n | sed -n '2p')
ANTHROPIC_MS=$(echo "$ANTHROPIC_CONNECT * 1000" | bc | cut -d'.' -f1)
add_result "anthropic_connect_ms" "$ANTHROPIC_MS"
echo "    Anthropic connect: ${ANTHROPIC_MS}ms"

# Full request (includes TLS + server processing)
ANTHROPIC_FULL=$(curl -w "%{time_starttransfer}" -o /dev/null -s --max-time 10 https://api.anthropic.com/v1/messages \
  -H "x-api-key: placeholder" \
  -H "content-type: application/json" \
  -H "anthropic-version: 2023-06-01" \
  -d '{"model":"claude-sonnet-4-20250514","max_tokens":1,"messages":[{"role":"user","content":"hi"}]}' || echo "0.999")
ANTHROPIC_FULL_MS=$(echo "$ANTHROPIC_FULL * 1000" | bc | cut -d'.' -f1)
add_result "anthropic_ttfb_ms" "$ANTHROPIC_FULL_MS"
echo "    Anthropic TTFB: ${ANTHROPIC_FULL_MS}ms"

# ─── OpenAI API ───
echo "  Testing OpenAI API..."
OPENAI_TIMES=()
for i in 1 2 3; do
  T=$(curl -w "%{time_connect}" -o /dev/null -s --max-time 10 https://api.openai.com/v1/chat/completions \
    -H "Authorization: Bearer placeholder" \
    -H "Content-Type: application/json" \
    -d '{"model":"gpt-4o","max_tokens":1,"messages":[{"role":"user","content":"hi"}]}' || echo "0.999")
  OPENAI_TIMES+=("$T")
  sleep 0.5
done
OPENAI_CONNECT=$(printf '%s\n' "${OPENAI_TIMES[@]}" | sort -n | sed -n '2p')
OPENAI_MS=$(echo "$OPENAI_CONNECT * 1000" | bc | cut -d'.' -f1)
add_result "openai_connect_ms" "$OPENAI_MS"
echo "    OpenAI connect: ${OPENAI_MS}ms"

# ─── GitHub API ───
echo "  Testing GitHub API..."
GH_TIMES=()
for i in 1 2 3; do
  T=$(curl -w "%{time_connect}" -o /dev/null -s --max-time 10 https://api.github.com/zen || echo "0.999")
  GH_TIMES+=("$T")
  sleep 0.5
done
GH_CONNECT=$(printf '%s\n' "${GH_TIMES[@]}" | sort -n | sed -n '2p')
GH_MS=$(echo "$GH_CONNECT * 1000" | bc | cut -d'.' -f1)
add_result "github_connect_ms" "$GH_MS"
echo "    GitHub connect: ${GH_MS}ms"

# ─── Docker Hub registry ───
echo "  Testing Docker Hub..."
DOCKER_TIMES=()
for i in 1 2 3; do
  T=$(curl -w "%{time_connect}" -o /dev/null -s --max-time 10 https://registry-1.docker.io/v2/ || echo "0.999")
  DOCKER_TIMES+=("$T")
  sleep 0.5
done
DOCKER_CONNECT=$(printf '%s\n' "${DOCKER_TIMES[@]}" | sort -n | sed -n '2p')
DOCKER_MS=$(echo "$DOCKER_CONNECT * 1000" | bc | cut -d'.' -f1)
add_result "dockerhub_connect_ms" "$DOCKER_MS"
echo "    Docker Hub connect: ${DOCKER_MS}ms"

# ─── Simulated 20-call agent chain ───
echo "  Running 20-call agent chain simulation..."
CHAIN_TOTAL=0
for i in $(seq 1 20); do
  T=$(curl -w "%{time_connect}" -o /dev/null -s --max-time 10 https://api.anthropic.com/v1/messages \
    -H "x-api-key: placeholder" \
    -H "content-type: application/json" \
    -H "anthropic-version: 2023-06-01" \
    -d '{"model":"claude-sonnet-4-20250514","max_tokens":1,"messages":[{"role":"user","content":"hi"}]}' || echo "0.999")
  CHAIN_TOTAL=$(echo "$CHAIN_TOTAL + $T" | bc)
done
CHAIN_TOTAL_MS=$(echo "$CHAIN_TOTAL * 1000" | bc | cut -d'.' -f1)
CHAIN_AVG_MS=$(echo "scale=0; $CHAIN_TOTAL_MS / 20" | bc)
add_result "chain_20_total_ms" "$CHAIN_TOTAL_MS"
add_result "chain_20_avg_ms" "$CHAIN_AVG_MS"
echo "    20-call chain: ${CHAIN_TOTAL_MS}ms total (${CHAIN_AVG_MS}ms avg)"

# ─── Git clone speed ───
echo "  Testing git clone speed..."
CLONE_START=$(date +%s%N)
git clone --depth 1 https://github.com/anthropics/anthropic-sdk-python.git /tmp/test-clone > /dev/null 2>&1
CLONE_END=$(date +%s%N)
CLONE_MS=$(( (CLONE_END - CLONE_START) / 1000000 ))
rm -rf /tmp/test-clone
add_result "git_clone_ms" "$CLONE_MS"
echo "    Git clone: ${CLONE_MS}ms"

# ─── Docker pull speed ───
echo "  Testing docker pull speed..."
PULL_START=$(date +%s%N)
docker pull node:20-slim > /dev/null 2>&1
PULL_END=$(date +%s%N)
PULL_MS=$(( (PULL_END - PULL_START) / 1000000 ))
add_result "docker_pull_node_ms" "$PULL_MS"
echo "    Docker pull node:20-slim: ${PULL_MS}ms"

PULL_START=$(date +%s%N)
docker pull python:3.12-slim > /dev/null 2>&1
PULL_END=$(date +%s%N)
PULL_MS=$(( (PULL_END - PULL_START) / 1000000 ))
add_result "docker_pull_python_ms" "$PULL_MS"
echo "    Docker pull python:3.12-slim: ${PULL_MS}ms"

echo ""
echo "  All tests complete. Results:"
cat "$RESULTS"
REMOTE_SCRIPT

# ─────────────────────────────────────────────────────────────
# EXECUTE REMOTE TESTS
# ─────────────────────────────────────────────────────────────
echo "[${REGION}] Running remote tests (this takes 3-5 min)..."
ssh -o StrictHostKeyChecking=no root@"$IP" 'bash /tmp/run-tests.sh'
REMOTE_JSON=$(ssh -o StrictHostKeyChecking=no root@"$IP" 'cat /tmp/test-results.json')

# ─────────────────────────────────────────────────────────────
# COMBINE local + remote results
# ─────────────────────────────────────────────────────────────
echo "$REMOTE_JSON" | jq \
  --arg region "$REGION" \
  --arg ip "$IP" \
  --arg ping "$PING_AVG" \
  --arg ssh_rtt "$SSH_RTT_MS" \
  '. + {
    region: $region,
    ip: $ip,
    ping_from_local_ms: ($ping | tonumber),
    ssh_rtt_from_local_ms: ($ssh_rtt | tonumber)
  }' > "$RESULT_FILE"

echo ""
echo "[${REGION}] ✓ Results saved to ${RESULT_FILE}"
echo "[${REGION}] ────────────────────────────────"
jq '.' "$RESULT_FILE"
echo ""

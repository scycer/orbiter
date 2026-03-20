#!/bin/bash
# =============================================================================
# DEEP LATENCY TEST — run ON a droplet
# =============================================================================
# Measures real network path metrics, not just TCP connect to CDN edge.
# Usage: deep-test.sh
# Output: /tmp/deep-results.json
# =============================================================================
set -euo pipefail

apt-get update -qq && apt-get install -y -qq jq traceroute mtr dnsutils > /dev/null 2>&1 || true

RESULTS="/tmp/deep-results.json"
echo '{}' > "$RESULTS"

add() {
  jq --arg k "$1" --arg v "$2" '.[$k] = ($v | tonumber)' "$RESULTS" > /tmp/dr.json && mv /tmp/dr.json "$RESULTS"
}
add_str() {
  jq --arg k "$1" --arg v "$2" '.[$k] = $v' "$RESULTS" > /tmp/dr.json && mv /tmp/dr.json "$RESULTS"
}

# ─── curl format string for full timing breakdown ───
CURL_FMT='dns:%{time_namelookup} tcp:%{time_connect} tls:%{time_appconnect} ttfb:%{time_starttransfer} total:%{time_total}'

# =============================================================================
# 1. DNS resolution times
# =============================================================================
echo "=== DNS Resolution ==="
for host in api.anthropic.com api.openai.com api.github.com registry-1.docker.io; do
  DNS_MS=$(dig +noall +stats "$host" 2>/dev/null | grep "Query time" | awk '{print $4}')
  echo "  $host: ${DNS_MS}ms"
  KEY=$(echo "$host" | sed 's/[.-]/_/g')
  add "dns_${KEY}_ms" "${DNS_MS:-999}"
done

# =============================================================================
# 2. Full timing breakdown — Anthropic (20 iterations)
# =============================================================================
echo ""
echo "=== Anthropic API — 20 iterations (full timing) ==="
ANTH_CONNECT=()
ANTH_TLS=()
ANTH_TTFB=()
ANTH_TOTAL=()

for i in $(seq 1 20); do
  TIMINGS=$(curl -s -o /dev/null -w "dns:%{time_namelookup} tcp:%{time_connect} tls:%{time_appconnect} ttfb:%{time_starttransfer} total:%{time_total}" \
    --max-time 15 \
    https://api.anthropic.com/v1/messages \
    -H "x-api-key: placeholder" \
    -H "content-type: application/json" \
    -H "anthropic-version: 2023-06-01" \
    -d '{"model":"claude-sonnet-4-20250514","max_tokens":1,"messages":[{"role":"user","content":"hi"}]}' 2>/dev/null || echo "dns:0.999 tcp:0.999 tls:0.999 ttfb:0.999 total:0.999")

  TCP=$(echo "$TIMINGS" | grep -oP 'tcp:\K[0-9.]+')
  TLS=$(echo "$TIMINGS" | grep -oP 'tls:\K[0-9.]+')
  TTFB=$(echo "$TIMINGS" | grep -oP 'ttfb:\K[0-9.]+')
  TOTAL=$(echo "$TIMINGS" | grep -oP 'total:\K[0-9.]+')

  ANTH_CONNECT+=("$TCP")
  ANTH_TLS+=("$TLS")
  ANTH_TTFB+=("$TTFB")
  ANTH_TOTAL+=("$TOTAL")

  TCP_MS=$(awk "BEGIN {printf \"%d\", $TCP * 1000}")
  TLS_MS=$(awk "BEGIN {printf \"%d\", $TLS * 1000}")
  TTFB_MS=$(awk "BEGIN {printf \"%d\", $TTFB * 1000}")
  TOTAL_MS=$(awk "BEGIN {printf \"%d\", $TOTAL * 1000}")
  printf "  [%2d] tcp:%4dms  tls:%4dms  ttfb:%4dms  total:%4dms\n" "$i" "$TCP_MS" "$TLS_MS" "$TTFB_MS" "$TOTAL_MS"
  sleep 0.3
done

# Calculate stats (median = element 10 of 20 sorted, p95 = element 19)
calc_stats() {
  local -n ARR=$1
  local PREFIX=$2
  local SORTED=($(printf '%s\n' "${ARR[@]}" | sort -n))
  local MEDIAN=${SORTED[9]}   # 0-indexed, 10th element
  local P95=${SORTED[18]}     # 19th element
  local MIN=${SORTED[0]}
  local MAX=${SORTED[19]}

  add "${PREFIX}_median_ms" "$(awk "BEGIN {printf \"%d\", $MEDIAN * 1000}")"
  add "${PREFIX}_p95_ms" "$(awk "BEGIN {printf \"%d\", $P95 * 1000}")"
  add "${PREFIX}_min_ms" "$(awk "BEGIN {printf \"%d\", $MIN * 1000}")"
  add "${PREFIX}_max_ms" "$(awk "BEGIN {printf \"%d\", $MAX * 1000}")"

  echo "  ${PREFIX}: min=$(awk "BEGIN {printf \"%d\", $MIN * 1000}")ms  median=$(awk "BEGIN {printf \"%d\", $MEDIAN * 1000}")ms  p95=$(awk "BEGIN {printf \"%d\", $P95 * 1000}")ms  max=$(awk "BEGIN {printf \"%d\", $MAX * 1000}")ms"
}

echo ""
echo "  Anthropic stats:"
calc_stats ANTH_CONNECT "anthropic_tcp"
calc_stats ANTH_TLS "anthropic_tls"
calc_stats ANTH_TTFB "anthropic_ttfb"
calc_stats ANTH_TOTAL "anthropic_total"

# =============================================================================
# 3. Full timing breakdown — OpenAI (20 iterations)
# =============================================================================
echo ""
echo "=== OpenAI API — 20 iterations (full timing) ==="
OAI_CONNECT=()
OAI_TLS=()
OAI_TTFB=()
OAI_TOTAL=()

for i in $(seq 1 20); do
  TIMINGS=$(curl -s -o /dev/null -w "dns:%{time_namelookup} tcp:%{time_connect} tls:%{time_appconnect} ttfb:%{time_starttransfer} total:%{time_total}" \
    --max-time 15 \
    https://api.openai.com/v1/chat/completions \
    -H "Authorization: Bearer placeholder" \
    -H "Content-Type: application/json" \
    -d '{"model":"gpt-4o","max_tokens":1,"messages":[{"role":"user","content":"hi"}]}' 2>/dev/null || echo "dns:0.999 tcp:0.999 tls:0.999 ttfb:0.999 total:0.999")

  TCP=$(echo "$TIMINGS" | grep -oP 'tcp:\K[0-9.]+')
  TLS=$(echo "$TIMINGS" | grep -oP 'tls:\K[0-9.]+')
  TTFB=$(echo "$TIMINGS" | grep -oP 'ttfb:\K[0-9.]+')
  TOTAL=$(echo "$TIMINGS" | grep -oP 'total:\K[0-9.]+')

  OAI_CONNECT+=("$TCP")
  OAI_TLS+=("$TLS")
  OAI_TTFB+=("$TTFB")
  OAI_TOTAL+=("$TOTAL")

  TCP_MS=$(awk "BEGIN {printf \"%d\", $TCP * 1000}")
  TLS_MS=$(awk "BEGIN {printf \"%d\", $TLS * 1000}")
  TTFB_MS=$(awk "BEGIN {printf \"%d\", $TTFB * 1000}")
  TOTAL_MS=$(awk "BEGIN {printf \"%d\", $TOTAL * 1000}")
  printf "  [%2d] tcp:%4dms  tls:%4dms  ttfb:%4dms  total:%4dms\n" "$i" "$TCP_MS" "$TLS_MS" "$TTFB_MS" "$TOTAL_MS"
  sleep 0.3
done

echo ""
echo "  OpenAI stats:"
calc_stats OAI_CONNECT "openai_tcp"
calc_stats OAI_TLS "openai_tls"
calc_stats OAI_TTFB "openai_ttfb"
calc_stats OAI_TOTAL "openai_total"

# =============================================================================
# 4. GitHub + Docker Hub — 10 iterations each
# =============================================================================
echo ""
echo "=== GitHub API — 10 iterations ==="
GH_TTFB=()
for i in $(seq 1 10); do
  TTFB=$(curl -s -o /dev/null -w "%{time_starttransfer}" --max-time 10 https://api.github.com/zen 2>/dev/null || echo "0.999")
  GH_TTFB+=("$TTFB")
  printf "  [%2d] ttfb: %dms\n" "$i" "$(awk "BEGIN {printf \"%d\", $TTFB * 1000}")"
  sleep 0.3
done
calc_stats GH_TTFB "github_ttfb"

echo ""
echo "=== Docker Hub — 10 iterations ==="
DH_TTFB=()
for i in $(seq 1 10); do
  TTFB=$(curl -s -o /dev/null -w "%{time_starttransfer}" --max-time 10 https://registry-1.docker.io/v2/ 2>/dev/null || echo "0.999")
  DH_TTFB+=("$TTFB")
  printf "  [%2d] ttfb: %dms\n" "$i" "$(awk "BEGIN {printf \"%d\", $TTFB * 1000}")"
  sleep 0.3
done
calc_stats DH_TTFB "dockerhub_ttfb"

# =============================================================================
# 5. Traceroute hop count to Anthropic
# =============================================================================
echo ""
echo "=== Traceroute to api.anthropic.com (max 20 hops) ==="
HOPS=$(traceroute -m 20 -w 2 api.anthropic.com 2>/dev/null | tail -1 | awk '{print $1}')
add "anthropic_hops" "${HOPS:-20}"
echo "  Hops: ${HOPS:-unknown}"

# =============================================================================
# 6. Sustained burst — 50 rapid-fire Anthropic connects (no sleep)
# =============================================================================
echo ""
echo "=== Burst test — 50 rapid Anthropic requests (no delay) ==="
BURST_TIMES=()
BURST_START=$(date +%s%N)
for i in $(seq 1 50); do
  T=$(curl -s -o /dev/null -w "%{time_total}" --max-time 10 \
    https://api.anthropic.com/v1/messages \
    -H "x-api-key: placeholder" \
    -H "content-type: application/json" \
    -H "anthropic-version: 2023-06-01" \
    -d '{"model":"claude-sonnet-4-20250514","max_tokens":1,"messages":[{"role":"user","content":"hi"}]}' 2>/dev/null || echo "0.999")
  BURST_TIMES+=("$T")
done
BURST_END=$(date +%s%N)
BURST_TOTAL_MS=$(( (BURST_END - BURST_START) / 1000000 ))

BURST_SORTED=($(printf '%s\n' "${BURST_TIMES[@]}" | sort -n))
BURST_MEDIAN=${BURST_SORTED[24]}
BURST_P95=${BURST_SORTED[47]}
BURST_MIN=${BURST_SORTED[0]}
BURST_MAX=${BURST_SORTED[49]}

add "burst_50_total_ms" "$BURST_TOTAL_MS"
add "burst_50_median_ms" "$(awk "BEGIN {printf \"%d\", $BURST_MEDIAN * 1000}")"
add "burst_50_p95_ms" "$(awk "BEGIN {printf \"%d\", $BURST_P95 * 1000}")"
add "burst_50_min_ms" "$(awk "BEGIN {printf \"%d\", $BURST_MIN * 1000}")"
add "burst_50_max_ms" "$(awk "BEGIN {printf \"%d\", $BURST_MAX * 1000}")"

echo "  Total: ${BURST_TOTAL_MS}ms for 50 requests"
echo "  Per-request: min=$(awk "BEGIN {printf \"%d\", $BURST_MIN * 1000}")ms  median=$(awk "BEGIN {printf \"%d\", $BURST_MEDIAN * 1000}")ms  p95=$(awk "BEGIN {printf \"%d\", $BURST_P95 * 1000}")ms  max=$(awk "BEGIN {printf \"%d\", $BURST_MAX * 1000}")ms"

echo ""
echo "=== All deep tests complete ==="
cat "$RESULTS"

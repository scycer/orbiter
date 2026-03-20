#!/bin/bash
# =============================================================================
# Compare results across all regions and pick the winner
# =============================================================================
# Weighting:
#   70% — Droplet → AI APIs (agent hot path)
#   20% — Droplet → GitHub / Docker (build path)
#   10% — Local → Droplet (your SSH / review sessions)
# =============================================================================

set -euo pipefail

RESULTS_DIR="$(cd "$(dirname "$0")/.." && pwd)/results"
OUTPUT="$RESULTS_DIR/comparison.txt"

echo "" > "$OUTPUT"

# Header
cat >> "$OUTPUT" << 'EOF'
╔═══════════════════════════════════════════════════════════════════════╗
║                    REGION COMPARISON — RESULTS                       ║
╠═══════════════════════════════════════════════════════════════════════╣
EOF

# Table header
printf "║ %-28s │ %8s │ %8s │ %8s │ %8s ║\n" "Metric" "NYC3" "TOR1" "SFO3" "SYD1" >> "$OUTPUT"
echo "╠──────────────────────────────┼──────────┼──────────┼──────────┼──────────╣" >> "$OUTPUT"

# Read each region's results
for metric in \
  "ping_from_local_ms:Ping from you (ms)" \
  "ssh_rtt_from_local_ms:SSH RTT from you (ms)" \
  "anthropic_connect_ms:→ Anthropic connect (ms)" \
  "anthropic_ttfb_ms:→ Anthropic TTFB (ms)" \
  "openai_connect_ms:→ OpenAI connect (ms)" \
  "github_connect_ms:→ GitHub connect (ms)" \
  "dockerhub_connect_ms:→ Docker Hub connect (ms)" \
  "chain_20_total_ms:→ 20-call chain total (ms)" \
  "chain_20_avg_ms:→ 20-call chain avg (ms)" \
  "git_clone_ms:→ Git clone (ms)" \
  "docker_pull_node_ms:→ Docker pull node (ms)" \
  "docker_pull_python_ms:→ Docker pull python (ms)"; do

  KEY="${metric%%:*}"
  LABEL="${metric##*:}"

  NYC=$(jq -r ".${KEY} // \"—\"" "$RESULTS_DIR/nyc3.json" 2>/dev/null || echo "—")
  TOR=$(jq -r ".${KEY} // \"—\"" "$RESULTS_DIR/tor1.json" 2>/dev/null || echo "—")
  SFO=$(jq -r ".${KEY} // \"—\"" "$RESULTS_DIR/sfo3.json" 2>/dev/null || echo "—")
  SYD=$(jq -r ".${KEY} // \"—\"" "$RESULTS_DIR/syd1.json" 2>/dev/null || echo "—")

  printf "║ %-28s │ %8s │ %8s │ %8s │ %8s ║\n" "$LABEL" "$NYC" "$TOR" "$SFO" "$SYD" >> "$OUTPUT"
done

echo "╠══════════════════════════════╪══════════╪══════════╪══════════╪══════════╣" >> "$OUTPUT"

# Calculate weighted score for each region
# Lower is better for all metrics
calc_score() {
  local FILE="$1"
  if [ ! -f "$FILE" ]; then echo "99999"; return; fi

  local ANTH=$(jq -r '.anthropic_connect_ms // 999' "$FILE")
  local OAI=$(jq -r '.openai_connect_ms // 999' "$FILE")
  local GH=$(jq -r '.github_connect_ms // 999' "$FILE")
  local DOCK=$(jq -r '.dockerhub_connect_ms // 999' "$FILE")
  local SSH=$(jq -r '.ssh_rtt_from_local_ms // 999' "$FILE")

  # Weighted: 70% AI APIs, 20% build infra, 10% your access
  awk "BEGIN {printf \"%d\", ($ANTH + $OAI) * 70 / 200 + ($GH + $DOCK) * 20 / 200 + $SSH * 10 / 100}"
}

NYC_SCORE=$(calc_score "$RESULTS_DIR/nyc3.json")
TOR_SCORE=$(calc_score "$RESULTS_DIR/tor1.json")
SFO_SCORE=$(calc_score "$RESULTS_DIR/sfo3.json")
SYD_SCORE=$(calc_score "$RESULTS_DIR/syd1.json")

printf "║ %-28s │ %8s │ %8s │ %8s │ %8s ║\n" "WEIGHTED SCORE (lower=better)" "$NYC_SCORE" "$TOR_SCORE" "$SFO_SCORE" "$SYD_SCORE" >> "$OUTPUT"
echo "╚══════════════════════════════╧══════════╧══════════╧══════════╧══════════╝" >> "$OUTPUT"

# Find winner
WINNER="nyc3"
BEST=$NYC_SCORE
for pair in "tor1:$TOR_SCORE" "sfo3:$SFO_SCORE" "syd1:$SYD_SCORE"; do
  R="${pair%%:*}"
  S="${pair##*:}"
  if [ "$S" -lt "$BEST" ] 2>/dev/null; then
    BEST="$S"
    WINNER="$R"
  fi
done

cat >> "$OUTPUT" << EOF

  ┌─────────────────────────────────────────────┐
  │  WINNER: ${WINNER} (score: ${BEST})                  │
  │                                             │
  │  To provision the real box:                 │
  │  ./scripts/provision-real.sh ${WINNER}             │
  └─────────────────────────────────────────────┘

  Scoring weights:
    70% — AI API latency (Anthropic + OpenAI connect time)
    20% — Build infra latency (GitHub + Docker Hub connect time)  
    10% — Your SSH access latency

EOF

cat "$OUTPUT"

# Also save the winner for automation
echo "$WINNER" > "$RESULTS_DIR/winner.txt"

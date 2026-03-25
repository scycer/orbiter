#!/bin/bash
# SSE-driven agent watcher
# Listens for pending tasks and launches Claude to work on them

API="${API_URL:-http://prod:3001}"

echo "[$(date)] Agent watcher started (API: $API)"
echo "[$(date)] Waiting for API..."

# Wait for API to be ready
until curl -sf "$API/api/health" > /dev/null 2>&1; do
  sleep 2
done
echo "[$(date)] API is ready"

# Check for any existing pending tasks on startup
echo "[$(date)] Checking for existing pending tasks..."
PENDING=$(curl -sf "$API/api/tasks?status=pending")
if [ $? -eq 0 ] && [ "$PENDING" != "[]" ]; then
  # Pick highest priority pending task
  ID=$(echo "$PENDING" | jq -r '
    [.[] | . + {pri_num: (if .priority == "urgent" then 0
      elif .priority == "high" then 1
      elif .priority == "medium" then 2
      else 3 end)}] | sort_by(.pri_num) | .[0].id')
  if [ -n "$ID" ] && [ "$ID" != "null" ]; then
    echo "[$(date)] Found pending task $ID, picking up..."
    cd /workspace
    claude -p "/agent $ID" --dangerously-skip-permissions
    echo "[$(date)] Finished task $ID"
  fi
fi

# Now listen for new tasks via SSE
while true; do
  echo "[$(date)] Connecting to SSE stream..."
  curl -sf -N "$API/api/events" | while IFS= read -r line; do
    # SSE lines come as "event: ..." and "data: ..."
    [[ "$line" == data:* ]] || continue
    JSON="${line#data: }"

    STATUS=$(echo "$JSON" | jq -r '.status // empty' 2>/dev/null)
    ID=$(echo "$JSON" | jq -r '.id // empty' 2>/dev/null)

    if [ "$STATUS" = "pending" ] && [ -n "$ID" ]; then
      echo "[$(date)] New pending task: $ID"
      cd /workspace
      claude -p "/agent $ID" --dangerously-skip-permissions
      echo "[$(date)] Finished task $ID"
    fi
  done

  echo "[$(date)] SSE disconnected, reconnecting in 5s..."
  sleep 5
done

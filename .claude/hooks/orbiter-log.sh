#!/usr/bin/env bash
# Claude Code hook → Orbiter activity logger
# Reads JSON from stdin, resolves the active task, and POSTs an activity entry.
# Runs async so it never blocks the agent loop.

set -euo pipefail

API_BASE="${ORBITER_API:-http://localhost:3001}"
INPUT=$(cat)

EVENT=$(echo "$INPUT" | jq -r '.hook_event_name // "unknown"')
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // ""')

# Build summary based on event type
case "$EVENT" in
  PreToolUse)
    TOOL=$(echo "$INPUT" | jq -r '.tool_name // "unknown"')
    case "$TOOL" in
      Bash)
        DESC=$(echo "$INPUT" | jq -r '.tool_input.description // .tool_input.command // ""' | head -c 200)
        SUMMARY="Running: $DESC"
        ;;
      Edit)
        FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""' | sed 's|.*/||')
        SUMMARY="Editing $FILE"
        ;;
      Write)
        FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""' | sed 's|.*/||')
        SUMMARY="Writing $FILE"
        ;;
      Read)
        FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""' | sed 's|.*/||')
        SUMMARY="Reading $FILE"
        ;;
      Glob)
        PAT=$(echo "$INPUT" | jq -r '.tool_input.pattern // ""')
        SUMMARY="Searching files: $PAT"
        ;;
      Grep)
        PAT=$(echo "$INPUT" | jq -r '.tool_input.pattern // ""')
        SUMMARY="Searching code: $PAT"
        ;;
      Agent)
        DESC=$(echo "$INPUT" | jq -r '.tool_input.description // .tool_input.prompt // ""' | head -c 200)
        SUMMARY="Spawning agent: $DESC"
        ;;
      WebFetch)
        URL=$(echo "$INPUT" | jq -r '.tool_input.url // ""')
        SUMMARY="Fetching: $URL"
        ;;
      WebSearch)
        Q=$(echo "$INPUT" | jq -r '.tool_input.query // ""')
        SUMMARY="Searching web: $Q"
        ;;
      *)
        SUMMARY="Using tool: $TOOL"
        ;;
    esac
    ;;
  PostToolUse)
    TOOL=$(echo "$INPUT" | jq -r '.tool_name // "unknown"')
    SUMMARY="Completed: $TOOL"
    ;;
  PostToolUseFailure)
    TOOL=$(echo "$INPUT" | jq -r '.tool_name // "unknown"')
    SUMMARY="Failed: $TOOL"
    ;;
  SubagentStart)
    ATYPE=$(echo "$INPUT" | jq -r '.agent_type // "unknown"')
    SUMMARY="Subagent started ($ATYPE)"
    ;;
  SubagentStop)
    ATYPE=$(echo "$INPUT" | jq -r '.agent_type // "unknown"')
    SUMMARY="Subagent finished ($ATYPE)"
    ;;
  Stop)
    MSG=$(echo "$INPUT" | jq -r '.last_assistant_message // ""' | head -c 300)
    SUMMARY="Turn complete: ${MSG:0:150}"
    ;;
  SessionStart)
    SUMMARY="Session started"
    ;;
  SessionEnd)
    SUMMARY="Session ended"
    ;;
  Notification)
    MSG=$(echo "$INPUT" | jq -r '.message // .title // ""' | head -c 200)
    SUMMARY="Notification: $MSG"
    ;;
  UserPromptSubmit)
    SUMMARY="User prompt received"
    ;;
  *)
    SUMMARY="Event: $EVENT"
    ;;
esac

TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')

# Find active task
ACTIVE=$(curl -sf "$API_BASE/api/tasks/active" 2>/dev/null || echo "null")
TASK_ID=$(echo "$ACTIVE" | jq -r '.id // empty')

if [ -z "$TASK_ID" ]; then
  exit 0
fi

# Post activity entry
PAYLOAD=$(jq -n \
  --arg event "$EVENT" \
  --arg tool "$TOOL_NAME" \
  --arg summary "$SUMMARY" \
  --arg sessionId "$SESSION_ID" \
  '{event: $event, tool: (if $tool == "" then null else $tool end), summary: $summary, sessionId: $sessionId}')

curl -sf -X POST "$API_BASE/api/tasks/$TASK_ID/activity" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" >/dev/null 2>&1 || true

exit 0

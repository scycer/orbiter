#!/usr/bin/env bash
LOG="/var/log/orchestrator-health.log"
TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
for svc in orchestrator-api orchestrator-ui; do
  systemctl is-active --quiet "$svc" || { echo "$TS RESTART $svc" >> "$LOG"; systemctl restart "$svc"; }
done
curl -sf http://localhost:3001/api/health > /dev/null 2>&1 || { echo "$TS RESTART orchestrator-api (health fail)" >> "$LOG"; systemctl restart orchestrator-api; }

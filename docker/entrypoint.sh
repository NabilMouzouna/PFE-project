#!/bin/sh
set -e

cleanup() {
  if [ -n "${API_PID:-}" ]; then
    kill "$API_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

API_PORT="${API_PORT:-8000}"
DASHBOARD_PORT="${DASHBOARD_PORT:-3001}"
export API_BASE_URL="${API_BASE_URL:-http://127.0.0.1:${API_PORT}}"

cd /app/api-bundle
PORT="$API_PORT" HOST="${HOST:-0.0.0.0}" node node_modules/tsx/dist/cli.mjs src/index.ts &
API_PID=$!

DASHBOARD_DIR="/app/dashboard-standalone/apps/dashboard"
if [ ! -f "$DASHBOARD_DIR/server.js" ]; then
  echo "dashboard server.js missing at ${DASHBOARD_DIR}/server.js" >&2
  exit 1
fi

cd "$DASHBOARD_DIR"
export PORT="$DASHBOARD_PORT"
export HOSTNAME="${DASHBOARD_HOSTNAME:-0.0.0.0}"
exec node server.js

#!/usr/bin/env bash
# Tear down the Lexius dev stack started by scripts/dev-stack.sh.
#
# Usage: pnpm dev:stack:down

set -euo pipefail

DB_CONTAINER="legal-ai-db-local-1"
API_PATTERN="packages/api/dist/bundle.cjs"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info() { echo -e "${GREEN}▸${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }

if pgrep -f "${API_PATTERN}" >/dev/null 2>&1; then
  info "Stopping API"
  pkill -f "${API_PATTERN}" || true
else
  warn "API not running"
fi

if docker ps -a --filter "name=^${DB_CONTAINER}$" -q | grep -q .; then
  info "Removing DB container ${DB_CONTAINER}"
  docker rm -f "${DB_CONTAINER}" >/dev/null
else
  warn "DB container not present"
fi

info "Done. Cached API key (~/.lexius-dev-key) left in place — delete manually if you want to rotate."

#!/usr/bin/env bash
# Lexius — one-command project setup
# Usage: ./scripts/init.sh

set -euo pipefail

cd "$(dirname "$0")/.."

# Colours
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info() { echo -e "${GREEN}▸${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
err()  { echo -e "${RED}✗${NC} $1" >&2; }

# ── Preflight ───────────────────────────────────────────────────────────────

info "Checking prerequisites"

command -v docker >/dev/null 2>&1 || { err "docker not found. Install Docker Desktop and enable WSL integration."; exit 1; }
command -v pnpm >/dev/null 2>&1 || { err "pnpm not found. Install with: npm install -g pnpm"; exit 1; }
command -v node >/dev/null 2>&1 || { err "node not found. Node 20+ required."; exit 1; }

node_version=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$node_version" -lt 20 ]; then
  err "Node $node_version detected. Node 20+ required."
  exit 1
fi

# ── Environment ────────────────────────────────────────────────────────────

if [ ! -f .env ]; then
  info "Creating .env from template"
  cp .env.example .env
  warn "Edit .env to set OPENAI_API_KEY and any other secrets, then re-run this script."
  exit 0
fi

# shellcheck disable=SC1091
set -a; source .env; set +a

if [ -z "${OPENAI_API_KEY:-}" ]; then
  err "OPENAI_API_KEY is not set in .env"
  exit 1
fi

if [ -z "${DATABASE_URL:-}" ]; then
  err "DATABASE_URL is not set in .env"
  exit 1
fi

# ── Install ────────────────────────────────────────────────────────────────

info "Installing dependencies"
pnpm install --silent

# ── Build ──────────────────────────────────────────────────────────────────

info "Building packages"
pnpm build > /tmp/lexius-build.log 2>&1 || {
  err "Build failed — see /tmp/lexius-build.log"
  tail -20 /tmp/lexius-build.log
  exit 1
}

# ── Database ───────────────────────────────────────────────────────────────

info "Starting database (pgvector/pgvector:pg16)"
docker compose --profile local up -d db-local

info "Waiting for database to become healthy"
for i in {1..30}; do
  if PGPASSWORD="${DB_PASSWORD:-dev}" psql -h localhost -U legal_ai -d legal_ai -c "SELECT 1" >/dev/null 2>&1; then
    break
  fi
  sleep 1
  if [ "$i" -eq 30 ]; then
    err "Database failed to start within 30 seconds"
    docker compose --profile local logs db-local | tail -20
    exit 1
  fi
done

# ── Migrate ────────────────────────────────────────────────────────────────

info "Running migrations"
pnpm --filter @lexius/db exec drizzle-kit migrate > /tmp/lexius-migrate.log 2>&1 || {
  err "Migration failed — see /tmp/lexius-migrate.log"
  tail -20 /tmp/lexius-migrate.log
  exit 1
}

# ── Seed structured data ───────────────────────────────────────────────────

info "Seeding EU AI Act (structured data + embeddings)"
pnpm --filter @lexius/db exec tsx src/seeds/run.ts --legislation=eu-ai-act > /tmp/lexius-seed-euaiact.log 2>&1 || {
  err "EU AI Act seed failed — see /tmp/lexius-seed-euaiact.log"
  tail -20 /tmp/lexius-seed-euaiact.log
  exit 1
}

info "Seeding DORA (structured data + embeddings)"
pnpm --filter @lexius/db exec tsx src/seeds/run.ts --legislation=dora > /tmp/lexius-seed-dora.log 2>&1 || {
  err "DORA seed failed — see /tmp/lexius-seed-dora.log"
  tail -20 /tmp/lexius-seed-dora.log
  exit 1
}

# ── Fetch verbatim text ────────────────────────────────────────────────────

info "Fetching verbatim EU AI Act text from EUR-Lex CELLAR"
node packages/fetcher/dist/cli.js ingest --celex 32024R1689 --legislation eu-ai-act > /tmp/lexius-fetch-euaiact.log 2>&1 || {
  warn "EU AI Act fetch failed (continuing) — see /tmp/lexius-fetch-euaiact.log"
}

info "Fetching verbatim DORA text from EUR-Lex CELLAR"
node packages/fetcher/dist/cli.js ingest --celex 32022R2554 --legislation dora > /tmp/lexius-fetch-dora.log 2>&1 || {
  warn "DORA fetch failed (continuing) — see /tmp/lexius-fetch-dora.log"
}

# ── Summary ────────────────────────────────────────────────────────────────

info "Verifying database state"
PGPASSWORD="${DB_PASSWORD:-dev}" psql -h localhost -U legal_ai -d legal_ai -c "
SELECT l.id, l.name,
  (SELECT count(*) FROM articles WHERE legislation_id = l.id) AS articles,
  (SELECT count(*) FROM articles WHERE legislation_id = l.id AND verbatim = true) AS verbatim,
  (SELECT count(*) FROM obligations WHERE legislation_id = l.id) AS obligations,
  (SELECT count(*) FROM faq WHERE legislation_id = l.id) AS faq
FROM legislations l;
"

echo ""
echo -e "${GREEN}✓ Lexius is ready.${NC}"
echo ""
echo "Next steps:"
echo "  • Run the API:       cd packages/api && pnpm start"
echo "  • Run the MCP:       cd packages/mcp && pnpm start"
echo "  • Run the CLI:       pnpm --filter @lexius/cli start classify --description '...'"
echo "  • Run the Agent:     cd packages/agent && pnpm start"
echo ""
echo "Database: $DATABASE_URL"

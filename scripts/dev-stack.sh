#!/usr/bin/env bash
# Bring up the Lexius dev stack: pgvector DB + API.
# Idempotent — safe to re-run. Prints the env block to source for the
# Claude Code plugin.
#
# Usage:
#   pnpm dev:stack                       # default — EU AI Act seeded
#   pnpm dev:stack --with eu-ai-act      # full EU AI Act (seed + verbatim text)
#   pnpm dev:stack --with dora           # add DORA
#   pnpm dev:stack --with cima-aml       # add one CIMA act
#   pnpm dev:stack --with cima           # add all 10 CIMA acts
#   pnpm dev:stack --with eu             # eu-ai-act + dora
#   pnpm dev:stack --with all            # everything
#   pnpm dev:stack --with cima --with dora   # combine
# Stop:
#   pnpm dev:stack:down

set -euo pipefail

cd "$(dirname "$0")/.."

# shellcheck disable=SC1091
[ -f .env ] && { set -a; source .env; set +a; }

DB_PORT="${LEXIUS_DB_PORT:-5433}"
API_PORT="${LEXIUS_API_PORT:-3001}"
DB_CONTAINER="legal-ai-db-local-1"
DB_PASSWORD="${DB_PASSWORD:-dev}"
DATABASE_URL="postgresql://legal_ai:${DB_PASSWORD}@localhost:${DB_PORT}/legal_ai"
KEY_FILE="${HOME}/.lexius-dev-key"

export DATABASE_URL

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info() { echo -e "${GREEN}▸${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
err()  { echo -e "${RED}✗${NC} $1" >&2; }

# ── Arg parsing — collect --with <id> values ──────────────────────────────
EXTRA_WITH=()
while [[ $# -gt 0 ]]; do
  case $1 in
    --with)    [[ $# -ge 2 ]] || { err "--with requires an argument"; exit 1; }
               EXTRA_WITH+=("$2"); shift 2 ;;
    --with=*)  EXTRA_WITH+=("${1#--with=}"); shift ;;
    -h|--help) sed -n '2,15p' "$0"; exit 0 ;;
    *)         err "Unknown argument: $1"; exit 1 ;;
  esac
done

CIMA_ALL="cima-monetary-authority cima-banks-trust cima-mutual-funds cima-private-funds cima-securities cima-insurance cima-aml cima-vasp cima-proceeds-crime cima-beneficial-ownership"
EU_ALL="eu-ai-act dora"

expand_group() {
  case "$1" in
    eu)   echo "$EU_ALL" ;;
    cima) echo "$CIMA_ALL" ;;
    all)  echo "$EU_ALL $CIMA_ALL" ;;
    *)    echo "$1" ;;
  esac
}

LEGISLATIONS=()
for raw in "${EXTRA_WITH[@]:-}"; do
  [ -z "$raw" ] && continue
  for id in $(expand_group "$raw"); do
    LEGISLATIONS+=("$id")
  done
done

# ── Preflight ──────────────────────────────────────────────────────────────
command -v docker >/dev/null || { err "docker not found"; exit 1; }
command -v psql   >/dev/null || { err "psql not found";   exit 1; }
command -v node   >/dev/null || { err "node not found";   exit 1; }
command -v pnpm   >/dev/null || { err "pnpm not found";   exit 1; }

if [ -z "${OPENAI_API_KEY:-}" ]; then
  warn "OPENAI_API_KEY not set — seeding (if needed) will fail"
fi

# ── DB ─────────────────────────────────────────────────────────────────────
if docker ps --filter "name=^${DB_CONTAINER}$" --filter status=running -q | grep -q .; then
  info "DB already running on port ${DB_PORT}"
else
  docker rm -f "${DB_CONTAINER}" >/dev/null 2>&1 || true
  info "Starting DB (pgvector/pgvector:pg16) on port ${DB_PORT}"
  docker run -d --name "${DB_CONTAINER}" \
    -p "${DB_PORT}:5432" \
    -e POSTGRES_DB=legal_ai \
    -e POSTGRES_USER=legal_ai \
    -e POSTGRES_PASSWORD="${DB_PASSWORD}" \
    -v "$(pwd)/packages/db/docker-entrypoint-initdb.d:/docker-entrypoint-initdb.d" \
    -v "$(pwd)/packages/db/src/migrations:/docker-entrypoint-initdb.d/migrations" \
    pgvector/pgvector:pg16 >/dev/null
fi

info "Waiting for DB to accept connections"
for i in $(seq 1 60); do
  if PGPASSWORD="${DB_PASSWORD}" psql -h localhost -p "${DB_PORT}" -U legal_ai -d legal_ai -c "SELECT 1" >/dev/null 2>&1; then
    break
  fi
  sleep 1
  if [ "$i" -eq 60 ]; then err "DB never became ready"; exit 1; fi
done

# ── Load legislations ──────────────────────────────────────────────────────
article_count() {
  PGPASSWORD="${DB_PASSWORD}" psql -h localhost -p "${DB_PORT}" -U legal_ai -d legal_ai -tAc \
    "SELECT count(*) FROM articles WHERE legislation_id='$1'" 2>/dev/null || echo 0
}

load_legislation() {
  local id="$1"
  local count
  count=$(article_count "$id")
  if [ "${count:-0}" -gt 0 ]; then
    info "${id} already loaded (${count} articles)"
    return 0
  fi
  case "$id" in
    eu-ai-act)
      info "Seeding ${id} (structured + embeddings)"
      pnpm --filter @lexius/db exec tsx src/seeds/run.ts --legislation="$id"
      info "Fetching verbatim text for ${id} (EUR-Lex CELLAR)"
      node packages/fetcher/dist/cli.js ingest --celex 32024R1689 --legislation "$id" || warn "verbatim fetch failed for ${id} — structured data still loaded"
      ;;
    dora)
      info "Seeding ${id} (structured + embeddings)"
      pnpm --filter @lexius/db exec tsx src/seeds/run.ts --legislation="$id"
      info "Fetching verbatim text for ${id} (EUR-Lex CELLAR)"
      node packages/fetcher/dist/cli.js ingest --celex 32022R2554 --legislation "$id" || warn "verbatim fetch failed for ${id} — structured data still loaded"
      ;;
    cima-*)
      info "Fetching ${id} (CIMA PDF)"
      node packages/fetcher/dist/cli.js ingest --source cima --legislation "$id" || warn "fetch failed for ${id}"
      ;;
    *)
      warn "Unknown legislation: ${id} (skipping)"
      ;;
  esac
}

# Default: seed EU AI Act if nothing is loaded yet and no --with was passed.
DEFAULT_COUNT=$(article_count "eu-ai-act")
if [ ${#LEGISLATIONS[@]} -eq 0 ] && [ "${DEFAULT_COUNT:-0}" -lt 1 ]; then
  info "Seeding EU AI Act (default — pass --with <id> to load more)"
  pnpm --filter @lexius/db exec tsx src/seeds/run.ts --legislation=eu-ai-act
elif [ ${#LEGISLATIONS[@]} -eq 0 ]; then
  info "EU AI Act already seeded (${DEFAULT_COUNT} articles)"
fi

# Explicit --with loads (deduped).
SEEN=" "
for id in "${LEGISLATIONS[@]:-}"; do
  [[ "$SEEN" == *" $id "* ]] && continue
  SEEN+="$id "
  load_legislation "$id"
done

# ── API ────────────────────────────────────────────────────────────────────
if curl -fsS "http://localhost:${API_PORT}/health" >/dev/null 2>&1; then
  info "API already running on port ${API_PORT}"
else
  info "Starting API on port ${API_PORT}"
  PORT="${API_PORT}" LOG_LEVEL=warn nohup node packages/api/dist/bundle.cjs > /tmp/lexius-api.log 2>&1 &
  disown || true
  for i in $(seq 1 30); do
    if curl -fsS "http://localhost:${API_PORT}/health" >/dev/null 2>&1; then break; fi
    sleep 1
    if [ "$i" -eq 30 ]; then err "API never became ready — see /tmp/lexius-api.log"; exit 1; fi
  done
fi

# ── API key (reuse if cached) ──────────────────────────────────────────────
if [ -f "${KEY_FILE}" ] && grep -q '^lx_' "${KEY_FILE}"; then
  KEY=$(cat "${KEY_FILE}")
  info "Reusing cached API key from ${KEY_FILE}"
else
  info "Minting a new API key"
  KEY=$(pnpm create-api-key -- --email dev@local --name "dev-stack" 2>&1 | grep -E '^lx_' | tail -1)
  if [ -z "${KEY}" ]; then err "Failed to mint API key"; exit 1; fi
  printf '%s' "${KEY}" > "${KEY_FILE}"
  chmod 600 "${KEY_FILE}"
fi

# ── Summary ────────────────────────────────────────────────────────────────
echo
info "Lexius dev stack ready"
cat <<EOF

  DB:  ${DATABASE_URL}
  API: http://localhost:${API_PORT}/health

To use the Claude Code plugin against this stack:

  export LEXIUS_API_URL=http://localhost:${API_PORT}
  export LEXIUS_API_KEY=${KEY}
  claude --plugin-dir ./plugin

Stop with: pnpm dev:stack:down
EOF

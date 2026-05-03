# Lexius

Legislation-agnostic AI compliance platform with provenance-tracked, deterministic regulatory analysis. Verbatim regulation text from EUR-Lex and offshore PDF sources, deterministic fact extraction, parallel hivemind assessment, and honest provenance labelling on every claim.

20 regulations across 2 jurisdictions — 10 EU (via EUR-Lex CELLAR) and 10 Cayman Islands CIMA (via PDF). Adding a new regulation is two commands — the fetcher, extractor, and swarm handle the rest.

> Lexius provides general regulatory guidance and does not constitute legal advice. For implementation support, consult qualified legal counsel.

## Install

```bash
# Claude Code plugin — bundles MCP server, skills, and a sub-agent
git clone https://github.com/rob-otix-ai/lexius.git && cd lexius
pnpm install && pnpm plugin:build && pnpm dev:stack
# then in any directory:
claude --plugin-dir /path/to/lexius/plugin

# MCP server — connect Claude Desktop to the compliance database
npx @robotixai/lexius-mcp

# CLI — query from your terminal
npx @robotixai/lexius-cli

# Interactive agent — Claude-powered compliance consultant
npx @robotixai/lexius-agent

# Database — schema-ready Postgres with pgvector
docker pull robotixai/lexius-db
```

### From Source

```bash
git clone https://github.com/rob-otix-ai/lexius.git
cd lexius
cp .env.example .env         # set OPENAI_API_KEY + ANTHROPIC_API_KEY
pnpm setup                   # install → build → DB → migrate → seed → fetch → extract
```

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Consumers                                                    │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────────┐ ┌────────┐ ┌───────┐ │
│  │ API │ │ MCP │ │ CLI │ │  Agent  │ │ Skills │ │ Swarm │ │
│  └──┬──┘ └──┬──┘ └──┬──┘ └────┬────┘ └───┬────┘ └───┬───┘ │
│     └───────┴───────┴─────────┴───────────┴──────────┘     │
│                      │                                       │
│              ┌───────┴───────┐                               │
│              │     Core      │ use cases + domain             │
│              │  + Plugins    │ legislation-agnostic            │
│              └───────┬───────┘                               │
│                      │                                       │
│     ┌────────────────┼────────────────┐                      │
│     │                │                │                      │
│ ┌───┴───┐    ┌───────┴───────┐  ┌────┴─────┐               │
│ │Fetcher│    │      DB       │  │Extractor │               │
│ │CELLAR │    │Postgres+pgvec │  │regex/det │               │
│ └───────┘    └───────────────┘  └──────────┘               │
└──────────────────────────────────────────────────────────────┘
```

## Published Packages

### npm

| Package | Version | Description |
|---------|---------|-------------|
| [@robotixai/lexius-api](https://www.npmjs.com/package/@robotixai/lexius-api) | [![npm](https://img.shields.io/npm/v/@robotixai/lexius-api)](https://www.npmjs.com/package/@robotixai/lexius-api) | REST API + SSE MCP server (15 endpoints) |
| [@robotixai/lexius-mcp](https://www.npmjs.com/package/@robotixai/lexius-mcp) | [![npm](https://img.shields.io/npm/v/@robotixai/lexius-mcp)](https://www.npmjs.com/package/@robotixai/lexius-mcp) | MCP server for Claude Desktop / Claude Code (13 tools, stdio + SSE) |
| [@robotixai/lexius-cli](https://www.npmjs.com/package/@robotixai/lexius-cli) | [![npm](https://img.shields.io/npm/v/@robotixai/lexius-cli)](https://www.npmjs.com/package/@robotixai/lexius-cli) | Command-line interface (9 commands) |
| [@robotixai/lexius-agent](https://www.npmjs.com/package/@robotixai/lexius-agent) | [![npm](https://img.shields.io/npm/v/@robotixai/lexius-agent)](https://www.npmjs.com/package/@robotixai/lexius-agent) | Interactive Claude compliance consultant + hivemind swarm |
| [@robotixai/lexius-fetcher](https://www.npmjs.com/package/@robotixai/lexius-fetcher) | [![npm](https://img.shields.io/npm/v/@robotixai/lexius-fetcher)](https://www.npmjs.com/package/@robotixai/lexius-fetcher) | EUR-Lex CELLAR fetcher + deterministic extractor |

### Docker

| Image | Tag | Description |
|-------|-----|-------------|
| [robotixai/lexius-db](https://hub.docker.com/r/robotixai/lexius-db) | 0.1.0 | PostgreSQL 16 + pgvector, schema auto-applied (13 tables, 5 migrations) |
| [robotixai/lexius-api](https://hub.docker.com/r/robotixai/lexius-api) | 0.3.0 | Express REST API + SSE MCP + swarm (full platform server) |
| [robotixai/lexius-mcp](https://hub.docker.com/r/robotixai/lexius-mcp) | 0.1.3 | MCP server (node:20-slim, 202MB, self-contained bundle) |

### Workspace Packages (from source)

| Package | Description |
|---------|-------------|
| `@lexius/core` | Domain entities, ports, 14 use cases, legislation plugin system |
| `@lexius/db` | Drizzle schema, 5 migrations (0000-0004), seeds for 10 legislations |
| `@lexius/infra` | Drizzle repositories + OpenAI embedding service |
| `@lexius/logger` | Pino logger factory |

## Quick Start

### Zero to running — all via npm + Docker

```bash
# 1. Start the database (schema auto-applied, no migration needed)
docker run -d -p 5432:5432 \
  -e POSTGRES_PASSWORD=$POSTGRES_PASSWORD \
  -e POSTGRES_DB=$POSTGRES_DB \
  -e POSTGRES_USER=$POSTGRES_USER \
  robotixai/lexius-db
export DATABASE_URL=postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost:5432/$POSTGRES_DB

# 2. Fetch verbatim regulation text from EUR-Lex + run extractor
npx @robotixai/lexius-fetcher ingest --celex 32024R1689 --legislation eu-ai-act
npx @robotixai/lexius-fetcher ingest --celex 32022R2554 --legislation dora

# 3. Query from the CLI
npx @robotixai/lexius-cli legislations
npx @robotixai/lexius-cli article 99 --legislation eu-ai-act

# 4. Or run the interactive agent
export ANTHROPIC_API_KEY=sk-ant-...
npx @robotixai/lexius-agent
```

No git clone needed. The Docker image provides the schema; the fetcher populates it from EUR-Lex; the CLI/agent/MCP server query it.

For plugin development, `pnpm dev:stack` is a one-command alternative — it brings up the DB on port 5433, API on port 3001, auto-seeds EU AI Act if empty, mints an API key, and caches it in `~/.lexius-dev-key` so the plugin can be exercised against real data immediately.

### Docker Compose (full stack)

```bash
# Set your passwords
export POSTGRES_PASSWORD=secret
export OPENAI_API_KEY=sk-...

# Start DB + API
docker compose -f docker-compose.production.yml up -d

# The API is now at http://localhost:3000
# MCP proxy mode can point at it:
LEXIUS_API_URL=http://localhost:3000 LEXIUS_API_KEY=lx_... npx @robotixai/lexius-mcp
```

### Claude Desktop Integration

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "lexius": {
      "command": "npx",
      "args": ["@robotixai/lexius-mcp"],
      "env": {
        "DATABASE_URL": "postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost:5432/$POSTGRES_DB"
      }
    }
  }
}
```

Or use proxy mode (no local DB needed):

```json
{
  "mcpServers": {
    "lexius": {
      "command": "npx",
      "args": ["@robotixai/lexius-mcp"],
      "env": {
        "LEXIUS_API_URL": "https://your-lexius-instance.example.com",
        "LEXIUS_API_KEY": "lx_your_key_here"
      }
    }
  }
}
```

### Docker MCP

```bash
# Proxy mode
docker run -e LEXIUS_API_URL=https://your-lexius-instance.example.com \
           -e LEXIUS_API_KEY=lx_... \
           robotixai/lexius-mcp

# Direct mode
docker run -e DATABASE_URL=postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@host:5432/$POSTGRES_DB \
           robotixai/lexius-mcp
```

## Provenance

Every fact Lexius returns is labelled with its trust level:

| Tier | Meaning | Enforced by |
|------|---------|-------------|
| **AUTHORITATIVE** | Verbatim from official source (EUR-Lex CELLAR). SHA-256 hash-verified. | DB CHECK constraint + Specflow PROV-001 |
| **CURATED** | Written or reviewed by a domain expert. `curated_by` + `reviewed_at` recorded. | DB CHECK constraint + PROV-003 |
| **AI_GENERATED** | Model output, not expert-reviewed. `generated_by_model` recorded. | DB CHECK constraint |

## Data Pipeline

```
EUR-Lex CELLAR (XHTML)
    ↓ fetcher (lexius-fetch ingest --celex 32024R1689 or --source cima)
Articles table — 1,456 AUTHORITATIVE sections across 20 regulations, hash-verified
    ↓ extractor (lexius-fetch extract --legislation eu-ai-act)
Article Extracts — 8,123+ typed facts (fines EUR/KYD, %, dates, cross-refs, shall-clauses, imprisonment terms)
    ↓ cross-check (pnpm crosscheck)
CI fails if curated penalty amounts ≠ extracted values from verbatim law
    ↓ swarm (POST /api/v1/swarm/run)
Compliance workspace — 1,882 findings in 2.6s with 4 parallel agents
    ↓ synthesis
ComplianceReport with relianceByTier breakdown
```

## Legislations

### EU Regulations (via EUR-Lex CELLAR — XHTML)

| Legislation | CELEX | Articles | Extracts |
|-------------|-------|----------|----------|
| GDPR | 32016R0679 | 99 | 637 |
| EU AI Act | 32024R1689 | 126 | 1,181 |
| DORA | 32022R2554 | 64 | 554 |
| Digital Services Act | 32022R2065 | 93 | 699 |
| Digital Markets Act | 32022R1925 | 54 | 475 |
| Data Act | 32023R2854 | 50 | 397 |
| Data Governance Act | 32022R0868 | 38 | 273 |
| Cyber Resilience Act | 32024R2847 | 79 | 700 |
| MiCA | 32023R1114 | 155 | 1,672 |
| eIDAS 2.0 | 32024R1183 | 48 | 335 |

### Cayman Islands CIMA (via PDF)

| Legislation | Sections | Extracts |
|-------------|----------|----------|
| Monetary Authority Act (2020 Rev.) | 63 | ~180 |
| Banks and Trust Companies Act (2025 Rev.) | 29 | ~60 |
| Mutual Funds Act (2025 Rev.) | 52 | ~140 |
| Private Funds Act (2025 Rev.) | 33 | ~80 |
| Securities Investment Business Act (2020 Rev.) | 44 | ~100 |
| Insurance Act (2010) | 41 | ~80 |
| Anti-Money Laundering Regulations (2025 Rev.) | 107 | ~250 |
| Virtual Asset (Service Providers) Act (2024 Rev.) | 41 | ~110 |
| Proceeds of Crime Act (2024 Rev.) | 205 | ~350 |
| Beneficial Ownership Transparency Act (2023) | 35 | ~50 |

### Totals

| | Legislations | Sections/Articles | Extracts |
|---|---|---|---|
| EU | 10 | 806 | 6,923 |
| Cayman Islands | 10 | 650 | ~1,200 |
| **Total** | **20** | **1,456** | **~8,123** |

### Adding a New Regulation

```bash
# EU regulation (via EUR-Lex CELLAR)
lexius-fetch ingest --celex <CELEX> --legislation <id>

# Offshore regulation (via PDF)
lexius-fetch ingest --source pdf --url <pdf-url> --legislation <id>

# All CIMA acts (via registry)
lexius-fetch ingest --source cima

# Auto-populate derivedFrom on curated rows from cross-references
lexius-fetch backfill-derivation --legislation <id> --apply
```

## Hivemind Swarm

Parallel compliance analysis via autonomous agents sharing a Postgres workspace (stigmergic communication):

- **Deterministic** — no LLM in the agent loop; same data = same findings
- **Fast** — 1,882 findings in ~2.6s (4 agents, 126 EU AI Act articles)
- **Gap detection** — discovers obligations in the law that the curated set misses (701 candidates)
- **Provenance** — every finding inherits AUTHORITATIVE / CURATED / AI_GENERATED from its source

```bash
# Via API
curl -X POST localhost:3000/api/v1/swarm/run \
  -H "Authorization: Bearer lx_..." \
  -d '{"legislationId":"eu-ai-act","concurrency":4}'

# Via MCP
# Tool: legalai_run_swarm_assessment({ legislationId: "eu-ai-act" })
```

## API Endpoints

```
POST /api/v1/classify                     Classify an AI system
GET  /api/v1/obligations                  Obligations by role/risk level
POST /api/v1/penalties/calculate          Calculate penalty exposure
GET  /api/v1/articles/:number             Verbatim article text
GET  /api/v1/articles/:id/history         Article revision history
GET  /api/v1/articles/:id/extracts        Extracted facts (fines, dates, cross-refs)
GET  /api/v1/deadlines                    Compliance deadlines
GET  /api/v1/obligations/:id/derivation   Trace obligation to source articles
POST /api/v1/knowledge/search             Semantic search
POST /api/v1/faq/search                   FAQ search
GET  /api/v1/legislations                 List legislations
POST /api/v1/audit                        Full compliance report
POST /api/v1/swarm/run                    Start hivemind swarm
GET  /api/v1/swarm/:sessionId/findings    Query swarm workspace
POST /api/v1/swarm/:sessionId/synthesise  Report from swarm findings
GET  /health                              DB stats + uptime
GET  /mcp/sse                             Remote MCP via SSE
GET  /integration-manifest.json           Claude.ai integration manifest
```

Auth: `Authorization: Bearer lx_...` on all `/api/v1/*` routes. Health + manifest are unauthenticated.

## MCP Tools (13)

| Tool | Description |
|------|-------------|
| `legalai_classify_system` | Risk classification (signals + keywords + semantic) |
| `legalai_get_obligations` | Obligations filtered by role and risk level |
| `legalai_calculate_penalty` | Penalty calculation with SME rules |
| `legalai_get_article` | Verbatim article text (AUTHORITATIVE) |
| `legalai_get_deadlines` | Compliance deadlines with days remaining |
| `legalai_search_knowledge` | Semantic search across all content |
| `legalai_answer_question` | FAQ lookup |
| `legalai_run_assessment` | Structured assessments (Art. 6(3), GPAI) |
| `legalai_list_legislations` | Available legislations |
| `legalai_get_article_history` | Article revision history |
| `legalai_get_derivation_chain` | Obligation → source article trace |
| `legalai_get_article_extracts` | Deterministically extracted facts |
| `legalai_run_swarm_assessment` | Parallel hivemind assessment |

## CLI Commands

```bash
npx @robotixai/lexius-cli legislations
npx @robotixai/lexius-cli classify --legislation eu-ai-act --description "recruitment AI" --role provider
npx @robotixai/lexius-cli obligations --legislation eu-ai-act --role provider --risk-level high-risk
npx @robotixai/lexius-cli penalty --legislation eu-ai-act --violation high-risk-non-compliance --turnover 500000000
npx @robotixai/lexius-cli article 99 --legislation eu-ai-act
npx @robotixai/lexius-cli deadlines --legislation eu-ai-act
npx @robotixai/lexius-cli search "risk management" --legislation eu-ai-act --type obligation
npx @robotixai/lexius-cli audit --legislation eu-ai-act --description "recruitment AI" --role provider
```

## Contract Enforcement

22 contracts, 64 rules enforced by [Specflow](https://www.npmjs.com/package/@robotixai/specflow-cli):

```bash
npx @robotixai/specflow-cli enforce .
```

| Category | Contracts | Key Rules |
|----------|-----------|-----------|
| **Architecture** | `arch_clean_layers`, `arch_package_boundaries`, `arch_legislation_plugins` | Domain has no infra imports; consumers don't cross-import |
| **Provenance** | `provenance_tiers` | Every entity has `provenance_tier`; fetcher = AUTHORITATIVE only; seeds use helpers |
| **Extractor** | `extractor_determinism` | Pure/sync modules; no LLM; cross-check exits non-zero on mismatch |
| **Integration** | `integration_security` | No key hashes in responses; SSE uses auth |
| **Swarm** | `hivemind_swarm` | No LLM in agent loop; atomic claims; cleanup complete |
| **Offshore** | `offshore_adapters` | No LLM in PDF parsing; source_format=pdf; section merge; dynamic header detection |
| **Model Harness** | `model_harness` | No direct SDK imports in agent code; providers don't import domain |
| **Fetcher** | `fetcher_verbatim` | Records sourceHash + fetchedAt |
| **Curator** | `curator_audit`, `curator_auth`, `curator_integrity` | Audit atomicity, role-gated routes, AUTHORITATIVE immutable, tier transitions, `If-Match` concurrency, `derivedFrom` anchoring (C-INT-007) |
| **Audit** | `audit_report_integrity`, `audit_enhancement_layer`, `audit_agent_layer` | GenerateAuditReport is deterministic; enhancement via port |
| **Security** | `security_secrets`, `security_sql_safety`, `security_input_validation`, `security_no_eval` | No hardcoded creds; parameterised queries; Zod validation |
| **Quality** | `qa_domain_types` | No `any` in domain layer |

## Testing

```bash
pnpm test                              # All tests
pnpm --filter @lexius/core test        # 183 unit tests
pnpm --filter @lexius/api test         # 36 functional tests
pnpm --filter @lexius/fetcher test     # 78 extractor + parser tests
pnpm crosscheck                        # Penalty cross-check vs verbatim law
npx @robotixai/specflow-cli enforce .  # 20 contracts, 45 rules
```

## Documentation

Full spec documents in `docs/`:

| Type | Count | Index |
|------|-------|-------|
| **PRD** (Product Requirements) | 12 | [docs/prd/INDEX.md](docs/prd/INDEX.md) |
| **ARD** (Architecture Decisions) | 16 | [docs/ard/INDEX.md](docs/ard/INDEX.md) |
| **DDD** (Domain Design) | 15 | [docs/ddd/INDEX.md](docs/ddd/INDEX.md) |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `OPENAI_API_KEY` | Embeddings | OpenAI API key for semantic search |
| `ANTHROPIC_API_KEY` | Agent only | Anthropic API key for Claude agent |
| `DB_PASSWORD` | Docker | PostgreSQL password for docker-compose |
| `LEXIUS_API_URL` | MCP proxy | Hosted API URL (proxy mode) |
| `LEXIUS_API_KEY` | MCP proxy | API key for hosted API |
| `LEXIUS_PROFILE` | Curator | Profile name to load from credentials file (default: `default`) |
| `LEXIUS_CREDENTIALS_FILE` | Curator | Override path to the credentials file (default: `~/.config/lexius/credentials`) |
| `LEXIUS_CURATOR_ID` | Curator | Override the curator identity stamped on edits |
| `LEXIUS_ROLE` | MCP | Force the MCP server role (`reader` or `curator`), bypassing credentials file |

## Curator Workflow

Named domain experts can edit CURATED-tier facts (obligations in v1) via CLI without a code deploy. Every edit is audited, concurrency-safe, and re-embedded.

```bash
# 1. Admin generates a curator key
pnpm create-api-key --role curator --owner expert@example.com

# 2. Expert logs in (paste-a-key flow)
npx @robotixai/lexius-curate login --key lx_curator_... --url https://lexius.example.com
npx @robotixai/lexius-curate whoami

# 3. Expert works: dry-run by default, --apply to commit
npx @robotixai/lexius-curate obligations list --stale
npx @robotixai/lexius-curate obligations edit eu-ai-act-art-9-provider \
  --row-version 3 \
  --changes '{"obligation":"Establish and maintain a risk management system"}' \
  --reason "clarifying per Art. 9(2)" \
  --apply

# 4. View history + revert
npx @robotixai/lexius-curate obligations history eu-ai-act-art-9-provider
npx @robotixai/lexius-curate revert <edit_id> --reason "too aggressive" --apply
```

**Guarantees (PRD-013 / ARD-017):**

- **Transactional:** row update, audit insert, re-embed all land in one DB transaction.
- **Concurrency-safe:** `If-Match: <row_version>` required; mismatch returns 409.
- **Auditable:** every edit writes an append-only `curator_edits` row with editor, source (`cli`/`api`/`mcp`/etc.), reason, old/new values, and row_version before/after.
- **Anchored:** every CURATED row carries non-empty `derivedFrom` resolving to AUTHORITATIVE articles. No orphan interpretations.
- **Honest:** curators cannot override mined facts. If an `article_extracts` value is wrong, fix the extractor — don't paper over it with a curator edit.
- **Staleness-aware:** when the fetcher re-ingests an article with a changed `source_hash`, every CURATED obligation citing that article is flagged `needs_review`. Curators triage via `lexius-curate obligations list --stale`.

See [PRD-013](docs/prd/PRD-013-curator-workflow.md), [ARD-017](docs/ard/ARD-017-curator-workflow.md), and [DDD-016](docs/ddd/DDD-016-curator-workflow.md) for design detail.

## Tech Stack

- **Runtime:** Node.js 20+ (ESM)
- **Language:** TypeScript (strict)
- **Database:** PostgreSQL 16 + pgvector
- **ORM:** Drizzle
- **Embeddings:** OpenAI text-embedding-3-small (1536 dimensions)
- **API:** Express 5
- **MCP:** @modelcontextprotocol/sdk (stdio + SSE)
- **CLI:** Commander
- **Agent:** @anthropic-ai/sdk (Claude, temperature 0)
- **Bundler:** esbuild
- **Monorepo:** Turborepo + pnpm workspaces
- **PDF Parsing:** pdfjs-dist (offshore legislation)
- **Contracts:** Specflow (20 contracts, 45 rules)
- **Testing:** Vitest + Supertest (297 tests)

## License

MIT

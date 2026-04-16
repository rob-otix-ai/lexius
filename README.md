# Lexius

Legislation-agnostic compliance platform built on clean architecture. Provides deterministic, rule-based risk classification, obligation lookup, penalty calculation, and semantic search across regulatory text.

The EU AI Act (Regulation 2024/1689) is the first regulation seeded. The architecture supports adding any future regulation (DORA, NIS2, etc.) as a plugin without modifying the core domain.

> Lexius provides general regulatory guidance and does not constitute legal advice. For implementation support, consult qualified legal counsel.

## Architecture

```
┌──────────────────────────────────────────────────┐
│  Consumers                                        │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────────┐ ┌────────┐│
│  │ API │ │ MCP │ │ CLI │ │  Agent  │ │ Skills ││
│  └──┬──┘ └──┬──┘ └──┬──┘ └────┬────┘ └───┬────┘│
│     └───────┴───────┴─────────┴───────────┘     │
│                      │                           │
│              ┌───────┴───────┐                   │
│              │     Core      │ use cases + domain│
│              │  + Plugins    │ legislation-agnostic│
│              └───────┬───────┘                   │
│                      │                           │
│              ┌───────┴───────┐                   │
│              │      DB       │ Postgres + pgvector│
│              └───────────────┘                   │
└──────────────────────────────────────────────────┘
```

**Clean architecture** — domain entities and use cases have zero infrastructure dependencies. Legislation-specific logic (classification rules, assessments, penalty calculations) lives in plugins. Consumers are thin adapters over shared use cases. All enforced by [specflow](https://github.com/fall-development-rob/specflow-cli) contracts.

## Packages

| Package | Description | npm |
|---------|-------------|-----|
| `@lexius/db` | Drizzle ORM schema, migrations, seed scripts (pgvector embeddings) | `npm i @lexius/db` |
| `@lexius/core` | Domain entities, ports, 11 use cases, legislation plugin system | `npm i @lexius/core` |
| `@lexius/api` | Express REST API (10 endpoints + audit) | `npm i @lexius/api` |
| `@lexius/mcp` | MCP server (stdio + HTTP) — 9 tools, 4 resources, 4 prompts | `npx @lexius/mcp` |
| `@lexius/cli` | Command-line interface (9 commands) | `npx @lexius/cli` |
| `@lexius/agent` | Conversational Claude agent + audit agent (Anthropic SDK) | `npm i @lexius/agent` |
| `@lexius/infra` | Shared Drizzle repositories + OpenAI embedding service | `npm i @lexius/infra` |
| `@lexius/logger` | Shared pino logger factory | `npm i @lexius/logger` |

## Quick Start

### Prerequisites

- Node.js >= 20
- pnpm >= 9
- Docker (for PostgreSQL)

### Setup

```bash
git clone https://github.com/rob-otix-ai/lexius.git
cd lexius
cp .env.example .env         # edit to set OPENAI_API_KEY
pnpm setup                   # one-command setup: install → build → DB → migrate → seed → fetch verbatim text
```

The `pnpm setup` command runs `scripts/init.sh` which handles everything:

1. Checks prerequisites (Docker, pnpm, Node 20+)
2. Installs dependencies
3. Builds all packages
4. Starts Postgres + pgvector container
5. Applies schema migrations
6. Seeds structured data (obligations, FAQ, etc.) with embeddings
7. Fetches verbatim regulation text from EUR-Lex CELLAR (EU AI Act + DORA)

**Database options** (if you want manual control):

```bash
# Pre-built image (once published) — schema ready
docker compose up -d db

# Local dev — bare pgvector, run migrations yourself
docker compose --profile local up -d db-local
pnpm db:migrate
pnpm db:seed
```

### Run the API

```bash
cd packages/api
pnpm start
# Server starts on http://localhost:3000
```

### Run the CLI

```bash
cd packages/cli
pnpm start classify --description "facial recognition system in airports"
pnpm start deadlines --upcoming
pnpm start obligations --role provider --risk high-risk
pnpm start penalty --violation prohibited --turnover 50000000
pnpm start article 5
pnpm start search "transparency requirements" --type article
pnpm start audit -d "CV screening tool for recruitment" --role provider --turnover 50000000 --format markdown
pnpm start audit -d "Customer support chatbot" --enhanced  # LLM-enhanced recommendations
```

### Run the MCP Server

```bash
# Stdio transport (for Claude Desktop / Claude Code)
cd packages/mcp
pnpm start

# HTTP transport
pnpm start:http
```

**Claude Desktop / Claude Code configuration:**

```json
{
  "mcpServers": {
    "lexius": {
      "command": "npx",
      "args": ["-y", "@lexius/mcp"],
      "env": {
        "DATABASE_URL": "postgresql://legal_ai:password@localhost:5432/legal_ai",
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

Or from source:

```json
{
  "mcpServers": {
    "lexius": {
      "command": "node",
      "args": ["packages/mcp/dist/index.js"],
      "env": {
        "DATABASE_URL": "postgresql://legal_ai:password@localhost:5432/legal_ai",
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

### Run the Agent

```bash
cd packages/agent
pnpm start
# Interactive conversation with domain-expert compliance consultant
```

### Claude Code Skills

```
/eu-ai-classify    Interactive risk classification with follow-up questions
/eu-ai-compliance  Obligation checklist by role and risk level
/eu-ai-penalty     Penalty exposure calculator with SME rules
/eu-ai-search      Semantic search across regulation text
```

## API Endpoints

```
POST   /api/v1/classify              Classify an AI system's risk level
GET    /api/v1/deadlines             Get implementation milestones
GET    /api/v1/obligations           Filter obligations by role/risk level
POST   /api/v1/faq/search           Semantic FAQ search
POST   /api/v1/penalties/calculate   Calculate maximum fines
GET    /api/v1/articles/:number      Retrieve article summary + EUR-Lex URL
POST   /api/v1/assessments/:id      Run legislation-specific assessment
POST   /api/v1/knowledge/search     Semantic search across regulation text
GET    /api/v1/legislations          List available legislations
POST   /api/v1/audit                Full compliance assessment report
```

All endpoints accept `?legislationId=eu-ai-act` (default). The audit endpoint supports `enhanced: true` for LLM-powered recommendations.

## MCP Tools

| Tool | Description |
|------|-------------|
| `legalai_classify_system` | Risk classification (signals + keywords + semantic) |
| `legalai_check_deadlines` | Implementation milestones with days remaining |
| `legalai_get_obligations` | Obligations by role and risk level |
| `legalai_answer_question` | Semantic FAQ search |
| `legalai_calculate_penalty` | Fine calculation with SME rules |
| `legalai_get_article` | Article retrieval with EUR-Lex URL |
| `legalai_run_assessment` | Legislation-specific assessments (Art. 6(3), GPAI) |
| `legalai_search_knowledge` | Vector similarity search across all content |
| `legalai_generate_audit_report` | Full compliance report with optional LLM enhancement |

## Compliance Audit Report

The audit is the flagship feature. Give it a system description, get a structured compliance assessment:

```bash
lexius audit -d "AI system that screens CVs for a recruitment agency" \
  --role provider --turnover 50000000 --format markdown --enhanced
```

**Report includes:**
- Risk classification with confidence scoring and reasoning chain
- Obligations checklist (grouped by category with article references)
- Penalty exposure calculation (with SME rules)
- All applicable assessments (Art. 6(3) exception, GPAI systemic risk)
- Documentation checklist (for high-risk systems)
- Deadlines with days remaining
- Article citations with EUR-Lex deep links
- Recommendations (template-based or LLM-enhanced with `--enhanced`)
- Gap analysis identifying missing information

**Enhanced mode** (`--enhanced` / `enhanced: true`) adds Claude-powered analysis: executive summary, system-specific recommendations, risk areas, and reasoning chains. Uses `ANTHROPIC_MODEL_STRUCTURED` (defaults to Sonnet). Gracefully degrades without an API key.

## EU AI Act Coverage

- **36 articles** — 27 operational articles + 9 documentation items, with EUR-Lex deep links
- **8 Annex III high-risk categories** with keywords and examples
- **8 prohibited practices** (Art. 5)
- **4 transparency triggers** (Art. 50)
- **9 technical documentation items** — structured checklist for provider compliance
- **35 obligations** — 14 provider high-risk (inc. Art. 73 incident reporting), 8 deployer, 4 limited-risk, 8 GPAI, 1 universal
- **3 penalty tiers** — prohibited (35M/7%), high-risk (15M/3%), false info (7.5M/1.5%), with SME rules (Art. 99(6))
- **6 milestones** — 2024-2027 + Digital Omnibus proposal
- **25 FAQ entries** with semantic search
- **Art. 6(3) exception** — profiling hard-block, 4 qualifying conditions, documentation requirement
- **GPAI systemic risk** — 10^25 FLOPs threshold, Commission designation, Art. 52 notification

## Adding a New Regulation

```bash
# 1. Create seed data
packages/db/src/seeds/<regulation>/

# 2. Create a plugin
packages/core/src/legislation/<regulation>/  # implements LegislationPlugin

# 3. Register the plugin
# In packages/core/src/composition.ts

# 4. Seed
pnpm db:seed -- --legislation=<regulation>
```

No changes to domain entities, use cases, API routes, MCP tools, or CLI commands.

## Testing

```bash
pnpm test                          # All tests (142 passing)
pnpm --filter @lexius/core test    # Unit tests (106 — signals, keywords, penalties, assessments, use cases)
pnpm --filter @lexius/api test     # Functional tests (36 — all routes with supertest)
```

Tests include vitest snapshots for deterministic classification outputs — any regression shows a clear diff.

E2E tests (`tests/e2e/`) run against a live database and skip gracefully when unavailable.

## Contract Enforcement

[Specflow](https://github.com/fall-development-rob/specflow-cli) enforces architectural boundaries — 15 rules across 11 contracts:

```bash
specflow enforce .   # 15 rules, 11 contracts
specflow doctor .    # Health checks
specflow status .    # Compliance dashboard
```

| Category | Contracts | Rules |
|----------|-----------|-------|
| **Architecture** | Clean layers, plugin isolation, package boundaries | Domain has no infra imports, use cases use ports only, no regulation-specific code in generic domain, consumers can't cross-import |
| **Security** | Secrets, eval, SQL safety, input validation | No hardcoded credentials, no eval(), parameterised queries only, Zod on all API routes |
| **Quality** | Domain types | No `any` in domain layer |
| **Audit** | Report integrity, enhancement layer, model config | GenerateAuditReport is deterministic (no LLM), EnhanceAuditReport uses port, models from env vars |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | — |
| `OPENAI_API_KEY` | OpenAI API key (embeddings) | — |
| `DB_PASSWORD` | PostgreSQL password (docker-compose) | — |
| `ANTHROPIC_API_KEY` | Anthropic API key (enhanced mode + agent) | — |
| `ANTHROPIC_MODEL_REASONING` | Model for complex reasoning (interactive agent) | `claude-opus-4-6` |
| `ANTHROPIC_MODEL_STRUCTURED` | Model for JSON extraction (report enhancement) | `claude-sonnet-4-6` |
| `ANTHROPIC_MODEL` | Fallback model for both | `claude-sonnet-4-6` |
| `LEXIUS_API_KEY` | API key for authenticating requests (leave empty for open mode) | — |
| `PORT` | API/MCP HTTP server port | `3000` |
| `NODE_ENV` | Environment (controls log format) | `development` |
| `LOG_LEVEL` | Pino log level | `info` (`warn` for CLI) |

## Tech Stack

- **Runtime:** Node.js 20+ (ESM)
- **Language:** TypeScript (strict)
- **Database:** PostgreSQL 16 + pgvector
- **ORM:** Drizzle
- **Embeddings:** OpenAI text-embedding-3-large (3072 dimensions)
- **API:** Express
- **MCP:** @modelcontextprotocol/sdk
- **CLI:** Commander
- **Agent:** @anthropic-ai/sdk (Claude Opus/Sonnet)
- **Logging:** Pino
- **Monorepo:** Turborepo + pnpm workspaces
- **Contracts:** Specflow (15 rules, 11 contracts)
- **Testing:** Vitest + Supertest (142 tests, 23 snapshots)

## Documentation

| Type | Documents |
|------|-----------|
| **PRD** | [Platform Vision](docs/prd/PRD-001-platform-vision.md), [Specflow Integration](docs/prd/PRD-002-specflow-integration.md), [Audit Agent](docs/prd/PRD-003-compliance-audit-agent.md), [Agent Uplift](docs/prd/PRD-004-agent-uplift.md) |
| **ARD** | [Clean Architecture](docs/ard/ARD-001-clean-architecture.md), [Postgres+pgvector](docs/ard/ARD-002-postgres-pgvector.md), [Turborepo](docs/ard/ARD-003-turborepo-monorepo.md), [OpenAI Embeddings](docs/ard/ARD-004-openai-embeddings.md), [Express](docs/ard/ARD-005-express-api.md), [Specflow](docs/ard/ARD-006-specflow-contracts.md), [Audit Agent](docs/ard/ARD-007-compliance-audit-agent.md), [Agent Uplift](docs/ard/ARD-008-agent-uplift.md) |
| **DDD** | [Domain Model](docs/ddd/DDD-001-domain-model.md), [Use Cases](docs/ddd/DDD-002-use-cases.md), [Legislation Plugins](docs/ddd/DDD-003-legislation-plugins.md), [Infrastructure](docs/ddd/DDD-004-infrastructure.md), [Consumers](docs/ddd/DDD-005-consumers.md), [Audit Agent](docs/ddd/DDD-006-audit-agent.md), [Agent Uplift](docs/ddd/DDD-007-agent-uplift.md) |

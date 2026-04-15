# Lexius

Legislation-agnostic compliance platform built on clean architecture. Provides deterministic, rule-based risk classification, obligation lookup, penalty calculation, and semantic search across regulatory text.

The EU AI Act (Regulation 2024/1689) is the first regulation seeded. The architecture supports adding any future regulation (DORA, NIS2, etc.) as a plugin without modifying the core domain.

## Architecture

```
┌──────────────────────────────────────────────┐
│  Consumers                                    │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌───────────────┐  │
│  │ API │ │ MCP │ │ CLI │ │ Claude Agent  │  │
│  └──┬──┘ └──┬──┘ └──┬──┘ └──────┬────────┘  │
│     └───────┴───────┴───────────┘            │
│                  │                            │
│           ┌──────┴──────┐                     │
│           │    Core     │  use cases + domain │
│           └──────┬──────┘                     │
│                  │                            │
│           ┌──────┴──────┐                     │
│           │     DB      │  Postgres + pgvector│
│           └─────────────┘                     │
└──────────────────────────────────────────────┘
```

**Clean architecture** — domain entities and use cases have zero infrastructure dependencies. Legislation-specific logic (classification rules, assessments, penalty calculations) lives in plugins. Consumers are thin adapters over shared use cases.

## Packages

| Package | Description |
|---------|-------------|
| `@legal-ai/db` | Drizzle ORM schema, migrations, seed scripts (pgvector embeddings) |
| `@legal-ai/core` | Domain entities, ports, use cases, legislation plugin system |
| `@legal-ai/api` | Express REST API |
| `@legal-ai/mcp` | MCP server (stdio + HTTP) with 9 tools, 4 resources, 4 prompts |
| `@legal-ai/cli` | Command-line interface |
| `@legal-ai/agent` | Conversational Claude agent (Anthropic SDK) |
| `@legal-ai/logger` | Shared pino logger factory |

## Quick Start

### Prerequisites

- Node.js >= 20
- pnpm >= 9
- Docker (for PostgreSQL)

### Setup

```bash
# Clone
git clone https://github.com/fall-development-rob/lexius.git
cd legal-ai

# Install dependencies
pnpm install

# Start the database
cp .env.example .env  # edit with your secrets
docker compose up -d db

# Run migrations and seed
pnpm db:migrate
pnpm db:seed

# Build all packages
pnpm build
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
```

### Run the MCP Server

```bash
# Stdio transport (for Claude Desktop / Claude Code)
cd packages/mcp
pnpm start

# HTTP transport
pnpm start:http
```

**Claude Desktop configuration:**

```json
{
  "mcpServers": {
    "legal-ai": {
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
# Interactive conversation with the compliance assistant
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
```

All endpoints accept `?legislationId=eu-ai-act` (default).

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

## EU AI Act Coverage

- **27 articles** with summaries and EUR-Lex deep links
- **8 Annex III high-risk categories** with keywords and examples
- **8 prohibited practices** (Art. 5)
- **4 transparency triggers** (Art. 50)
- **34 obligations** across provider, deployer, GPAI, and universal roles
- **3 penalty tiers** with SME reduction rules (Art. 99)
- **5 implementation deadlines** (2024-2027)
- **24 FAQ entries** with semantic search
- **Art. 6(3) exception assessment** with profiling hard-block
- **GPAI systemic risk assessment** (10^25 FLOPs threshold)

## Adding a New Regulation

1. Create seed data in `packages/db/src/seeds/<regulation>/`
2. Create a plugin at `packages/core/src/legislation/<regulation>/` implementing `LegislationPlugin`
3. Register the plugin in `packages/core/src/composition.ts`
4. Run `pnpm db:seed -- --legislation=<regulation>`

No changes to domain entities, use cases, API routes, MCP tools, or CLI commands.

## Contract Enforcement

[Specflow](https://github.com/fall-development-rob/specflow-cli) enforces architectural boundaries:

```bash
specflow enforce .   # 10 rules across 8 contracts
specflow doctor .    # Health checks
specflow status .    # Compliance dashboard
```

**Contracts enforced:**

| Contract | Rules |
|----------|-------|
| Clean architecture layers | Domain has no infra imports, use cases use ports only |
| Legislation plugin isolation | No regulation-specific code in generic domain |
| Package boundaries | Consumers can't import from other consumers |
| Domain type safety | No `any` in domain layer |
| SQL safety | No raw string concatenation in queries |
| Input validation | Zod validation on all API routes |
| No hardcoded secrets | Pattern detection for credentials |
| No eval | Forbids eval() and Function constructor |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | — |
| `OPENAI_API_KEY` | OpenAI API key (for embeddings) | — |
| `DB_PASSWORD` | PostgreSQL password (docker-compose) | — |
| `PORT` | API/MCP HTTP server port | `3000` |
| `NODE_ENV` | Environment (controls log format) | `development` |
| `LOG_LEVEL` | Pino log level | `info` (`warn` for CLI) |

## Tech Stack

- **Runtime:** Node.js (ESM)
- **Language:** TypeScript (strict)
- **Database:** PostgreSQL 16 + pgvector
- **ORM:** Drizzle
- **Embeddings:** OpenAI text-embedding-3-large (3072 dimensions)
- **API:** Express
- **MCP:** @modelcontextprotocol/sdk
- **CLI:** Commander
- **Agent:** @anthropic-ai/sdk (Claude)
- **Logging:** Pino
- **Monorepo:** Turborepo + pnpm workspaces
- **Contracts:** Specflow

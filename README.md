# Lexius

Legislation-agnostic AI compliance platform with provenance-tracked, deterministic regulatory analysis. Verbatim regulation text from EUR-Lex, deterministic fact extraction, parallel hivemind assessment, and honest provenance labelling on every claim.

EU AI Act and DORA are live. Adding a new regulation is two commands — the fetcher, extractor, and swarm handle the rest.

> Lexius provides general regulatory guidance and does not constitute legal advice. For implementation support, consult qualified legal counsel.

## Install

```bash
# MCP server — connect Claude Desktop to the compliance database
npx @robotixai/lexius-mcp

# CLI — query from your terminal
npx @robotixai/lexius-cli
```

Or from source:

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

## Packages

| Package | npm | Description |
|---------|-----|-------------|
| `@robotixai/lexius-mcp` | [![npm](https://img.shields.io/npm/v/@robotixai/lexius-mcp)](https://www.npmjs.com/package/@robotixai/lexius-mcp) | MCP server for Claude Desktop / Claude Code (13 tools) |
| `@robotixai/lexius-cli` | [![npm](https://img.shields.io/npm/v/@robotixai/lexius-cli)](https://www.npmjs.com/package/@robotixai/lexius-cli) | Command-line interface (9 commands) |
| `@lexius/api` | — | Express REST API (15 endpoints + SSE MCP + swarm) |
| `@lexius/core` | — | Domain entities, ports, 14 use cases, plugin system |
| `@lexius/agent` | — | Claude agent + hivemind swarm (deterministic, temperature 0) |
| `@lexius/fetcher` | — | EUR-Lex CELLAR fetcher + deterministic extractor |
| `@lexius/db` | — | Drizzle schema, migrations (0000–0004), seeds |
| `@lexius/infra` | — | Repositories + OpenAI embeddings |
| `@lexius/logger` | — | Pino logger |

## Provenance

Every fact Lexius returns is labelled with its trust level:

| Tier | Meaning | Example |
|------|---------|---------|
| **AUTHORITATIVE** | Verbatim from official source (EUR-Lex CELLAR). Hash-verified. | Article 99 full text, extracted fine amounts |
| **CURATED** | Written or reviewed by a domain expert. Attributed. | Obligation paraphrases, FAQ answers |
| **AI_GENERATED** | Model output, not expert-reviewed. Flagged. | Gap findings from swarm analysis |

Provenance is enforced by CHECK constraints at the database level and Specflow contracts at CI.

## Data Pipeline

```
EUR-Lex CELLAR (XHTML)
    ↓ fetcher (lexius-fetch ingest)
Articles table (AUTHORITATIVE, hash-verified, 190 articles + annexes)
    ↓ extractor (lexius-fetch extract)
Article Extracts table (fines, percentages, dates, cross-refs, shall-clauses)
    ↓ cross-check (pnpm crosscheck)
CI fails if a curated penalty amount doesn't match the extracted value
    ↓ swarm (POST /swarm/run)
Compliance workspace (1,882 findings in 2.6s, 4 parallel agents)
    ↓ synthesis
ComplianceReport with relianceByTier
```

## Legislations

| Legislation | CELEX | Articles | Annexes | Extracts |
|-------------|-------|----------|---------|----------|
| EU AI Act | 32024R1689 | 113 | 13 | ~1,180 |
| DORA | 32022R2554 | 64 | 0 | ~554 |

Adding a new regulation:

```bash
lexius-fetch ingest --celex <CELEX> --legislation <id>
lexius-fetch backfill-derivation --legislation <id> --apply
```

Obligations, penalties, risk categories, FAQ still require curation — the fetcher handles articles and extracts.

## Hivemind Swarm

Parallel compliance analysis. N autonomous agents claim articles from a work queue, share findings through a Postgres workspace table (stigmergic communication), and a synthesis pass produces the report.

```bash
# Via API
curl -X POST localhost:3000/api/v1/swarm/run \
  -H "Authorization: Bearer lx_..." \
  -d '{"legislationId":"eu-ai-act","concurrency":4}'

# Via MCP tool
# legalai_run_swarm_assessment({ legislationId: "eu-ai-act" })
```

Key properties:
- **Deterministic** — no LLM in the agent loop; same input = same output
- **Fast** — 1,882 findings in ~2.6s (4 agents, EU AI Act)
- **Gap detection** — finds obligations in the law that the curated set misses
- **Provenance** — every finding inherits its source's tier

## API

```
POST /api/v1/classify                    Classify an AI system
GET  /api/v1/obligations                 Filter obligations
POST /api/v1/penalties/calculate         Calculate penalty exposure
GET  /api/v1/articles/:number            Retrieve verbatim article
GET  /api/v1/articles/:id/history        Article revision history
GET  /api/v1/articles/:id/extracts       Deterministic extracts (fines, dates, etc.)
GET  /api/v1/deadlines                   Compliance deadlines
GET  /api/v1/obligations/:id/derivation  Trace obligation to source articles
POST /api/v1/knowledge/search            Semantic search
POST /api/v1/faq/search                  FAQ search
GET  /api/v1/legislations                List legislations
POST /api/v1/audit                       Full compliance report
POST /api/v1/swarm/run                   Start swarm assessment
GET  /api/v1/swarm/:sessionId/findings   Query swarm workspace
POST /api/v1/swarm/:sessionId/synthesise Generate report from swarm
GET  /health                             DB stats, uptime, article/extract counts
GET  /mcp/sse                            Remote MCP via SSE
```

All endpoints require `Authorization: Bearer lx_...` (API key auth). `GET /health` and `GET /integration-manifest.json` are unauthenticated.

## MCP Tools

| Tool | Description |
|------|-------------|
| `legalai_classify_system` | Risk classification |
| `legalai_get_obligations` | Obligations by role/risk |
| `legalai_calculate_penalty` | Penalty calculation |
| `legalai_get_article` | Verbatim article text |
| `legalai_get_deadlines` | Compliance deadlines |
| `legalai_search_knowledge` | Semantic search |
| `legalai_answer_question` | FAQ lookup |
| `legalai_run_assessment` | Structured assessments |
| `legalai_list_legislations` | Available legislations |
| `legalai_get_article_history` | Article revision history |
| `legalai_get_derivation_chain` | Obligation → source articles |
| `legalai_get_article_extracts` | Extracted facts (fines, dates, cross-refs) |
| `legalai_run_swarm_assessment` | Parallel hivemind assessment |

## Contract Enforcement

17 contracts, 39 rules enforced by [Specflow](https://www.npmjs.com/package/@robotixai/specflow-cli):

```bash
npx @robotixai/specflow-cli enforce .
```

| Contract | Rules | Enforces |
|----------|-------|----------|
| `arch_clean_layers` | 3 | Domain has no infra imports |
| `arch_package_boundaries` | 2 | No cross-consumer imports |
| `provenance_tiers` | 7 | Every entity has provenance_tier; fetcher = AUTHORITATIVE only |
| `extractor_determinism` | 6 | Extractors are pure/sync; no LLM; cross-check exits non-zero on mismatch |
| `integration_security` | 3 | No key hashes in responses; SSE routes use auth |
| `hivemind_swarm` | 4 | No LLM in agent loop; atomic claims; cleanup deletes both tables |
| `fetcher_verbatim` | 2 | Fetcher records sourceHash + fetchedAt |
| `audit_report_integrity` | 2 | GenerateAuditReport is deterministic |
| + 9 more | 10 | Security, QA, plugin isolation |

## Testing

```bash
pnpm test                              # All tests
pnpm --filter @lexius/core test        # 183 unit tests
pnpm --filter @lexius/api test         # 36 functional tests
pnpm --filter @lexius/fetcher test     # 51 extractor tests
pnpm crosscheck                        # Penalty cross-check vs extracted values
npx @robotixai/specflow-cli enforce .  # 17 contracts, 39 rules
```

## Documentation

| Type | Count | Topics |
|------|-------|--------|
| **PRD** | 10 | Platform vision, Specflow, Audit agent, Agent uplift, DORA, EUR-Lex fetcher, Provenance, Extractor, Claude integration, Hivemind swarm |
| **ARD** | 14 | Clean architecture, Postgres, Turborepo, Embeddings, Express, Specflow, Audit, Agent, DORA, Fetcher, Provenance, Extractor, Integration, Swarm |
| **DDD** | 13 | Domain model, Use cases, Plugins, Infrastructure, Consumers, Audit, Agent, DORA, Fetcher, Provenance, Extractor, Integration, Swarm |

See `docs/prd/INDEX.md`, `docs/ard/INDEX.md`, `docs/ddd/INDEX.md`.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `OPENAI_API_KEY` | Yes | OpenAI API key (embeddings) |
| `ANTHROPIC_API_KEY` | Agent only | Anthropic API key |
| `DB_PASSWORD` | Docker | PostgreSQL password for docker-compose |

## License

MIT

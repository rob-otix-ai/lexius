# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/).
Versioning follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- **Model harness** — provider-agnostic LLM abstraction. The agent no longer imports `@anthropic-ai/sdk` directly; it uses a `CompletionProvider` interface with 5 implementations:
  - `AnthropicProvider` (default)
  - `OpenAIProvider` (GPT-4o, o1, o3)
  - `OpenRouterProvider` (single key for any model — Claude, GPT-4, Llama, Gemini)
  - `OllamaProvider` (local models, no API key)
  - `MockProvider` (canned responses for testing)
  - `--provider` CLI flag: `npx @robotixai/lexius-agent --provider openrouter`
  - Specflow contract `model_harness.yml` (2 rules: no SDK imports in agent code, providers don't import domain)
- **Offshore CIMA** — 10 Cayman Islands acts ingested via PDF source adapter. 650 sections, 1,200 extracts (88 KYD fines, 28 imprisonment terms, 1,082 shall-clauses).
  - Source adapter interface (`CellarAdapter` + `PdfAdapter`)
  - Common-law section parser with title/body merge + dynamic header detection
  - CIMA registry (10 acts with verified PDF URLs)
  - `fine_amount_kyd` + `imprisonment_term` extract types (migration 0005)
  - Specflow contract `offshore_adapters.yml` (4 rules)

## [0.3.0] - 2026-04-17

### Added
- **Hivemind swarm** — parallel compliance analysis via N autonomous agents sharing a Postgres workspace (stigmergic communication). 1,882 findings in 2.6s for EU AI Act. Fully deterministic (no LLM in the agent loop). Gap detection surfaces obligations in the law that the curated set misses.
  - `compliance_workspace` + `swarm_work_queue` tables (migration 0004)
  - `POST /api/v1/swarm/run`, `GET /swarm/:sessionId/findings`, `POST /swarm/:sessionId/synthesise`
  - `legalai_run_swarm_assessment` MCP tool
  - Specflow contract `hivemind_swarm.yml` (4 rules)
- **Claude.ai integration** — hosted API with API key auth, SSE MCP transport, integration manifest
  - `api_keys` table with hashed keys (migration 0003)
  - `Authorization: Bearer lx_...` auth on all API routes
  - `_provenance` metadata block on every response
  - `GET /mcp/sse` + `POST /mcp/messages` for remote MCP
  - `GET /integration-manifest.json` with DB-loaded enums
  - MCP proxy mode (`LEXIUS_API_URL` + `LEXIUS_API_KEY`)
  - Specflow contract `integration_security.yml` (3 rules)
- **8 additional EU regulations** — GDPR, Digital Services Act, Digital Markets Act, Data Act, Data Governance Act, Cyber Resilience Act, MiCA, eIDAS 2.0. All fetched verbatim from EUR-Lex CELLAR with deterministic extraction. 10 regulations, 806 articles, 6,923 extracts total.
- **Docker images**
  - `robotixai/lexius-db:0.1.0` — Postgres 16 + pgvector, 13 tables auto-applied
  - `robotixai/lexius-api:0.3.0` — Express REST API + SSE MCP server
  - `robotixai/lexius-mcp:0.1.3` — self-contained MCP server (202MB)
- **npm packages**
  - `@robotixai/lexius-api@0.3.0` — REST API + SSE MCP server
  - `@robotixai/lexius-agent@0.1.0` — interactive Claude compliance consultant
  - `@robotixai/lexius-cli@0.1.2` — 9 CLI commands
  - `@robotixai/lexius-mcp@0.1.3` — 13 MCP tools (stdio + SSE)
  - `@robotixai/lexius-fetcher@0.1.0` — EUR-Lex CELLAR fetcher + deterministic extractor
- **Docker MCP registry submission** — PR #2731 on docker/mcp-registry

### Changed
- Agent uses `temperature: 0` + DB-loaded enum values for tool schemas
- Agent system prompt enforces provenance-aware responses (AUTHORITATIVE/CURATED/AI_GENERATED labels)
- Penalty `violationType` exposed as enum in tool schema; normalised fallback for underscore variants

## [0.2.0] - 2026-04-16

### Added
- **Deterministic extractor** — 6 pure regex parsers extract typed facts from verbatim article text
  - `article_extracts` + `article_extract_revisions` tables (migration 0002)
  - Extract types: `fine_amount_eur`, `turnover_percentage`, `date`, `article_cross_ref`, `annex_cross_ref`, `shall_clause`
  - `lexius-fetch extract` CLI subcommand
  - `lexius-fetch backfill-derivation` CLI for auto-populating `derivedFrom`
  - CI cross-check (`pnpm crosscheck`) fails build on penalty/extract mismatch
  - Specflow contract `extractor_determinism.yml` (6 rules)
  - `GET /api/v1/articles/:id/extracts` route + `legalai_get_article_extracts` MCP tool
- **Annex extraction** — XHTML parser extended to extract all annexes from CELLAR alongside articles (EU AI Act: 13 annexes, I–XIII)
- **Provenance Tier 1** — three-tier provenance model across all entities
  - `provenance_tier` pgEnum (AUTHORITATIVE / CURATED / AI_GENERATED)
  - Per-tier required fields enforced by DB CHECK constraints
  - `article_revisions` table with BEFORE UPDATE trigger for amendment history
  - `derivedFrom` arrays on obligations + FAQ linking to source articles
  - Seed helpers `curatedSeedProvenance()` / `aiSeedProvenance()`
  - `relianceByTier` in ComplianceReport
  - Specflow contract `provenance_tiers.yml` (7 rules)
  - `GET /api/v1/articles/:id/history`, `GET /api/v1/obligations/:id/derivation`
  - `legalai_get_article_history`, `legalai_get_derivation_chain` MCP tools

### Changed
- All 190 articles now AUTHORITATIVE (verbatim from EUR-Lex CELLAR)
- Removed hand-curated annex stubs (annex-iv.ts, doc-register.ts) — fetcher handles them
- Articles seed skips rows already AUTHORITATIVE on re-seed
- EU AI Act penalty `globalTurnoverPercentage` corrected to 1% (was 1.5%) per verbatim Art. 99(5)

## [0.1.0] - 2026-04-15

### Added
- **Core platform** — clean architecture with legislation plugin system
  - Domain entities: Article, Obligation, Penalty, Deadline, FAQ, RiskCategory
  - 11 use cases: classify, obligations, penalty, search, deadlines, article, FAQ, assessment, audit, legislations
  - Port interfaces for repositories + embedding service
- **EU AI Act plugin** — 113 articles, 35 obligations, 3 penalty tiers, 8 risk categories, 25 FAQ, 6 deadlines
- **DORA plugin** — 64 articles, 26 obligations, 2 penalty tiers, 8 risk categories, 20 FAQ, 5 deadlines
- **EUR-Lex fetcher** — CELLAR REST client with XHTML parser, idempotent ingest, change detection via SHA-256
- **Express API** — 10 REST endpoints + audit report generation
- **MCP server** — stdio + HTTP transports, 9 tools, 4 resources, 4 prompts
- **CLI** — 9 commands (classify, obligations, penalty, article, deadlines, search, assess, legislations, audit)
- **Agent** — conversational Claude agent + audit agent with reasoning loop
- **Specflow contracts** — 11 contracts, 15 rules (architecture, security, quality, audit integrity)
- **CI** — GitHub Actions (build, lint contracts, unit tests, functional tests, E2E)
- **Monorepo** — Turborepo + pnpm workspaces, 9 packages
- **Database** — PostgreSQL 16 + pgvector, Drizzle ORM, containerised

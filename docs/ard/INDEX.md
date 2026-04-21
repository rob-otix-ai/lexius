# Architecture Decision Records

- [ARD-001: Clean Architecture](ARD-001-clean-architecture.md) — clean architecture with legislation plugin system
- [ARD-002: PostgreSQL + pgvector](ARD-002-postgres-pgvector.md) — containerised Postgres with vector search for regulation text
- [ARD-003: Turborepo Monorepo](ARD-003-turborepo-monorepo.md) — pnpm workspaces + Turborepo for multi-package builds
- [ARD-004: OpenAI Embeddings](ARD-004-openai-embeddings.md) — text-embedding-3-large for semantic search, stored alongside raw text
- [ARD-005: Express API](ARD-005-express-api.md) — Express.js as the HTTP API framework
- [ARD-006: Specflow Contracts](ARD-006-specflow-contracts.md) — YAML contract enforcement via specflow-cli
- [ARD-007: Compliance Audit Agent](ARD-007-compliance-audit-agent.md) — two-layer design: deterministic core use case + LLM-enhanced agent
- [ARD-008: Agent Uplift](ARD-008-agent-uplift.md) — enhancement service port, model strategy, reasoning loop, domain-expert prompts
- [ARD-009: DORA Plugin](ARD-009-dora-plugin.md) — DORA implementation approach, risk category mapping, MS-level variation
- [ARD-010: EUR-Lex Fetcher](ARD-010-eurlex-fetcher.md) — new fetcher package, CELLAR REST, XHTML parsing, provenance
- [ARD-011: Provenance Architecture](ARD-011-provenance-architecture.md) — provenance_tier enum, CHECK-enforced per-tier fields, append-only article_revisions with DB trigger
- [ARD-012: Deterministic Extractor](ARD-012-deterministic-extractor.md) — extractors in @lexius/fetcher, article_extracts table, pure-function modules, cross-check as CI script
- [ARD-013: Claude Integration](ARD-013-claude-integration.md) — single API for both channels, Railway + Neon deploy, API key auth, MCP proxy mode, SSE transport
- [ARD-014: Hivemind Swarm](ARD-014-hivemind-swarm.md) — Postgres-backed stigmergic swarm, Promise.all concurrency, deterministic agents, gap detection
- [ARD-015: Model Harness](ARD-015-model-harness.md) — single CompletionProvider interface, provider-internal translation, factory selection via env var
- [ARD-016: Offshore CIMA](ARD-016-offshore-cima.md) — PDF source adapter, common-law section parser, CIMA registry, pdfjs-dist
- [ARD-017: Curator Workflow](ARD-017-curator-workflow.md) — live CURATED-tier editing, append-only audit log, optimistic concurrency, transactional cross-check and re-embedding, credential file pattern, dynamic MCP tool listing

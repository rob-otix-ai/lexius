# Domain Design Documents

- [DDD-001: Domain Model](DDD-001-domain-model.md) — entities, value objects, and port interfaces
- [DDD-002: Use Cases](DDD-002-use-cases.md) — application use cases and orchestration
- [DDD-003: Legislation Plugins](DDD-003-legislation-plugins.md) — plugin interface and EU AI Act as first implementation
- [DDD-004: Infrastructure](DDD-004-infrastructure.md) — containerised Postgres, Drizzle, OpenAI embeddings, composition root
- [DDD-005: Consumers](DDD-005-consumers.md) — API, MCP, CLI, Skills, and Claude Agent
- [DDD-006: Audit Agent](DDD-006-audit-agent.md) — GenerateAuditReport use case, ComplianceReport model, confidence scoring, report rendering
- [DDD-007: Agent Uplift](DDD-007-agent-uplift.md) — EnhancementService port, EnhanceAuditReport use case, model config, reasoning loop, auditable sources
- [DDD-008: DORA Plugin](DDD-008-dora-plugin.md) — plugin structure, signal schema, assessments, seed data, composition root update
- [DDD-009: EUR-Lex Fetcher](DDD-009-eurlex-fetcher.md) — @lexius/fetcher package implementation, parser, ingestion, schema migration
- [DDD-010: Provenance](DDD-010-provenance.md) — schema migration, triggers, domain value objects, GetDerivationChain, GetArticleHistory, seed helpers, rollout
- [DDD-011: Deterministic Extractor](DDD-011-deterministic-extractor.md) — article_extracts schema, per-type parser modules, extract-runner idempotency, cross-check script, CLI wiring
- [DDD-012: Claude Integration](DDD-012-claude-integration.md) — api_keys schema, proxy container, SSE transport, integration manifest, Dockerfile, Railway deploy, npm publish

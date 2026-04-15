# PRD-001: Legal AI Compliance Platform

## Status: Draft
## Date: 2026-04-15
## Author: Robert

---

## Problem Statement

Organisations deploying AI systems face a growing patchwork of legislation — the EU AI Act today, DORA, NIS2, and sector-specific regulations tomorrow. Existing tools either hardcode a single regulation into application logic, rely on probabilistic LLM interpretation of legal text (unacceptable in regulated domains), or offer no programmatic access at all.

There is no legislation-agnostic compliance engine that combines deterministic rule evaluation with semantic search, exposes its capabilities through multiple interfaces, and can be extended to new regulations without rewriting the core.

## Vision

A compliance platform that treats legislation as data, classification as domain logic, and delivery channels as pluggable infrastructure. The EU AI Act is the first regulation seeded into the system. The architecture must support adding any future regulation without modifying the core domain.

## Users

| Persona | Need |
|---------|------|
| **Compliance Officer** | Classify AI systems, generate obligation checklists, assess penalty exposure |
| **Legal Counsel** | Search regulation text semantically, retrieve specific articles with citations |
| **Engineering Lead** | Integrate compliance checks into CI/CD and development workflows |
| **GRC Team** | Audit trail of classifications, cross-regulation analysis |
| **AI Agent Developer** | Programmatic access to compliance logic via API, MCP, or SDK agent |

## Product Requirements

### P0 — Must Have

1. **Legislation-agnostic data model** — any regulation can be seeded without schema changes
2. **EU AI Act seed** — full regulation text, articles, annexes, obligations, penalties, deadlines, FAQ
3. **Risk classification engine** — deterministic signal-based + keyword matching, with vector similarity as a secondary signal
4. **Obligation lookup** — by legislation, role, and risk level
5. **Penalty calculation** — per-legislation penalty rules with entity-specific factors (SME, turnover)
6. **Article retrieval** — full text + summary + source URL, with vector search
7. **REST API** — Express, all core use cases exposed as endpoints
8. **MCP server** — stdio + HTTP transports, wrapping the same core logic
9. **CLI** — command-line access to all core operations
10. **Vector search** — OpenAI embeddings stored in pgvector, enabling semantic queries across regulation text
11. **Contract compliance** — specflow-cli integration enforcing architectural rules via YAML contracts

### P1 — Should Have

12. **Claude Code skills** — interactive compliance workflows within Claude Code
13. **Claude Agent (SDK)** — conversational agent with multi-turn classification and reasoning
14. **Deadline tracking** — dynamic days-remaining calculations, upcoming milestone filtering
15. **GPAI systemic risk assessment** — FLOPs threshold evaluation (EU AI Act specific, via plugin)
16. **Art. 6(3) exception assessment** — conditional exception evaluation (EU AI Act specific, via plugin)

### P2 — Nice to Have

17. **Multi-regulation cross-referencing** — identify overlapping obligations across legislations
18. **Compliance reporting** — exportable compliance reports per system
19. **Audit logging** — classification history with timestamps and inputs
20. **Web dashboard** — UI layer over the API

## Out of Scope (for now)

- User authentication / multi-tenancy
- Real-time regulation update feeds
- Jurisdictional variance (member state implementations)
- Document generation (technical documentation, FRIA templates)

## Success Metrics

- EU AI Act fully seeded and queryable within the first iteration
- Classification accuracy matches the lexbeam reference implementation on all 108 test cases
- A second regulation (e.g., DORA) can be added by writing seed data and a plugin — zero core changes
- All consumers (API, MCP, CLI) return identical results for the same inputs
- specflow contracts enforce architectural boundaries on every commit

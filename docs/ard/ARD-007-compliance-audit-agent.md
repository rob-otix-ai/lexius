# ARD-007: Compliance Audit Agent Architecture

## Status: Accepted
## Date: 2026-04-15

---

## Context

The platform has 9 use cases that each answer one question (classify, obligations, penalties, etc.). Users must manually orchestrate these to build a complete compliance picture. We need an agent that autonomously sequences these use cases and produces a structured report.

## Decision

Implement the audit agent as a **use case in the core package** that orchestrates existing use cases, with an Anthropic SDK wrapper in packages/agent for LLM-enhanced reasoning.

### Two-Layer Design

```
┌─────────────────────────────────────────┐
│  AuditAgent (packages/agent)             │
│  LLM reasoning, follow-up questions,    │
│  natural language recommendations        │
│                                          │
│  Uses:                                   │
│  ┌─────────────────────────────────┐    │
│  │  GenerateAuditReport (core)      │    │
│  │  Deterministic orchestration     │    │
│  │  of existing use cases           │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

**Layer 1: GenerateAuditReport (packages/core/src/use-cases/)**
- Pure orchestration — calls ClassifySystem, GetObligations, CalculatePenalty, RunAssessment, GetDeadlines, GetArticle in sequence
- Deterministic — same input always produces same report (minus LLM recommendations)
- Returns a structured `ComplianceReport` object
- No LLM dependency — can run without Anthropic API key

**Layer 2: AuditAgent (packages/agent/)**
- Wraps GenerateAuditReport with Claude reasoning
- Adds natural language recommendations
- Can run in interactive mode (asks follow-up questions)
- Renders markdown output

### Why Two Layers

1. **Testability** — the core use case is fully testable without LLM mocks
2. **Clean architecture** — deterministic logic stays in core, LLM reasoning stays in the agent consumer
3. **Multiple consumers** — API and CLI call GenerateAuditReport directly (no LLM needed), agent adds reasoning on top
4. **Cost control** — basic report is free (no API calls beyond embeddings), enhanced report uses Claude

### Delivery Channels

| Channel | Calls | LLM? |
|---------|-------|------|
| `lexius audit` CLI | GenerateAuditReport | No (add `--enhanced` for LLM) |
| `POST /api/v1/audit` | GenerateAuditReport | No (add `?enhanced=true` for LLM) |
| Agent interactive | AuditAgent → GenerateAuditReport | Yes |
| Programmatic | `import { GenerateAuditReport }` | No |

## Consequences

### Positive

- Report generation is deterministic and testable without mocks
- CLI and API users don't need an Anthropic API key for basic reports
- Agent adds value through reasoning, not by gatekeeping data
- Same report structure regardless of channel

### Negative

- Two-layer design adds complexity
- Recommendations without LLM will be template-based (not as nuanced)

### Mitigations

- Template-based recommendations cover 90% of cases (risk-level-specific checklists)
- Enhanced mode is optional, not required

## Alternatives Considered

1. **Agent-only (all LLM)** — rejected; makes report non-deterministic and requires API key for basic functionality
2. **Core-only (no LLM)** — viable for basic report, but loses the ability to generate nuanced recommendations and interactive follow-ups
3. **Separate package** — rejected; audit is a use case (core) + consumer feature (agent), fits existing structure

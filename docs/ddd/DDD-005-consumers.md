# DDD-005: Consumer Layer — API, MCP, CLI, Skills, Agent

## Status: Draft
## Date: 2026-04-15

---

## Overview

Consumers are thin adapters that translate external protocols (HTTP, MCP, CLI args, Claude Code, SDK) into use case calls. Every consumer calls the same use cases from the same composition root. No business logic lives in consumers.

## API (Express)

**Package:** `packages/api`

Thin route handlers that validate input, call a use case, and return JSON.

```
POST   /api/v1/classify              → ClassifySystem
GET    /api/v1/deadlines             → GetDeadlines
GET    /api/v1/obligations           → GetObligations
POST   /api/v1/faq/search           → AnswerQuestion
POST   /api/v1/penalties/calculate   → CalculatePenalty
GET    /api/v1/articles/:number      → GetArticle
POST   /api/v1/assessments/:id      → RunAssessment
GET    /api/v1/annex-iv/checklist   → GetArticle (filtered)
GET    /api/v1/legislations          → ListLegislations
POST   /api/v1/knowledge/search     → SearchKnowledge
```

Each route handler follows the same pattern:

```typescript
router.post("/classify", async (req, res) => {
  const input = classifyInputSchema.parse(req.body);
  const result = await container.classifySystem.execute(input);
  res.json(result);
});
```

Middleware handles Zod validation errors, domain errors → HTTP status mapping, and request logging.

## MCP Server

**Package:** `packages/mcp`

9 tools mapping to the same use cases:

| MCP Tool | Use Case |
|----------|----------|
| `classify_system` | ClassifySystem |
| `check_deadlines` | GetDeadlines |
| `get_obligations` | GetObligations |
| `answer_question` | AnswerQuestion |
| `calculate_penalty` | CalculatePenalty |
| `get_article` | GetArticle |
| `check_gpai_systemic_risk` | RunAssessment("gpai-systemic-risk") |
| `assess_art6_3_exception` | RunAssessment("art6-3-exception") |
| `annex_iv_checklist` | GetArticle (filtered) |

**Transports:** stdio (default) and HTTP (for remote deployment).

MCP resources expose static regulation data:

| URI | Data |
|-----|------|
| `legalai://timeline` | Deadlines |
| `legalai://risk-levels` | Risk categories |
| `legalai://annex/iii` | Annex III categories |
| `legalai://annex/iv` | Annex IV checklist |

**Tool naming:** Prefixed with `legalai_` (not `euaiact_`) since the platform is legislation-agnostic. The `legislation` parameter on each tool selects which regulation to query.

## CLI

**Package:** `packages/cli`

```bash
legal-ai classify --description "..." --legislation eu-ai-act
legal-ai classify --signals '{"domain":"employment","uses_biometrics":false}'
legal-ai deadlines --upcoming --legislation eu-ai-act
legal-ai obligations --role provider --risk high-risk
legal-ai penalty --violation prohibited --turnover 50000000
legal-ai article 5
legal-ai search "facial recognition rules" --type article --limit 5
legal-ai assess art6-3-exception --narrow-procedural --documented
legal-ai legislations
```

**Output formats:**
- `--format json` — raw JSON (default, pipeable)
- `--format table` — formatted table for humans
- `--format markdown` — markdown output

The CLI creates its own composition root (same wiring as API) and calls use cases directly — it does not go through HTTP.

## Claude Code Skills

**Directory:** `skills/`

Interactive workflows for Claude Code users:

### `/eu-ai-classify`
1. Asks the user to describe their AI system
2. Calls `ClassifySystem` with the description
3. Reviews missing signals and asks follow-up questions
4. Re-classifies with signals for higher confidence
5. Presents the result with relevant articles and obligations

### `/eu-ai-compliance`
1. Asks for role (provider/deployer) and risk level
2. Calls `GetObligations`
3. Formats as a checklist with deadlines and article references

### `/eu-ai-penalty`
1. Asks for violation type and annual turnover
2. Calls `CalculatePenalty`
3. Explains the penalty tiers and SME rules

### `/eu-ai-search`
1. Takes a natural language question
2. Calls `SearchKnowledge` across articles, obligations, and FAQ
3. Presents ranked results with similarity scores and source links

Skills call the API over HTTP (if running) or import core directly.

## Claude Agent (SDK)

**Package:** `packages/agent`

A multi-turn conversational agent built with the Anthropic Agent SDK. The agent uses the core use cases as tools and adds LLM reasoning on top.

**Capabilities:**
- Guided classification interview — asks questions, gathers signals, classifies
- Compliance gap analysis — compares current state against obligations
- Cross-regulation analysis — when multiple legislations are seeded, identifies overlapping requirements
- Citation grounding — retrieves and quotes regulation text with source URLs

**Agent Tools** (wrappers around use cases):
```typescript
const tools = [
  { name: "classify_system", fn: container.classifySystem.execute },
  { name: "get_obligations", fn: container.getObligations.execute },
  { name: "calculate_penalty", fn: container.calculatePenalty.execute },
  { name: "search_knowledge", fn: container.searchKnowledge.execute },
  { name: "get_article", fn: container.getArticle.execute },
  { name: "get_deadlines", fn: container.getDeadlines.execute },
  { name: "answer_question", fn: container.answerQuestion.execute },
  { name: "run_assessment", fn: container.runAssessment.execute },
  { name: "list_legislations", fn: container.listLegislations.execute },
];
```

The agent's system prompt instructs it to use deterministic tools for factual answers and only use its own reasoning for synthesis, explanation, and conversation management. This preserves the platform's core principle: regulation interpretation is rule-based, not probabilistic.

## Consumer Dependency Summary

```
All consumers
    │
    └── Composition Root
            │
            ├── Use Cases (from packages/core)
            ├── Repositories (from packages/db)
            ├── Plugins (from packages/core/legislation/*)
            └── Services (EmbeddingService)
```

Every consumer is a different front door to the same room.

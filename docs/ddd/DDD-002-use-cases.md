# DDD-002: Use Cases

## Status: Draft
## Date: 2026-04-15

---

## Overview

Use cases orchestrate domain logic. Each use case receives injected repository and service ports, validates input, coordinates entities, and returns a typed output. Use cases know nothing about HTTP, MCP, or CLI — they are consumed identically by every delivery mechanism.

## Use Case Catalogue

### ClassifySystem

Classifies an AI system against a legislation's risk taxonomy.

**Input:** `ClassifyInput` (legislationId, description, useCase, role, signals)
**Output:** `ClassifyOutput`

**Flow:**

1. Resolve the legislation plugin by `legislationId`
2. If structured `signals` are provided, run the plugin's signal-based classification
3. If no signal match, run keyword matching against `RiskCategory` keywords
4. If no keyword match, embed the description and run semantic search against risk categories
5. Determine role and map to obligation summary
6. Return classification with matched/missing signals and next questions

**Key rule:** Signal-based classification takes precedence over keyword matching, which takes precedence over semantic search. This preserves determinism — semantic search is a fallback, not the primary path.

### GetObligations

Retrieves obligations filtered by legislation, role, and risk level.

**Input:** `ObligationFilter`
**Output:** `Obligation[]`

**Flow:**

1. Query `ObligationRepository.findByFilter()`
2. Sort by category, then by article number
3. Calculate deadline status (past/upcoming/days remaining)

### CalculatePenalty

Calculates maximum fine for a violation type.

**Input:** `PenaltyInput`
**Output:** `PenaltyOutput`

**Flow:**

1. Look up penalty tier by `(legislationId, violationType)`
2. Calculate: `max(tier.maxFineEur, tier.globalTurnoverPercentage / 100 * annualTurnoverEur)`
3. If SME and legislation has SME rules, apply reduction: `min(fine, percentage * turnover)`
4. Return with explanation text

### SearchKnowledge

Semantic search across any content type within a legislation.

**Input:** `SemanticSearchInput`
**Output:** `ScoredResult<Article | Obligation | FAQ | RiskCategory>[]`

**Flow:**

1. Embed the query via `EmbeddingService.embed()`
2. Route to the appropriate repository's `searchSemantic()` based on `entityType`
3. Return scored results above a minimum similarity threshold

### GetArticle

Retrieves a specific article by number.

**Input:** `{ legislationId: string, articleNumber: string }`
**Output:** `Article | null`

**Flow:** Direct lookup via `ArticleRepository.findByNumber()`

### GetDeadlines

Retrieves implementation milestones with dynamic status.

**Input:** `{ legislationId: string, onlyUpcoming?: boolean }`
**Output:** `DeadlineWithStatus[]`

**Flow:**

1. Query `DeadlineRepository.findByLegislation()` or `findUpcoming()`
2. Calculate `daysRemaining` and `isPast` for each deadline
3. Identify `nextMilestone` (nearest future deadline)

### AnswerQuestion

Searches the FAQ database semantically.

**Input:** `{ legislationId: string, question: string }`
**Output:** `{ faq: FAQ, similarity: number } | null`

**Flow:**

1. Embed the question
2. Search `FAQRepository.searchSemantic()` with limit 1
3. Return if similarity exceeds threshold, else null

### RunAssessment

Runs a legislation-specific assessment (e.g., Art. 6(3) exception, GPAI systemic risk).

**Input:** `{ legislationId: string, assessmentId: string, input: Record<string, unknown> }`
**Output:** `AssessmentOutput`

**Flow:**

1. Resolve the legislation plugin
2. Find the assessment by ID from `plugin.getAssessments()`
3. Validate input against the assessment's schema
4. Delegate to `plugin.runAssessment()`

This is the escape hatch for legislation-specific logic that doesn't fit the generic model. Each plugin declares its own assessments with their own input/output schemas.

### ListLegislations

Lists all available legislations.

**Input:** none
**Output:** `Legislation[]`

**Flow:** `LegislationRepository.findAll()`

## Use Case Dependencies

```
                    EmbeddingService
                         │
ClassifySystem ──── LegislationPlugin
      │                  │
      ├── RiskCategoryRepository
      ├── ObligationRepository
      └── ArticleRepository

CalculatePenalty ── PenaltyRepository

GetObligations ─── ObligationRepository

SearchKnowledge ── EmbeddingService
      │
      ├── ArticleRepository
      ├── ObligationRepository
      ├── FAQRepository
      └── RiskCategoryRepository

RunAssessment ──── LegislationPlugin

GetArticle ──────── ArticleRepository
GetDeadlines ────── DeadlineRepository
AnswerQuestion ──── FAQRepository + EmbeddingService
ListLegislations ── LegislationRepository
```

## Injection Pattern

Use cases receive dependencies via constructor injection:

```typescript
class ClassifySystem {
  constructor(
    private readonly pluginRegistry: LegislationPluginRegistry,
    private readonly riskCategoryRepo: RiskCategoryRepository,
    private readonly obligationRepo: ObligationRepository,
    private readonly embeddingService: EmbeddingService,
  ) {}

  async execute(input: ClassifyInput): Promise<ClassifyOutput> {
    // ...
  }
}
```

A composition root in the infrastructure layer wires everything together. Each consumer (API, MCP, CLI, Agent) bootstraps the same composition root with the same concrete implementations.

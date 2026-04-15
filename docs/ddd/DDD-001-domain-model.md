# DDD-001: Domain Model — Entities, Value Objects, and Ports

## Status: Draft
## Date: 2026-04-15

---

## Overview

The domain model is legislation-agnostic. It defines the shapes of compliance data and the contracts (ports) that infrastructure must fulfil. No entity knows about PostgreSQL, Express, OpenAI, or any specific regulation.

## Entities

### Legislation

The root aggregate. Every other entity belongs to a legislation.

```
Legislation
├── id: string                    # e.g., "eu-ai-act"
├── name: string                  # e.g., "EU AI Act (Regulation 2024/1689)"
├── jurisdiction: string          # e.g., "EU"
├── effectiveDate: Date
├── sourceUrl: string             # e.g., EUR-Lex URL
└── version: string               # regulation version/amendment
```

### Article

A numbered section of a legislation.

```
Article
├── id: string
├── legislationId: string
├── number: string                # e.g., "5", "50"
├── title: string
├── summary: string
├── fullText: string
├── sourceUrl: string             # deep link to official source
├── relatedAnnexes: string[]
└── embedding: vector(3072)       # OpenAI embedding of title + summary + text
```

### RiskCategory

A classification level defined by a legislation. Not every legislation uses the same taxonomy — the EU AI Act has prohibited/high/limited/minimal; another regulation might have critical/standard/exempt.

```
RiskCategory
├── id: string
├── legislationId: string
├── name: string                  # e.g., "high-risk"
├── level: number                 # ordinal for sorting (higher = more severe)
├── description: string
├── keywords: string[]
├── examples: string[]
├── relevantArticles: string[]
└── embedding: vector(3072)
```

### Obligation

A requirement imposed by a legislation on a specific role at a specific risk level.

```
Obligation
├── id: string
├── legislationId: string
├── role: string                  # e.g., "provider", "deployer"
├── riskLevel: string             # references RiskCategory.name
├── obligation: string            # the requirement text
├── article: string               # article reference
├── deadline: Date | null
├── details: string
├── category: string              # e.g., "technical", "governance", "transparency"
└── embedding: vector(3072)
```

### Penalty

A fine/sanction tier defined by a legislation.

```
Penalty
├── id: string
├── legislationId: string
├── violationType: string         # e.g., "prohibited", "high_risk", "false_info"
├── name: string
├── maxFineEur: number
├── globalTurnoverPercentage: number
├── article: string
├── description: string
├── applicableTo: string[]
├── smeRules: SmeRule | null      # legislation-specific SME reductions
```

### Deadline

An implementation milestone.

```
Deadline
├── id: string
├── legislationId: string
├── date: Date
├── event: string
├── description: string
```

### FAQ

Curated question-answer pairs for a legislation.

```
FAQ
├── id: string
├── legislationId: string
├── question: string
├── answer: string
├── articleReferences: string[]
├── keywords: string[]
├── category: string
├── sourceUrl: string | null
└── embedding: vector(3072)
```

## Value Objects

```
ClassifyInput
├── legislationId: string
├── description?: string
├── useCase?: string
├── role: "provider" | "deployer" | "unknown"
├── signals?: Record<string, unknown>    # legislation-specific structured signals

ClassifyOutput
├── riskClassification: string
├── confidence: "high" | "medium" | "low"
├── matchedCategory: RiskCategory | null
├── relevantArticles: string[]
├── roleDetermination: string
├── obligationsSummary: string
├── matchedSignals: string[]
├── missingSignals: string[]
├── nextQuestions: string[]
├── basis: "signals" | "text" | "semantic" | "default"

PenaltyInput
├── legislationId: string
├── violationType: string
├── annualTurnoverEur: number
├── isSme?: boolean

PenaltyOutput
├── tierName: string
├── maxFineEur: number
├── calculatedFine: number
├── explanation: string

ObligationFilter
├── legislationId: string
├── role?: string
├── riskLevel?: string
├── category?: string

SemanticSearchInput
├── legislationId: string
├── query: string
├── limit: number
├── entityType: "article" | "obligation" | "faq" | "risk-category"
```

## Ports (Interfaces)

### Repository Ports

```typescript
interface LegislationRepository {
  findAll(): Promise<Legislation[]>;
  findById(id: string): Promise<Legislation | null>;
}

interface ArticleRepository {
  findByLegislation(legislationId: string): Promise<Article[]>;
  findByNumber(legislationId: string, number: string): Promise<Article | null>;
  searchSemantic(legislationId: string, embedding: number[], limit: number): Promise<ScoredResult<Article>[]>;
}

interface RiskCategoryRepository {
  findByLegislation(legislationId: string): Promise<RiskCategory[]>;
  findByName(legislationId: string, name: string): Promise<RiskCategory | null>;
  searchSemantic(legislationId: string, embedding: number[], limit: number): Promise<ScoredResult<RiskCategory>[]>;
}

interface ObligationRepository {
  findByFilter(filter: ObligationFilter): Promise<Obligation[]>;
  searchSemantic(legislationId: string, embedding: number[], limit: number): Promise<ScoredResult<Obligation>[]>;
}

interface PenaltyRepository {
  findByLegislation(legislationId: string): Promise<Penalty[]>;
  findByViolationType(legislationId: string, type: string): Promise<Penalty | null>;
}

interface DeadlineRepository {
  findByLegislation(legislationId: string): Promise<Deadline[]>;
  findUpcoming(legislationId: string): Promise<Deadline[]>;
}

interface FAQRepository {
  findByLegislation(legislationId: string): Promise<FAQ[]>;
  searchSemantic(legislationId: string, embedding: number[], limit: number): Promise<ScoredResult<FAQ>[]>;
}
```

### Service Ports

```typescript
interface EmbeddingService {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}
```

### Scored Result Wrapper

```typescript
interface ScoredResult<T> {
  item: T;
  similarity: number;    // 0-1, cosine similarity
}
```

## Domain Rules

1. Every entity belongs to exactly one `Legislation`
2. `RiskCategory.level` determines severity ordering within a legislation
3. Classification always returns a `basis` field explaining how the result was determined
4. Penalty calculation uses `max(fixedFine, turnoverPercentage * turnover)` unless SME rules override
5. Deadlines are always absolute dates, never relative
6. Semantic search returns similarity scores — the consumer decides the threshold

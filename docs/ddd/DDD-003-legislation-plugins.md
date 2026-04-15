# DDD-003: Legislation Plugin System

## Status: Draft
## Date: 2026-04-15

---

## Overview

Each regulation is a plugin that implements the `LegislationPlugin` interface. Plugins contain the classification rules, structured signals, and bespoke assessments specific to one piece of legislation. The core domain orchestrates plugins — it never contains regulation-specific logic itself.

## Plugin Interface

```typescript
interface LegislationPlugin {
  /** Unique identifier matching the legislation record in the database */
  id: string;

  /** Human-readable name */
  name: string;

  /** Regulation version or amendment identifier */
  version: string;

  /**
   * Signal-based classification.
   * Returns a classification if the signals are sufficient, null otherwise.
   * Called before keyword/semantic fallback.
   */
  classifyBySignals(signals: Record<string, unknown>): ClassifyOutput | null;

  /**
   * Keyword-based classification.
   * Matches description text against the plugin's keyword rules.
   * Called when signal classification returns null.
   */
  classifyByKeywords(text: string, categories: RiskCategory[]): ClassifyOutput | null;

  /**
   * Returns the structured signal schema for this legislation.
   * Used by consumers to present the right questions to users.
   */
  getSignalSchema(): SignalSchema;

  /**
   * Returns legislation-specific assessments.
   * e.g., Art. 6(3) exception, GPAI systemic risk for EU AI Act.
   */
  getAssessments(): AssessmentDefinition[];

  /**
   * Runs a specific assessment.
   */
  runAssessment(id: string, input: Record<string, unknown>): AssessmentOutput;

  /**
   * Returns penalty calculation rules for this legislation.
   * Some legislations have SME reductions, some don't.
   */
  calculatePenalty(tier: Penalty, turnover: number, isSme: boolean): PenaltyOutput;
}
```

## Plugin Registry

```typescript
interface LegislationPluginRegistry {
  register(plugin: LegislationPlugin): void;
  get(legislationId: string): LegislationPlugin;
  list(): LegislationPlugin[];
}
```

The registry lives in the application layer. Concrete plugins are registered during bootstrap.

## EU AI Act Plugin

The first plugin. Located at `packages/core/src/legislation/eu-ai-act/`.

### Structure

```
eu-ai-act/
├── index.ts              # EuAiActPlugin implements LegislationPlugin
├── signals.ts            # Signal schema (domain, biometrics, profiling, etc.)
├── classify.ts           # Signal precedence + keyword matching logic
├── assessments/
│   ├── art6-exception.ts    # Art. 6(3) "no significant risk" exception
│   └── gpai-systemic.ts     # GPAI systemic risk (10^25 FLOPs threshold)
└── penalties.ts          # SME reduction logic (Art. 99(6))
```

### Signal Schema

```typescript
const euAiActSignals: SignalSchema = {
  domain: {
    type: "enum",
    options: ["biometrics", "critical-infrastructure", "education",
              "employment", "essential-services", "law-enforcement",
              "migration", "justice", "democratic-processes",
              "product-safety", "general", "other"],
    question: "What domain does this AI system operate in?"
  },
  uses_biometrics: {
    type: "boolean",
    question: "Does the system use biometric identification or categorisation?"
  },
  biometric_realtime: {
    type: "boolean",
    dependsOn: { uses_biometrics: true },
    question: "Is the biometric identification performed in real-time?"
  },
  // ... remaining signals from lexbeam reference
};
```

### Assessments

| ID | Name | Input | Output |
|----|------|-------|--------|
| `art6-3-exception` | Art. 6(3) Exception | 4 condition booleans + profiling + documented | exception_available, reasoning, conditions[] |
| `gpai-systemic-risk` | GPAI Systemic Risk | training_flops, commission_designated, model_name | crosses_threshold, obligations[] |

### Classification Precedence

1. **Prohibited (Art. 5)** — social scoring, emotion recognition workplace/school, real-time biometric law enforcement
2. **High-risk (Annex III)** — domain mapping from signals
3. **Limited-risk (Art. 50)** — synthetic content, natural person interaction
4. **Keyword matching** — against risk category keywords
5. **Semantic search** — vector similarity (added beyond lexbeam reference)
6. **Default** — `insufficient_information`

## Adding a New Legislation

To add DORA (as an example):

1. **Create seed data** in `seeds/dora/` — articles, risk categories, obligations, penalties, deadlines, FAQ
2. **Create plugin** at `packages/core/src/legislation/dora/`
   - Implement `LegislationPlugin`
   - Define DORA-specific signal schema
   - Define DORA-specific assessments (if any)
   - Implement DORA penalty calculation rules
3. **Register plugin** in the composition root
4. **Run seed** — `pnpm turbo db:seed --filter=db -- --legislation=dora`

Zero changes to domain entities, use cases, repositories, API routes, MCP tools, or CLI commands. The `legislationId` parameter routes everything to the right plugin and data.

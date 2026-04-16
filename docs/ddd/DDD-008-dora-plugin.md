# DDD-008: DORA Plugin — Domain Implementation

## Status: Draft
## Date: 2026-04-16

---

## Overview

This document specifies the DORA plugin implementation at `packages/core/src/legislation/dora/` and the seed data at `packages/db/src/seeds/dora/`.

## Plugin Structure

```
packages/core/src/legislation/dora/
├── index.ts              # DoraPlugin implements LegislationPlugin
├── signals.ts            # Signal schema + signal-based classification
├── keywords.ts           # Keyword-based fallback classification
├── penalties.ts          # Penalty calculation (baseline + MS overrides)
└── assessments/
    ├── critical-function-assessment.ts
    ├── tlpt-applicability.ts
    ├── major-incident-classification.ts
    └── index.ts
```

## Plugin Interface Implementation

```typescript
export class DoraPlugin implements LegislationPlugin {
  id = "dora";
  name = "Digital Operational Resilience Act (Regulation 2022/2554)";
  version = "1.0.0";

  classifyBySignals(signals): ClassifyOutput | null { /* ... */ }
  classifyByKeywords(text, categories): ClassifyOutput | null { /* ... */ }
  getSignalSchema(): SignalSchema { /* see below */ }
  getAssessments(): AssessmentDefinition[] { /* 3 assessments */ }
  runAssessment(id, input): AssessmentOutput { /* dispatch */ }
  calculatePenalty(tier, turnover, isSme): PenaltyOutput { /* baseline */ }
}
```

## Signal Schema

```typescript
export const signalSchema: SignalSchema = {
  entity_type: {
    type: "enum",
    options: [
      "credit-institution",
      "payment-institution",
      "investment-firm",
      "crypto-asset-provider",
      "insurance-undertaking",
      "reinsurance-undertaking",
      "aifm",
      "ucits-manager",
      "csd",
      "ccp",
      "trading-venue",
      "trade-repository",
      "data-reporting-service",
      "credit-rating-agency",
      "ict-third-party",
      "ict-intra-group",
      "not-applicable",
    ],
    question: "What type of financial entity or ICT provider is this?",
  },
  is_microenterprise: {
    type: "boolean",
    question: "Is this a microenterprise (< 10 staff AND turnover/balance sheet ≤ €2M)?",
  },
  supports_critical_functions: {
    type: "boolean",
    question: "Does this ICT service support a Critical or Important Function?",
  },
  uses_ict_third_parties: {
    type: "boolean",
    question: "Does the entity use ICT third-party service providers?",
  },
  is_systemically_important: {
    type: "boolean",
    question: "Is this a G-SII, O-SII, or otherwise systemically important?",
    dependsOn: { is_microenterprise: false },
  },
  is_ctpp_designated: {
    type: "boolean",
    question: "Has this entity been designated as a Critical ICT Third-Party Provider?",
    dependsOn: { entity_type: "ict-third-party" },
  },
};
```

## Classification Logic

### Signal-Based

```typescript
export function classifyBySignals(signals): ClassifyOutput | null {
  // 1. Out-of-scope check
  if (signals.entity_type === "not-applicable") {
    return {
      riskClassification: "out-of-scope",
      confidence: "high",
      matchedCategory: { name: "Not in scope", level: 0 },
      relevantArticles: ["Article 2"],
      roleDetermination: "unknown",
      obligationsSummary: "DORA does not apply to this entity.",
      basis: "signals",
      /* ... */
    };
  }

  // 2. CTPP designation
  if (signals.is_ctpp_designated === true) {
    return {
      riskClassification: "ctpp",
      confidence: "high",
      matchedCategory: { name: "Critical ICT Third-Party Provider", level: 5 },
      relevantArticles: ["Article 31", "Article 35"],
      roleDetermination: "provider",
      obligationsSummary: "Subject to EU-level Lead Overseer supervision. Periodic penalty payments up to 1% daily turnover apply.",
      basis: "signals",
    };
  }

  // 3. Microenterprise simplified regime
  if (signals.is_microenterprise === true && signals.entity_type !== "ict-third-party") {
    return {
      riskClassification: "simplified-framework",
      confidence: "high",
      matchedCategory: { name: "Simplified ICT Risk Management (Art. 16)", level: 2 },
      relevantArticles: ["Article 16"],
      roleDetermination: "deployer",
      obligationsSummary: "Simplified ICT risk management framework applies. TLPT not required.",
      basis: "signals",
    };
  }

  // 4. Standard financial entity
  if (signals.entity_type && signals.entity_type !== "not-applicable") {
    return {
      riskClassification: "full-framework",
      confidence: "high",
      matchedCategory: { name: `${signals.entity_type} under full DORA framework`, level: 4 },
      relevantArticles: ["Article 5", "Article 6", "Article 17", "Article 24", "Article 28"],
      roleDetermination: "deployer",
      obligationsSummary: "Full DORA ICT risk management framework applies across five pillars.",
      basis: "signals",
    };
  }

  return null;
}
```

### Keyword-Based

Standard pattern matching against risk categories and prohibited practices from the DORA seed data.

## Assessments

### `critical-function-assessment`

**Input:** `{ service_description, supports_payment_processing, supports_customer_data, supports_settlement, tolerable_downtime_minutes, criticality_rating }`

**Logic:**
- Payment processing or settlement → CIF
- Customer data at scale → CIF
- Tolerable downtime < 60 min → strong CIF indicator
- Internal-only, high downtime tolerance → not CIF

**Output:**
```typescript
{
  assessmentId: "critical-function-assessment",
  result: {
    is_critical_function: boolean,
    contractual_requirements_apply: boolean,  // Art. 30
    register_inclusion_required: boolean,
    testing_scope_includes: boolean,
    reasoning: string,
  },
  reasoning: string,
  relevantArticles: ["Article 28", "Article 30"],
}
```

### `tlpt-applicability`

**Input:** `{ entity_type, is_systemically_important, annual_payment_volume_eur, outstanding_emoney_eur, market_share_percentage, last_tlpt_date }`

**Logic (from RTS on TLPT):**
- G-SII/O-SII → TLPT required
- PI/EMI with >€150bn payment volume → TLPT required
- EMI with >€40bn e-money → TLPT required
- CSD/CCP/trading venue with >5% EU market share → TLPT required
- Otherwise → not required

**Output:**
```typescript
{
  assessmentId: "tlpt-applicability",
  result: {
    tlpt_required: boolean,
    next_tlpt_date: string | null,  // last_tlpt + 3 years
    methodology: "TIBER-EU or equivalent",
    reasoning: string,
  },
  relevantArticles: ["Article 26", "Article 27"],
}
```

### `major-incident-classification`

**Input:** `{ clients_affected, data_loss_scale, duration_minutes, economic_impact_eur, geographical_spread, criticality_affected }`

**Logic:** Apply RTS classification thresholds. Major if:
- Duration > threshold AND clients_affected > threshold
- OR data_loss affects critical services
- OR economic_impact > €2M

**Output:**
```typescript
{
  assessmentId: "major-incident-classification",
  result: {
    is_major_incident: boolean,
    reporting_required: boolean,
    initial_report_deadline_hours: 4,  // or per RTS
    intermediate_report_required: boolean,
    final_report_deadline_days: 30,
    reasoning: string,
  },
  relevantArticles: ["Article 19", "Article 20"],
}
```

## Penalty Calculation

```typescript
export function calculatePenalty(tier, turnover, isSme): PenaltyOutput {
  // Baseline: 2% of turnover or €2M, whichever is higher
  // MS-specific overrides via tier.smeRules metadata
  const turnoverBasedFine = (tier.globalTurnoverPercentage / 100) * turnover;

  let fine: number;
  if (isSme) {
    fine = Math.min(tier.maxFineEur, turnoverBasedFine);
  } else {
    fine = Math.max(tier.maxFineEur, turnoverBasedFine);
  }

  // CTPP-specific: daily penalty payments up to 1% of daily turnover
  if (tier.violationType === "ctpp-non-compliance") {
    const dailyTurnover = turnover / 365;
    const maxDailyPenalty = dailyTurnover * 0.01;
    const maxTotalPenalty = maxDailyPenalty * 180;  // 6 months
    fine = Math.min(fine, maxTotalPenalty);
  }

  return { tierName: tier.name, maxFineEur: tier.maxFineEur, calculatedFine: fine, /* ... */ };
}
```

## Seed Data

```
packages/db/src/seeds/dora/
├── index.ts              # orchestrates all sub-seeders
├── legislation.ts        # DORA metadata
├── articles.ts           # ~40 articles (key ones: 5, 6-16, 17-23, 24-27, 28-30, 31, 35, 45, 50)
├── risk-categories.ts    # 4 categories (full-framework, simplified-framework, ctpp, out-of-scope)
├── obligations.ts        # ~30 obligations across five pillars
├── penalties.ts          # 2 tiers (general + ctpp)
├── deadlines.ts          # 5 milestones
├── faq.ts                # ~20 entries
└── doc-register.ts       # 9 Register of Information fields as articles with doc- prefix
```

## Composition Root Update

```typescript
// packages/core/src/composition.ts
import { DoraPlugin } from "./legislation/dora/index.js";

// In createContainer():
pluginRegistry.register(new EuAiActPlugin());
pluginRegistry.register(new DoraPlugin());  // NEW
```

## Testing Strategy

- Unit tests for each assessment (deterministic rules, testable without mocks)
- Unit tests for classifyBySignals covering all entity types
- Snapshot tests for typical DORA classification outputs (payment institution, microenterprise, CTPP)
- E2E test classifying a known financial entity

## Cross-Regulation Integration

Update `GenerateAuditReport` recommendations template to emit a note when:
- Legislation is DORA AND entity is a financial entity AND classification is `full-framework`

```typescript
const doraNote = "DORA is lex specialis for ICT risk management (NIS2 Art. 4). NIS2 obligations on ICT security for this entity are preempted.";
```

This stays generic (not DORA-specific code in the use case) by having the plugin expose a `getPreemptionNotes()` method.

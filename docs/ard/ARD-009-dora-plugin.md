# ARD-009: DORA Plugin Implementation

## Status: Accepted
## Date: 2026-04-16

---

## Context

Adding DORA tests the legislation-agnostic architecture built for the EU AI Act. DORA has fundamentally different structure: financial services regulation, entity-type-driven (not use-case-driven), with five pillars instead of risk tiers.

## Decision

Implement DORA as a plugin in `packages/core/src/legislation/dora/` with the same structure as the EU AI Act plugin. Where DORA's semantics differ from the AI Act's tiered risk model, map concepts into the existing value objects.

### Risk Category Mapping

DORA has no "high-risk / limited / minimal" tiers. The equivalent structural primitive is **"pillar applicability × entity type × microenterprise status"**. The plugin models this as:

| Risk category name | DORA meaning |
|-------------------|--------------|
| `full-framework` | Standard financial entity, full DORA ICT RMF applies |
| `simplified-framework` | Microenterprise or qualifying entity under Art. 16 |
| `ctpp` | Designated Critical ICT Third-Party Provider (Lead Overseer) |
| `out-of-scope` | Entity not covered by DORA |

This keeps the `RiskCategory` entity intact while giving DORA a meaningful taxonomy.

### Signal Schema

DORA-specific signals (different from AI Act signals):

```typescript
{
  entity_type: enum[
    "credit-institution", "payment-institution", "investment-firm",
    "crypto-asset-provider", "insurance-undertaking", "reinsurance",
    "aifm", "ucits-manager", "csd", "ccp", "trading-venue",
    "trade-repository", "data-reporting-service", "credit-rating-agency",
    "ict-third-party", "ict-intra-group", "not-applicable"
  ],
  is_microenterprise: boolean,
  supports_critical_functions: boolean,
  uses_ict_third_parties: boolean,
  is_systemically_important: boolean,
  is_ctpp_designated: boolean,
  annual_turnover_eur: number,  // optional, drives penalty
  last_tlpt_date: string,       // optional, drives TLPT assessment
}
```

### Assessments

Three DORA-specific assessments implementing `AssessmentDefinition`:

1. **`critical-function-assessment`** — Given a description of an ICT service, determine if it supports a Critical or Important Function. Drives Art. 30 contractual requirements, Art. 28 register entries, Art. 24 testing scope.

2. **`tlpt-applicability`** — Given entity type + significance thresholds, determine if Threat-Led Penetration Testing is mandatory and compute the 3-year cycle.

3. **`major-incident-classification`** — Given incident characteristics (clients affected, data losses, duration, economic impact), apply RTS classification thresholds to determine if it's a "major ICT-related incident" requiring reporting.

### Penalty Calculation

DORA penalties are per-MS. The plugin implements:

- **Baseline calculation** — uses a conservative default (2% turnover or €2M) when MS is unspecified
- **MS-specific adjustment** — if signals include `member_state`, use per-MS caps from seed data
- **CTPP penalty path** — Art. 35 periodic penalty payments (1% of average daily worldwide turnover, up to 6 months)

### Cross-Regulation Behaviour

When a user queries for a financial entity, the audit report includes a note: "DORA applies as lex specialis for ICT risk management (NIS2 Art. 4). NIS2 obligations for this entity are preempted."

This is implemented by:
1. Audit report's `recommendations` template includes DORA-vs-NIS2 note when risk category is `full-framework`
2. Cross-reference data in the DORA plugin identifies which NIS2 obligations are preempted

### Seed Data Approach

Documentation items use `doc-` prefix (same convention as Annex IV for AI Act):
- `doc-1` through `doc-9` = Register of Information fields

This keeps the documentation checklist retrieval generic (same code path as AI Act Annex IV).

## Consequences

### Positive

- Validates the plugin architecture works for a second regulation
- Zero changes to core, API, MCP, CLI, Agent
- Cross-regulation queries become possible
- Sets pattern for future plugins (NIS2, CIMA)

### Negative

- DORA's pillar structure doesn't fit naturally into "risk categories"
- MS-level penalty variation requires additional seed data complexity
- Some DORA semantics (CTPP lifecycle, TLPT cycles) don't have direct AI Act analogues

### Mitigations

- Map pillars to category-tagged obligations instead of forcing into risk tiers
- Start with baseline penalty; add MS-level variation incrementally
- Use assessments (not risk tiers) for DORA-specific workflows

## Alternatives Considered

1. **New plugin interface for DORA** — rejected; defeats the purpose of legislation-agnostic domain
2. **Force DORA into AI Act's tier names** — rejected; would confuse users (calling a credit institution "high-risk" is misleading)
3. **Model DORA as a family of sub-regulations** — rejected; DORA is a single Regulation despite having five pillars

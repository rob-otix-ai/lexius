# DDD-006: Compliance Audit Agent — Use Case and Report Model

## Status: Draft
## Date: 2026-04-15

---

## Overview

The audit agent is split into two components: a deterministic use case (GenerateAuditReport) in the core package, and an LLM-enhanced wrapper (AuditAgent) in the agent package. This document covers both.

## Value Objects

### AuditInput

```typescript
interface AuditInput {
  legislationId: string;          // default "eu-ai-act"
  systemDescription: string;      // free-text description of the AI system
  role: "provider" | "deployer" | "unknown";
  signals?: Record<string, unknown>;  // optional structured signals
  annualTurnoverEur?: number;     // for penalty calculation
  isSme?: boolean;                // SME status
}
```

### ComplianceReport

Full report structure as defined in PRD-003.

### AuditOptions

```typescript
interface AuditOptions {
  includeAnnexIv: boolean;        // default true for high-risk
  includeDeadlines: boolean;      // default true
  includePenalties: boolean;      // default true if turnover provided
  includeRecommendations: boolean; // default true
}
```

## Use Case: GenerateAuditReport

**Location:** `packages/core/src/use-cases/generate-audit-report.ts`

**Dependencies (injected):**
- ClassifySystem
- GetObligations
- CalculatePenalty
- RunAssessment
- GetDeadlines
- GetArticle
- SearchKnowledge
- LegislationPluginRegistry (for signal schema)

**Flow:**

```
AuditInput
    │
    ▼
1. Classify system
   ├── Signal-based (if signals provided)
   ├── Keyword-based (from description)
   └── Semantic (fallback)
    │
    ▼
2. Get obligations
   └── Filter by determined role + risk level
    │
    ▼
3. Run assessments (conditional)
   ├── If high-risk → Art. 6(3) exception check
   │   (only if signals contain profiling/procedural info)
   └── If GPAI signals present → systemic risk check
    │
    ▼
4. Calculate penalty exposure (if turnover provided)
   └── Use highest applicable tier for the risk level
    │
    ▼
5. Get Annex IV checklist (if high-risk)
   └── Retrieve annex-iv-1 through annex-iv-9
    │
    ▼
6. Get deadlines
   └── All milestones with daysRemaining
    │
    ▼
7. Search relevant articles
   └── Semantic search using system description
    │
    ▼
8. Generate recommendations (template-based)
   └── Risk-level-specific action items
    │
    ▼
9. Calculate confidence
   └── Based on signal completeness ratio
    │
    ▼
ComplianceReport
```

**Recommendation Templates:**

```typescript
const recommendationsByRisk: Record<string, string[]> = {
  "unacceptable": [
    "This AI system is prohibited under the regulation. Do not deploy.",
    "Consult legal counsel to evaluate if any narrow exceptions apply.",
    "If the system is already deployed, initiate immediate withdrawal.",
  ],
  "high": [
    "Establish a risk management system per Article 9.",
    "Implement data governance practices per Article 10.",
    "Prepare technical documentation per Annex IV.",
    "Ensure human oversight mechanisms are in place per Article 14.",
    "Register the system in the EU database per Article 49.",
    "Consider whether the Art. 6(3) exception applies to narrow your obligations.",
    "Schedule a conformity assessment before the applicable deadline.",
  ],
  "limited": [
    "Implement transparency obligations per Article 50.",
    "Ensure users are informed they are interacting with an AI system.",
    "If generating synthetic content, implement labelling and detectability measures.",
  ],
  "minimal": [
    "No mandatory obligations beyond AI literacy (Article 4).",
    "Consider voluntary codes of conduct for trustworthy AI.",
    "Monitor for regulatory updates that may reclassify your system.",
  ],
};
```

**Confidence Calculation:**

```typescript
function calculateConfidence(input: AuditInput, plugin: LegislationPlugin): ReportConfidence {
  const schema = plugin.getSignalSchema();
  const totalSignals = Object.keys(schema).length;
  const providedSignals = input.signals ? Object.keys(input.signals).length : 0;
  const completeness = totalSignals > 0 ? providedSignals / totalSignals : 0;

  let overall: "high" | "medium" | "low";
  if (completeness >= 0.7) overall = "high";
  else if (completeness >= 0.4) overall = "medium";
  else overall = "low";

  return {
    overall,
    signalCompleteness: Math.round(completeness * 100) / 100,
    reasoning: completeness >= 0.7
      ? "Most structured signals provided. Classification is reliable."
      : completeness >= 0.4
        ? "Some signals provided. Classification may change with additional information."
        : "Few or no signals provided. Classification is based on text analysis and may be unreliable.",
  };
}
```

## AuditAgent (packages/agent)

**Location:** `packages/agent/src/audit-agent.ts`

Wraps GenerateAuditReport with Claude reasoning:

1. Calls `generateAuditReport.execute(input)`
2. Passes the report to Claude with a prompt asking for:
   - Natural language summary of the findings
   - Enhanced recommendations considering the specific system context
   - Risk areas that warrant further investigation
3. Merges Claude's output with the deterministic report
4. Returns the enhanced report

**Interactive Mode:**

When run interactively (via chat or CLI `--interactive`):
1. Ask the user to describe their system
2. Call `plugin.getSignalSchema()` to get available signals
3. Ask targeted questions to fill the most impactful signals
4. After 3-5 questions, generate the report
5. Present findings and offer to deep-dive into any section

## Report Rendering

### JSON (default)
Raw `ComplianceReport` object.

### Markdown
```markdown
# Compliance Assessment Report

**Generated:** 2026-04-15T14:30:00Z
**Legislation:** EU AI Act (Regulation 2024/1689)
**Confidence:** High (signal completeness: 82%)

## System Description
{systemDescription}

## Risk Classification
- **Level:** {riskLevel}
- **Category:** {matchedCategory}
- **Basis:** {basis}
- **Confidence:** {confidence}

## Obligations ({count})
| # | Obligation | Article | Deadline | Category |
|---|-----------|---------|----------|----------|
...

## Assessments
### Art. 6(3) Exception
{result}

## Penalty Exposure
{penaltyExposure}

## Technical Documentation (Annex IV)
- [ ] {item 1}
- [ ] {item 2}
...

## Upcoming Deadlines
...

## Recommendations
1. {recommendation}
...

## Citations
...

---
*This report is generated by Lexius and does not constitute legal advice.*
```

## Integration with Existing Architecture

The audit use case follows the same patterns:
- Constructor injection of dependencies
- `execute(input): Promise<ComplianceReport>` method
- Registered in the composition root
- Available to all consumers

```typescript
// In composition.ts
const generateAuditReport = new GenerateAuditReport(
  classifySystem,
  getObligations,
  calculatePenalty,
  runAssessment,
  getDeadlines,
  getArticle,
  searchKnowledge,
  pluginRegistry,
);
```

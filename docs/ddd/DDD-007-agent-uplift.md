# DDD-007: Agent Uplift — Enhancement Service, Reasoning Loop, Model Strategy

## Status: Draft
## Date: 2026-04-15

---

## Overview

This document covers the domain additions for the agent uplift: the EnhancementService port, the EnhanceAuditReport use case, the agentic reasoning loop, model configuration, and auditable sources.

## New Port: EnhancementService

**Location:** `packages/core/src/domain/ports/enhancement-service.ts`

```typescript
export interface ReportEnhancement {
  summary: string;
  recommendations: string[];
  riskAreas: string[];
  reasoning: Record<string, string>;
  gapAnalysis: string[];
}

export interface EnhancementService {
  enhance(report: ComplianceReport, systemDescription: string): Promise<ReportEnhancement>;
}
```

This is a domain port — the core package doesn't know whether it's backed by Anthropic, OpenAI, or a local model.

## New Value Object: EnhancedComplianceReport

**Location:** `packages/core/src/domain/value-objects/audit.ts` (extend existing)

```typescript
export interface EnhancedComplianceReport extends ComplianceReport {
  enhancement: {
    summary: string;
    recommendations: string[];
    riskAreas: string[];
    reasoning: Record<string, string>;
    gapAnalysis: string[];
  };
}
```

## New Use Case: EnhanceAuditReport

**Location:** `packages/core/src/use-cases/enhance-audit-report.ts`

```typescript
export class EnhanceAuditReport {
  constructor(
    private readonly enhancementService: EnhancementService,
  ) {}

  async execute(
    report: ComplianceReport,
    systemDescription: string,
  ): Promise<EnhancedComplianceReport> {
    const enhancement = await this.enhancementService.enhance(report, systemDescription);

    return {
      ...report,
      // Override template recommendations with LLM-generated ones
      recommendations: enhancement.recommendations,
      enhancement,
    };
  }
}
```

## Infrastructure: AnthropicEnhancementService

**Location:** `packages/agent/src/enhancement-service.ts` (or a shared infra package)

Implements `EnhancementService` using the Anthropic SDK:

```typescript
export class AnthropicEnhancementService implements EnhancementService {
  private readonly client: Anthropic;
  private readonly model: string;

  constructor() {
    this.client = new Anthropic();
    this.model = process.env.ANTHROPIC_MODEL_STRUCTURED
      || process.env.ANTHROPIC_MODEL
      || "claude-sonnet-4-6";
  }

  async enhance(report: ComplianceReport, systemDescription: string): Promise<ReportEnhancement> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 2048,
      system: ENHANCEMENT_SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: `System: ${systemDescription}\n\nReport:\n${JSON.stringify(report, null, 2)}`,
      }],
    });

    // Parse structured JSON response
    // ...
  }
}
```

The enhancement prompt is the domain-expert prompt from ARD-008, tailored for structured output.

## Model Configuration

```
# .env
ANTHROPIC_MODEL_REASONING=claude-opus-4-6     # interactive chat, complex reasoning
ANTHROPIC_MODEL_STRUCTURED=claude-sonnet-4-6  # report enhancement, JSON extraction
ANTHROPIC_MODEL=claude-sonnet-4-6             # fallback for both
```

Resolution chain:
1. Task-specific var (`ANTHROPIC_MODEL_REASONING` or `ANTHROPIC_MODEL_STRUCTURED`)
2. General var (`ANTHROPIC_MODEL`)
3. Hardcoded default (`claude-sonnet-4-6`)

## Agentic Reasoning Loop (Interactive Mode)

The chat agent in `packages/agent` uses a multi-step loop:

```
State Machine:
  INTAKE → SCREENING → SIGNAL_GATHERING → REPORT_GENERATION → PRESENTATION

INTAKE:
  - Ask user to describe their AI system
  - Transition → SCREENING

SCREENING:
  - Run ClassifySystem with description only (no signals)
  - If prohibited → skip to REPORT_GENERATION
  - If high confidence → skip to REPORT_GENERATION
  - Otherwise → SIGNAL_GATHERING

SIGNAL_GATHERING:
  - Get signal schema from plugin
  - Identify top 5 most discriminating signals not yet provided
  - Ask user one question at a time
  - After each answer, re-run classification
  - If confidence reaches "high" → REPORT_GENERATION
  - After 5 questions → REPORT_GENERATION regardless

REPORT_GENERATION:
  - Call GenerateAuditReport with all gathered signals
  - If enhanced mode → call EnhanceAuditReport
  - Transition → PRESENTATION

PRESENTATION:
  - Present report sections
  - Offer to drill into any section
  - Answer follow-up questions using tools
```

## Enhanced Mode in All Channels

| Channel | Flag | Behaviour |
|---------|------|-----------|
| CLI | `--enhanced` | Calls EnhanceAuditReport after GenerateAuditReport |
| API | `?enhanced=true` or body `{ enhanced: true }` | Same |
| MCP | `enhanced: true` parameter | Same |
| Agent | Always enhanced in interactive mode | Uses reasoning loop |

When `enhanced=true` but no `ANTHROPIC_API_KEY` is set, return the base report with a warning field: `enhancement: { error: "ANTHROPIC_API_KEY not configured" }`.

## Auditable Sources

Every section of the ComplianceReport gains a `sources` field. The deterministic report populates it from citation search results. The enhanced report adds LLM reasoning about relevance.

```typescript
// Updated ComplianceReport sections
classification: {
  // ... existing fields
  sources: Array<{
    article: string;
    url: string;
    relevance: string;
  }>;
};
```

This is a non-breaking addition — existing consumers that don't use `sources` are unaffected.

## Confidence Calibration

Updated confidence calculation factors in:

```typescript
function calculateConfidence(
  signalCompleteness: number,
  classificationBasis: "signals" | "text" | "semantic" | "default",
  assessmentsCovered: number,
  totalAssessments: number,
): ReportConfidence {
  // Basis weight: signals=1.0, text=0.7, semantic=0.5, default=0.1
  const basisWeight = { signals: 1.0, text: 0.7, semantic: 0.5, default: 0.1 };
  const assessmentCoverage = totalAssessments > 0 ? assessmentsCovered / totalAssessments : 1;

  const score = (signalCompleteness * 0.5) + (basisWeight[classificationBasis] * 0.3) + (assessmentCoverage * 0.2);

  let overall: "high" | "medium" | "low";
  if (score >= 0.7) overall = "high";
  else if (score >= 0.4) overall = "medium";
  else overall = "low";

  return { overall, signalCompleteness, reasoning: "..." };
}
```

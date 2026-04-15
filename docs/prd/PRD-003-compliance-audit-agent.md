# PRD-003: Compliance Audit Agent

## Status: Draft
## Date: 2026-04-15
## Author: Robert

---

## Problem Statement

Compliance officers need a complete regulatory assessment of their AI system — not piecemeal answers to individual questions. Today, users must manually drive classification, obligation lookup, penalty calculation, and assessment workflows in sequence, then synthesise the results themselves. There is no automated path from "describe your system" to "here is your compliance report."

## Vision

An autonomous agent that takes an AI system description and produces a structured Compliance Assessment Report. The agent orchestrates multiple tools in sequence — classifying risk, gathering obligations, running assessments, calculating penalties, and citing regulation text — without requiring the user to drive each step.

## Users

| Persona | Need |
|---------|------|
| **Compliance Officer** | Hand a report to legal showing risk classification, obligations, and penalty exposure |
| **Engineering Lead** | Understand compliance requirements before building an AI feature |
| **GRC Team** | Standardised assessment format across all AI systems in the organisation |
| **Auditor** | Verifiable, citation-grounded compliance evidence |

## Product Requirements

### P0 — Must Have

1. **System intake** — accept a free-text system description, optional structured signals, role (provider/deployer), and legislation ID
2. **Autonomous classification** — run signal-based classification, identify missing signals, and use available information to determine risk level
3. **Obligation retrieval** — pull all applicable obligations for the determined role and risk level
4. **Assessment execution** — automatically run relevant assessments (Art. 6(3) exception if high-risk, GPAI systemic risk if applicable)
5. **Penalty exposure** — calculate maximum fine based on risk level and provided turnover
6. **Article citations** — search and cite relevant articles with EUR-Lex deep links
7. **Structured report output** — produce a JSON report with defined schema covering all sections
8. **Three delivery channels** — available as CLI command (`lexius audit`), API endpoint (`POST /api/v1/audit`), and programmatic function

### P1 — Should Have

9. **Markdown report rendering** — format the JSON report as readable markdown
10. **Annex IV checklist** — include technical documentation requirements if high-risk
11. **Deadline awareness** — highlight upcoming compliance deadlines relevant to the system
12. **Confidence scoring** — overall report confidence based on signal completeness
13. **Recommendations** — actionable next steps based on the assessment

### P2 — Nice to Have

14. **Interactive mode** — agent asks follow-up questions to fill signal gaps before generating report
15. **Multi-legislation** — assess against multiple regulations in a single report
16. **PDF export** — render report as PDF
17. **Comparison mode** — compare two system assessments side by side

## Report Schema

```typescript
interface ComplianceReport {
  metadata: {
    generatedAt: string;        // ISO timestamp
    legislationId: string;
    legislationName: string;
    agentModel: string;
    reportVersion: string;
  };
  systemDescription: string;
  classification: {
    riskLevel: string;
    confidence: string;
    basis: string;
    matchedCategory: string | null;
    matchedSignals: string[];
    missingSignals: string[];
  };
  obligations: Array<{
    obligation: string;
    article: string;
    deadline: string | null;
    category: string;
  }>;
  assessments: Array<{
    id: string;
    name: string;
    result: Record<string, unknown>;
    reasoning: string;
  }>;
  penaltyExposure: {
    highestTier: string;
    maxFine: number;
    explanation: string;
  } | null;
  annexIvChecklist: Array<{
    item: number;
    title: string;
    description: string;
  }> | null;
  deadlines: Array<{
    date: string;
    event: string;
    daysRemaining: number;
    isPast: boolean;
  }>;
  citations: Array<{
    article: string;
    title: string;
    summary: string;
    url: string;
  }>;
  recommendations: string[];
  confidence: {
    overall: string;
    signalCompleteness: number;  // 0-1
    reasoning: string;
  };
}
```

## Out of Scope

- Storing reports in the database (future)
- User authentication for report access
- Automated remediation (fixing compliance gaps)

## Success Metrics

- Agent produces a complete report from a 2-sentence system description
- Report covers all 7 sections (classification, obligations, assessments, penalties, Annex IV, deadlines, citations)
- All citations link to valid EUR-Lex URLs
- Report generation completes in under 30 seconds
- Output is deterministic for the same input (tool calls are deterministic; agent reasoning is reproducible)

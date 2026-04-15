# ARD-008: Agent Uplift — Agentic Reasoning and Model Strategy

## Status: Accepted
## Date: 2026-04-15

---

## Context

The current AuditAgent makes one Claude call to enhance a report. This produces shallow output. We need iterative reasoning, better prompts, and intentional model selection. Enhanced mode should be available in all channels, not just packages/agent.

## Decision

### 1. Enhanced Mode as Core Feature

Move the LLM enhancement logic into a new use case in packages/core: `EnhanceAuditReport`. This use case takes a `ComplianceReport` and an `EnhancementService` port, and returns an `EnhancedComplianceReport`.

```
GenerateAuditReport (deterministic)
        │
        ▼
  ComplianceReport
        │
        ▼
EnhanceAuditReport (uses EnhancementService port)
        │
        ▼
  EnhancedComplianceReport
```

The `EnhancementService` is a port — the domain doesn't know about Anthropic. The implementation lives in infrastructure.

```typescript
interface EnhancementService {
  enhance(report: ComplianceReport, systemDescription: string): Promise<ReportEnhancement>;
}

interface ReportEnhancement {
  summary: string;
  recommendations: string[];
  riskAreas: string[];
  reasoning: Record<string, string>;  // section → reasoning text
  gapAnalysis: string[];
}
```

### 2. Model Strategy

Two model tiers configured via environment:

| Task | Env Var | Default | Why |
|------|---------|---------|-----|
| Complex reasoning (interactive, edge cases) | `ANTHROPIC_MODEL_REASONING` | `claude-opus-4-6` | Multi-step analysis, nuanced interpretation |
| Structured extraction (report enhancement) | `ANTHROPIC_MODEL_STRUCTURED` | `claude-sonnet-4-6` | JSON output, fast, cost-effective |

The `EnhancementService` implementation uses `ANTHROPIC_MODEL_STRUCTURED`. The interactive chat agent uses `ANTHROPIC_MODEL_REASONING`. Both fall back to `ANTHROPIC_MODEL` if the specific var isn't set.

### 3. Agentic Reasoning Loop

The interactive agent (chat mode) uses a reasoning loop:

```
1. Receive system description
2. Screen for prohibited practices (fast check, Haiku-eligible)
3. If not prohibited:
   a. Identify which signals would be most discriminating
   b. Ask the user for those signals (max 5 questions)
   c. After each answer, re-evaluate whether classification is confident
   d. Stop when confidence >= "high" or questions exhausted
4. Generate full report
5. Enhance with reasoning
6. Present to user with option to drill into any section
```

### 4. Domain-Expert System Prompt

The system prompt encodes compliance methodology, not generic instructions:

```
You are a senior AI regulatory compliance consultant with deep expertise in the EU AI Act and related legislation. You follow a structured assessment methodology:

ASSESSMENT METHODOLOGY:
1. PROHIBITED PRACTICE SCREEN — Check Article 5 prohibitions first. If the system performs social scoring, subliminal manipulation, exploitation of vulnerabilities, emotion recognition in workplaces/schools, untargeted facial scraping, biometric categorisation for sensitive attributes, predictive policing from profiling, or real-time remote biometric identification for law enforcement — stop and advise immediate prohibition compliance.

2. HIGH-RISK CLASSIFICATION — Check Annex III categories (8 domains) and Annex I product safety components. For each potential match, verify the specific use case against the category's scope — not all AI in a domain is high-risk.

3. ART. 6(3) EXCEPTION — For any high-risk classification, proactively assess whether the Art. 6(3) exception could narrow obligations. Check: is it a narrow procedural task? Does it improve a prior human activity? Pattern detection without replacing review? Preparatory task? Flag if profiling is involved (hard block).

4. TRANSPARENCY OBLIGATIONS — Check Article 50 triggers: direct interaction with persons, synthetic content generation, emotion recognition, biometric categorisation.

5. GPAI ASSESSMENT — If the system is or uses a general-purpose AI model, check training compute (10^25 FLOPs threshold) and Commission designation for systemic risk.

CITATION RULES:
- Every factual claim must cite a specific article number
- Use EUR-Lex URLs for verification
- Distinguish between what the regulation says and your interpretation
- Flag areas of regulatory ambiguity honestly

COMMUNICATION STYLE:
- Lead with the risk classification and its implications
- Explain what the classification means practically, not just legally
- Recommendations should be actionable ("establish a risk management system documenting X, Y, Z") not vague ("comply with requirements")
- When uncertain, say so and explain what additional information would resolve the uncertainty
```

### 5. Auditable Sources

Every report section gains a `sources` array:

```typescript
interface AuditableSection {
  sources: Array<{
    article: string;
    title: string;
    url: string;
    excerpt: string;      // relevant snippet from the regulation
    relevance: string;    // why this source supports this section
  }>;
}
```

The deterministic report populates sources from the citations search. The enhanced report adds the LLM's reasoning about *why* each source is relevant.

## Consequences

### Positive

- Enhanced mode available everywhere, not gated to agent package
- EnhancementService is a port — can swap Anthropic for any LLM
- Domain-expert prompts produce consultant-quality output
- Auditable sources make the report defensible
- Model selection is intentional and configurable

### Negative

- Two models means two API keys' worth of cost (mitigated: enhancement is optional)
- EnhancementService port adds a layer of abstraction
- Domain-expert prompt is long and needs maintenance as regulations evolve

### Mitigations

- Enhancement is opt-in (`--enhanced`), base report is always free
- Prompt is stored as a constant, easily updated
- Model fallback chain: specific → general → hardcoded default

## Alternatives Considered

1. **Keep enhancement in agent only** — rejected; gates best output behind one channel
2. **Single model for everything** — rejected; Opus is overkill for JSON extraction, Sonnet is too shallow for complex reasoning
3. **Embed reasoning in the deterministic use case** — rejected; LLM reasoning is non-deterministic and shouldn't live in core

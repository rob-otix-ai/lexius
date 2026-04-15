# PRD-004: Agent Uplift — Best-in-Class Compliance Intelligence

## Status: Draft
## Date: 2026-04-15
## Author: Robert

---

## Problem Statement

The current agent makes a single LLM call to enhance a deterministic report. This produces generic recommendations that don't reflect the nuance of the user's specific system. A compliance officer comparing our output to a human consultant's report would find it shallow — it tells you *what* the rules are but not *what they mean for you*.

Best-in-class compliance intelligence requires:
- Iterative reasoning that identifies gaps and self-corrects before presenting results
- Every claim traceable to a specific regulation article with reasoning chain
- Domain-expert-level prompt engineering, not generic "you are a helpful assistant"
- Enhanced mode available across all channels, not just the agent package
- Intentional model selection per task type

## Vision

An agent that thinks like a senior compliance consultant: methodical, thorough, citation-grounded, and able to explain *why* a classification matters — not just *what* it is. The output should be something a compliance officer can hand directly to legal counsel or a regulator.

## Requirements

### P0 — Must Have

1. **Agentic reasoning loop** — the agent iterates: classify → identify gaps → gather more context → refine classification → build report. Not a single-shot call.
2. **Reasoning chain in report** — every classification and recommendation includes a `reasoning` field explaining *why*, citing specific regulation text.
3. **Enhanced mode in all channels** — CLI (`--enhanced`), API (`?enhanced=true`), MCP (optional parameter). Uses LLM when available, gracefully degrades without.
4. **Domain-expert system prompt** — encodes how compliance officers actually assess systems: they check prohibited practices first, then Annex III categories, then safety components, then transparency triggers. The prompt mirrors this methodology.
5. **Separate model configuration** — `ANTHROPIC_MODEL_REASONING` for complex multi-turn analysis (defaults to claude-opus-4-6), `ANTHROPIC_MODEL_STRUCTURED` for JSON extraction and enhancement (defaults to claude-sonnet-4-6).
6. **Auditable output** — every section of the report includes `sources: [{ article, url, excerpt }]` linking claims to regulation text.
7. **Gap analysis** — the report explicitly lists what information is missing and how it would change the assessment if provided.

### P1 — Should Have

8. **Confidence calibration** — instead of just signal completeness, factor in classification basis (signals > keywords > semantic), assessment coverage, and whether the system falls near a classification boundary.
9. **Comparative analysis** — when a system is borderline (e.g., could be high-risk or limited), the report explains both possibilities and what would tip it.
10. **Structured intake interview** — in interactive mode, the agent asks questions in optimal order (most discriminating signals first) and stops when confidence is sufficient, not after a fixed number.
11. **Report versioning** — reports include a hash of input + regulation version, so changes in regulation data produce visibly different reports.

### P2 — Nice to Have

12. **Multi-model pipeline** — use a fast model (Haiku) for initial classification screening, then escalate to Opus only for edge cases.
13. **Regulation diff awareness** — when regulation data is updated (new seed), the agent can flag how existing assessments would change.
14. **Export formats** — markdown, JSON, HTML, PDF.

## Success Metrics

- Enhanced report recommendations are system-specific, not generic templates
- Every claim in the report traces to a regulation article with URL
- Enhanced mode adds < 10 seconds to report generation
- Compliance officers rate the report as "actionable without further research" > 80% of the time
- Agent identifies the correct risk classification on all 108 lexbeam test cases

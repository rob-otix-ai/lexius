# PRD-005: DORA Plugin — Digital Operational Resilience Act

## Status: Draft
## Date: 2026-04-16
## Author: Robert

---

## Problem Statement

Lexius currently only supports the EU AI Act. The platform was designed to support multiple regulations, but the abstraction hasn't been validated against a second regulation. DORA is the natural next step:

- It's a single EU Regulation (uniform application, no per-MS transposition)
- It has a clear entity taxonomy (~20 categories of financial entities)
- It has bespoke assessments analogous to the EU AI Act's Art. 6(3) exception (Critical/Important Function assessment, TLPT applicability, major incident classification)
- It shares audience overlap with the EU AI Act — many AI governance officers also cover DORA
- Adding DORA proves the plugin system works for a regulation with fundamentally different structure (financial services, not AI)

## Vision

DORA becomes the second regulation seeded into Lexius. A user can run `lexius classify --legislation dora --description "payment processor handling €200M/year"` and get the same structured response format they get for EU AI Act classifications — but with DORA-specific signals, obligations, and assessments.

This validates that:
1. The LegislationPlugin interface is genuinely regulation-agnostic
2. The domain model (entities, value objects, ports) extends to new legislations without changes
3. The consumers (API, MCP, CLI, Agent) require zero code changes to support DORA
4. Users can compare compliance posture across multiple regulations

## Users

| Persona | Need |
|---------|------|
| **Financial Services Compliance Officer** | Classify their firm's DORA obligations, check CTPP exposure, plan TLPT |
| **ICT Third-Party Provider** | Determine if they're in scope, assess CTPP designation risk |
| **Fintech CTO** | Understand which pillars apply, what contracts with ICT providers need |
| **GRC Platform Integrator** | Multi-regulation dashboards covering AI Act + DORA for same organisation |

## Product Requirements

### P0 — Must Have

1. **DORA seed data** — full regulation text:
   - Legislation metadata (id: "dora", name, jurisdiction EU, effective 2025-01-17)
   - ~20 financial entity categories (banks, payment institutions, investment firms, crypto-asset providers, insurance undertakings, AIFMs, UCITS, CSDs, CCPs, etc.)
   - Key articles: 5 (governance), 6–16 (ICT risk management framework), 17–23 (incident management & reporting), 24–27 (resilience testing), 28–30 (third-party risk), 31–44 (CTPP oversight), 45 (info sharing), 50–52 (penalties)
   - Five pillars as risk/obligation categories (ICT risk management, incident management, resilience testing, third-party risk, CTPP oversight)
   - Obligations grouped by financial entity type + microenterprise flag
   - Penalty structure (Art. 50–52 — per MS; Art. 35 CTPP penalty payments up to 1% daily turnover)
   - Deadlines: entry into force 2023-01-16, date of application 2025-01-17, first Register of Information 2025-04-30, first CTPP list 2025-11-18
   - FAQ entries (~20–25) covering scope, microenterprise, TLPT, CIF, Register of Information, DORA vs NIS2 interplay
2. **DORA plugin** at `packages/core/src/legislation/dora/` implementing `LegislationPlugin`:
   - Signal schema: entity type, microenterprise flag, supports_critical_functions, uses_ict_third_party, is_ctpp, annual_volume
   - Signal-based classification mapping entity type → applicable pillars and obligations
   - Keyword-based fallback for free-text descriptions
   - Three assessments: `critical-function-assessment`, `tlpt-applicability`, `major-incident-classification`
   - Penalty calculation respecting MS-level variation (default to 2% turnover / €2M baseline, configurable)
3. **Plugin registered** in composition root alongside EuAiActPlugin
4. **All consumers work with DORA unchanged** — API, MCP, CLI, Agent return DORA results when `legislationId=dora` is passed
5. **Cross-regulation awareness** — API/MCP can list both legislations; audit report can cite DORA articles

### P1 — Should Have

6. **CTPP designation check** — assessment returning whether an ICT provider might be designated as critical based on heuristics (systemic impact, substitutability, concentration)
7. **DORA vs NIS2 lex specialis flag** — audit report notes when financial entity is under DORA (not NIS2) for ICT risk
8. **TLPT cycle calculator** — given last TLPT date, compute next required date (3-year cycle)
9. **Register of Information field list** — retrievable via article endpoint (annex-style, similar to Annex IV in EU AI Act)

### P2 — Nice to Have

10. **CTPP live list integration** — optional external data source for current CTPP designations
11. **Per-MS penalty variation data** — seed data capturing each MS's implementing law fine caps
12. **Incident reporting template generator** — output the fields required for the 24/72/30 timeline

## Out of Scope

- DORA Level 2 RTS/ITS text (Level 1 only for first iteration)
- CER Directive overlap
- Sectoral prudential overlay (CRR, Solvency II, MiFIR)
- TIBER-EU methodology details (reference, not replicate)

## Success Metrics

- DORA plugin registered and working with zero changes to core domain
- All 10 API endpoints work with `legislationId=dora`
- MCP tools work with DORA via `legislationId` parameter
- Audit report can be generated for DORA with at least as much detail as EU AI Act
- Cross-regulation query (list both legislations, get obligations for same org under both) works

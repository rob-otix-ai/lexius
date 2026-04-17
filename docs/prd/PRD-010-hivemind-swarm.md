# PRD-010: Hivemind Swarm — Parallel Compliance Analysis

## Status: Draft
## Date: 2026-04-17
## Author: Robert

---

## Problem Statement

Lexius's agent today processes compliance queries sequentially: classify → fetch obligations → calculate penalties → check deadlines → search articles → produce report. For a full EU AI Act assessment touching 30+ articles across 16 obligation categories, this takes ~30 seconds and 8+ sequential LLM tool calls. Cross-legislation queries ("compare my obligations under EU AI Act AND DORA") double the latency with no parallelism.

The sequential model also has a structural limit: the agent must anticipate which articles matter before it's read them. It calls `get_obligations(role=provider, riskLevel=high-risk)` and gets back the curated set — but it never discovers obligations that exist in the law but aren't in the curated seed. The 661 shall-clauses extracted from the EU AI Act verbatim text are invisible to the current agent unless someone manually wires a `search_knowledge` call for each one.

A hivemind swarm architecture eliminates both bottlenecks: N agents work in parallel over article ranges, share findings through a workspace table, and surface obligations, penalties, deadlines, cross-references, and gaps that no single sequential query path would discover.

## Vision

A user asks: *"Full compliance assessment for my AI recruitment screening system as provider."*

The system spawns 8 agents. Each claims a range of EU AI Act articles, reads the verbatim text and pre-extracted facts (shall-clauses, fines, dates, cross-refs), produces typed findings (obligations, penalties, deadlines, gaps, risks), and writes them to a shared workspace. Agents see each other's findings in real-time — when Agent B analyses Article 14 (human oversight) and discovers it cross-references Article 9 (risk management), it reads Agent A's Art. 9 findings already in the workspace and links them.

In ~8 seconds (wall clock), the workspace contains 40+ findings across 113 articles. A synthesis pass renders them into a ComplianceReport with full provenance — every finding traces back to a verbatim article, an extracted shall-clause, or a curated obligation, each with its tier badge.

The same swarm handles DORA, NIS2, or any future legislation with zero code changes — just different articles in the queue.

## Users

| Persona | Need |
|---------|------|
| **Compliance Officer** | Get a comprehensive assessment in seconds, not minutes; see every obligation the law actually imposes, not just what was hand-curated |
| **Legal Counsel** | Cross-legislation analysis: "where do my DORA obligations overlap with AI Act?" — answered by swarm agents working both legislations simultaneously |
| **Platform Operator** | Serve N concurrent users without N × 30s sequential latency; swarm parallelism amortises per-query LLM cost |
| **Auditor** | Every finding has a provenance chain: finding → workspace → extract → article → CELLAR source hash |

## Product Requirements

### P0 — Must Have

1. **`compliance_workspace` table** — shared state for the swarm. One row per finding per session. Columns: `session_id` (UUID), `agent_id`, `article_id`, `finding_type` (enum: `obligation`, `penalty`, `deadline`, `cross_ref`, `gap`, `risk`), `finding` (JSONB — structured per type), `provenance_tier`, `source_extract_id` (nullable FK to `article_extracts`), `created_at`.
2. **`swarm_work_queue` table** — articles to analyse for a session. Columns: `session_id`, `article_id`, `claimed_by` (nullable agent ID), `claimed_at`, `completed_at`. Atomic claim via `UPDATE ... SET claimed_by = $id WHERE claimed_by IS NULL ... RETURNING`.
3. **Work partitioning** — given a legislation and a session, populate the work queue with all AUTHORITATIVE articles. No manual range assignment; agents claim dynamically.
4. **Swarm agent loop** — each agent runs the same code:
   - Claim N articles (configurable batch size, default 5).
   - For each article: read `full_text`, read `article_extracts` (shall-clauses, fines, dates, cross-refs), read workspace findings from other agents for cross-referenced articles.
   - Produce findings: for each shall-clause extract, emit an `obligation` finding with a subject hint, article ref, and provenance. For each fine/percentage extract, emit a `penalty` finding. For each date extract, emit a `deadline` finding. For each cross-ref, emit a `cross_ref` finding linking the two articles.
   - Compare extracted obligations to curated obligations (by embedding similarity or derivation chain). If a shall-clause has no matching curated obligation, emit a `gap` finding — "this obligation exists in the law but is not in the curated database."
   - Write all findings to `compliance_workspace` in a single transaction.
   - Release the claim.
5. **Stigmergic communication** — agents don't message each other. They read the workspace table to see what's been found. When Agent B analyses Article 14 and finds a cross-reference to Article 9, it queries `SELECT * FROM compliance_workspace WHERE session_id = $sid AND article_id = 'eu-ai-act-art-9'` to enrich its own findings with Agent A's prior work.
6. **Synthesis agent** — runs after all work queue items are completed. Reads all workspace findings, groups by `finding_type`, cross-references obligations with penalties via shared `article_id`, and produces a `ComplianceReport` (same shape as `GenerateAuditReport` output). The synthesis agent does NOT call the LLM for analysis — it transforms structured findings into the report shape. LLM is optional for a natural-language summary paragraph.
7. **Session lifecycle** — `createSwarmSession(legislationId, options)` returns a `session_id`. `runSwarm(sessionId, concurrency)` spawns N agents and blocks until the queue is drained. `synthesise(sessionId)` produces the report. `cleanupSession(sessionId)` deletes workspace + queue rows (or archives them).
8. **Concurrency control** — configurable number of parallel agents (default 4, max 8). Each agent is a `Promise` running the agent loop; `Promise.all` waits for completion. No OS threads — Node event-loop concurrency via async/await.
9. **Finding schema** — each `finding_type` has a typed JSONB shape:
   - `obligation`: `{ text, subjectHint, articleRef, shallClauseId, matchedCuratedId?, confidence }`
   - `penalty`: `{ amountEur, turnoverPercentage, paragraphRef, extractId }`
   - `deadline`: `{ date, dateLabel?, paragraphRef, extractId }`
   - `cross_ref`: `{ sourceArticleId, targetArticleId, context }`
   - `gap`: `{ shallClauseText, shallClauseId, articleRef, reason }`
   - `risk`: `{ description, articleRef, severity }`
10. **Provenance on every finding** — `provenance_tier` is inherited from the source: `AUTHORITATIVE` if derived from an article extract, `CURATED` if matched to a curated obligation, `AI_GENERATED` if the swarm agent inferred it.

### P1 — Should Have

11. **Cross-legislation swarm** — populate the work queue with articles from multiple legislations. Agents work both legislations; cross-ref findings can span legislation boundaries. The synthesis agent groups findings per legislation and adds a cross-legislation overlap section.
12. **Partial result streaming** — expose a `GET /swarm/:sessionId/stream` SSE endpoint that emits findings as they're written to the workspace. A frontend (or Claude.ai via MCP) can show findings arriving in real-time.
13. **Gap prioritisation** — rank `gap` findings by the severity of the uncovered obligation (heuristic: "shall not" clauses rank higher than "may" clauses; articles referenced by penalties rank higher than unreferenced ones).
14. **Agent specialisation** — optionally allow one agent in the swarm to be a "penalty specialist" that claims only articles known to contain fine amounts (from `article_extracts WHERE extract_type = 'fine_amount_eur'`). Reduces noise from generalist agents producing weaker penalty findings.

### P2 — Nice to Have

15. **Persistent swarm sessions** — archive completed workspace sessions for later retrieval. A user can re-open a prior assessment and see exactly what the swarm found.
16. **Incremental re-assessment** — when articles are re-fetched (new source_hash), re-run only the swarm agents for the changed articles. Delta findings are compared to the prior session.
17. **User-in-the-loop** — pause the swarm after the initial pass, let the user review gap findings and confirm/dismiss them, then run a second pass incorporating their feedback.

## Out of Scope

- Swarm agents do NOT call the LLM for article analysis (P0). They work over pre-extracted facts (shall-clauses, fines, dates, cross-refs) deterministically. LLM is only used in synthesis for the optional summary paragraph. This may change in P1 if gap detection benefits from LLM reasoning.
- Distributed execution across machines. Swarm runs in a single Node process via async concurrency.
- Real-time multi-user collaboration on a shared workspace.
- Swarm-based FAQ generation (defer to a separate PRD).

## Success Metrics

- Full EU AI Act provider assessment completes in < 10 seconds (wall clock) with 4 agents, vs ~30 seconds for the sequential agent.
- The swarm discovers at least 10 `gap` findings — shall-clauses in the law that have no matching curated obligation. This is the "didn't know what we didn't know" metric.
- Zero findings cite an article that doesn't exist in the DB (referential integrity via FK on workspace rows).
- Every `obligation` finding with `provenance_tier = AUTHORITATIVE` traces back to a real `shall_clause` extract with a non-null `source_extract_id`.
- Cross-legislation query (EU AI Act + DORA) completes in < 15 seconds with 8 agents.
- Synthesis report has the same shape as `GenerateAuditReport` output — drop-in replacement for the existing audit flow.

## Rollout

1. Schema migration: `compliance_workspace` + `swarm_work_queue` tables + finding_type enum.
2. Swarm agent loop (single-threaded first) + workspace write path.
3. Work queue claim/release with atomic Postgres operations.
4. Parallel execution (Promise.all, configurable concurrency).
5. Gap detection: shall-clause → curated-obligation matching.
6. Synthesis agent producing ComplianceReport.
7. API route `POST /swarm/run` + `GET /swarm/:sessionId/findings`.
8. MCP tool `legalai_run_swarm_assessment`.
9. Integration with existing `GenerateAuditReport` as an alternative execution backend.

# ARD-014: Hivemind Swarm Architecture

## Status: Accepted
## Date: 2026-04-17

---

## Context

PRD-010 specifies a parallel compliance analysis system where N autonomous agents work over article ranges, share findings through a Postgres table (stigmergic communication), and a synthesis pass produces the final report. This ARD locks in the table design, concurrency model, agent loop contract, and integration with the existing codebase.

## Decision

### 1. Shared state in Postgres, not in-memory

The swarm's workspace is a Postgres table, not a Map in Node memory. Reasons:

- **Durability**: a crashed agent doesn't lose findings.
- **Queryability**: agents read other agents' findings via SQL with indexes; no custom message-passing protocol.
- **Observability**: any tool can query the workspace — the API, the synthesis agent, a debug CLI.
- **Consistency**: Postgres transactions guarantee atomic claim/release and finding writes.

Rejected alternatives:
- **Redis**: faster reads/writes but no JSONB querying, no FK integrity with `articles`/`article_extracts`, another service to manage.
- **In-memory Map with mutex**: loses state on crash, doesn't support external observability.
- **SQLite**: single-writer bottleneck; Postgres handles concurrent writers natively.

### 2. Work queue via `UPDATE ... RETURNING` (no external queue)

```sql
-- Claim work
UPDATE swarm_work_queue
SET claimed_by = $agentId, claimed_at = now()
WHERE session_id = $sessionId
  AND claimed_by IS NULL
ORDER BY article_id
LIMIT $batchSize
RETURNING article_id;

-- Release claim on completion
UPDATE swarm_work_queue
SET completed_at = now()
WHERE session_id = $sessionId
  AND article_id = ANY($articleIds)
  AND claimed_by = $agentId;
```

`SKIP LOCKED` is not needed because each agent claims a batch atomically; contention resolves at the Postgres row-lock level. For our scale (190 articles, 4-8 agents), this is zero-overhead.

Rejected alternatives:
- **BullMQ / RabbitMQ**: production-grade but adds a service dependency for a problem Postgres solves natively at our scale.
- **Round-robin assignment at session creation**: doesn't support dynamic load balancing; an agent that finishes early can't pick up more work.

### 3. Finding schema as discriminated JSONB

The `compliance_workspace.finding` column is JSONB, discriminated by `finding_type`. Each type has a typed shape (per PRD-010 P0#9). The Postgres table stores the JSONB; the TypeScript domain defines discriminated union types.

```typescript
type SwarmFinding =
  | { type: "obligation"; text: string; subjectHint: string; articleRef: string; shallClauseId: number; matchedCuratedId?: string; confidence: number }
  | { type: "penalty"; amountEur: number; turnoverPercentage: number; paragraphRef: string; extractId: number }
  | { type: "deadline"; date: string; dateLabel?: string; paragraphRef: string; extractId: number }
  | { type: "cross_ref"; sourceArticleId: string; targetArticleId: string; context: string }
  | { type: "gap"; shallClauseText: string; shallClauseId: number; articleRef: string; reason: string }
  | { type: "risk"; description: string; articleRef: string; severity: "high" | "medium" | "low" };
```

No schema validation at the DB level (JSONB is flexible); validation happens in the agent code via the TypeScript types. A CHECK constraint is too rigid for iterating on the finding shape.

### 4. Concurrency via Promise.all, not worker threads

Each swarm agent is an async function. `runSwarm(sessionId, concurrency)` runs N agents via `Promise.all`:

```typescript
const agents = Array.from({ length: concurrency }, (_, i) =>
  runSwarmAgent(db, sessionId, `agent-${i}`, options)
);
await Promise.all(agents);
```

Node's event loop handles I/O concurrency. The bottleneck is Postgres queries and (optionally) LLM calls, both async. CPU-bound work is negligible (we're composing findings from pre-extracted facts, not parsing HTML).

Rejected alternatives:
- **Worker threads**: adds complexity (message passing, serialization) for no benefit when work is I/O-bound.
- **Child processes**: same issue plus startup overhead.
- **External orchestrator (Temporal, Step Functions)**: enterprise-grade but massive overhead for an in-process parallel loop.

### 5. Agents are deterministic by default; LLM is opt-in

P0 swarm agents do NOT call the LLM. They:
1. Read `article_extracts` (shall-clauses, fines, dates, cross-refs) — deterministic.
2. Match shall-clauses to curated obligations via embedding cosine similarity — deterministic given fixed embeddings.
3. Emit typed findings — deterministic.

The LLM is used ONLY in the synthesis agent for an optional natural-language summary. This keeps the swarm reproducible: same articles + same extracts + same curated data = same workspace findings.

A future P1 flag (`useLlmForGapAnalysis: true`) enables LLM reasoning for gap detection — passing the verbatim article text to the model and asking "what obligations does this article impose that aren't in the curated set?" This is opt-in because it introduces non-determinism and cost.

### 6. Stigmergic reads are optimised by index

Agents read each other's findings via:
```sql
SELECT * FROM compliance_workspace
WHERE session_id = $sid AND article_id = $targetArticleId;
```

Index: `(session_id, article_id)`. Since articles are claimed in order and cross-references tend to point backward (Art. 14 references Art. 9, not the other way around), earlier articles' findings are usually in the workspace before later articles need them. For forward references (Art. 9 mentioning Art. 14), the finding may not exist yet — the agent records the cross-ref finding and moves on; the synthesis agent resolves it.

### 7. Synthesis replaces the sequential audit pipeline

Today: `GenerateAuditReport` calls 8 use cases sequentially.

With the swarm: `GenerateAuditReport` can accept a `workspaceSessionId` instead of doing its own tool calls. It reads the workspace findings and maps them to the same `ComplianceReport` shape:

```typescript
// Existing path (unchanged)
const report = await generateAuditReport.execute(input);

// Swarm path (new)
const sessionId = await createSwarmSession("eu-ai-act", input);
await runSwarm(sessionId, { concurrency: 4 });
const report = await synthesiseSwarm(sessionId, input);
```

Both paths produce the same `ComplianceReport` type. The swarm path is faster and discovers gaps.

### 8. Gap detection via shall-clause matching

For each `shall_clause` extract in the claimed articles, the agent:
1. Computes cosine similarity against all curated obligation embeddings for that legislation.
2. If the best match scores below a threshold (0.85), emits a `gap` finding.
3. If above threshold, emits an `obligation` finding with `matchedCuratedId` set.

The threshold is configurable. Starting conservative (0.85) means fewer false-positive gaps but more missed ones. Tuning happens by reviewing gap findings against the actual curated set.

The embedding vectors already exist on both obligations and articles (from the seed + fetcher). No new embedding computation needed.

### 9. Session cleanup

Workspace and queue rows are deleted after synthesis produces the report, unless the user opts for persistence (P2). A scheduled cleanup deletes sessions older than 24 hours.

No `article_revisions`-style archival — workspace findings are ephemeral analysis results, not authoritative records.

### 10. Package placement

The swarm lives in `@lexius/agent` (existing package) alongside the existing `createAgent`, `AuditAgent`, and `ReasoningLoop`. New files:

```
packages/agent/src/
├── swarm/
│   ├── types.ts              -- SwarmFinding, SwarmSession, WorkQueueItem
│   ├── session.ts            -- createSwarmSession, cleanupSession
│   ├── agent-loop.ts         -- runSwarmAgent (the core loop)
│   ├── gap-detector.ts       -- shall-clause → curated obligation matching
│   ├── synthesise.ts         -- workspace → ComplianceReport
│   └── index.ts              -- runSwarm (orchestrates Promise.all)
```

No new package. The swarm uses `@lexius/core` ports for data access (same as the existing agent) and `@lexius/db` for workspace/queue tables.

## Consequences

### Positive

- Full assessment drops from ~30s to ~8s (4x speedup with 4 agents).
- Gap detection surfaces obligations the curated set misses — the most valuable new capability.
- Adding a new legislation requires zero swarm code changes — just articles in the queue.
- The workspace is a debuggable, queryable artefact — every finding is inspectable.
- Stigmergic communication is simpler than message-passing — no protocol, no serialisation, just SQL.

### Negative

- Postgres becomes the concurrency bottleneck if scaled beyond ~8 agents (row-level locking on claims). Fine for our scale; would need `SKIP LOCKED` or partitioned queues for 50+ agents.
- Gap detection via embedding similarity has false positives (a shall-clause that looks like an existing obligation but has a different legal effect) and false negatives (a novel obligation with no similar curated row). Requires human review.
- Workspace table grows with usage. Without cleanup, a busy instance accumulates thousands of rows per day.
- The swarm is invisible to the MCP/API layer unless explicitly exposed via new routes.

### Mitigations

- Automatic session cleanup after 24 hours.
- Gap findings include the verbatim shall-clause text so reviewers can judge quickly.
- The synthesis agent flags gaps separately from confirmed obligations in the report.
- API/MCP integration (P0#7-8) ensures the swarm is accessible through the same channels as the existing agent.

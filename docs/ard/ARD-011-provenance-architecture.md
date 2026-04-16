# ARD-011: Provenance Architecture (Tier 1)

## Status: Accepted
## Date: 2026-04-16

---

## Context

PRD-006 added `verbatim: boolean` + `source_hash` + `fetched_at` to the `articles` table. That is a binary signal ("fetched" vs "not fetched") and applies only to articles. Derived content — obligations, FAQ, penalties, deadlines, risk categories — has no provenance signal at all, so a consumer cannot distinguish an expert-curated obligation from an LLM-generated one.

PRD-007 raises the bar to three defensible provenance claims:

- **AUTHORITATIVE** — verbatim from an official legislative source, with a recorded hash and URL.
- **CURATED** — written or reviewed by a named domain expert, with attribution and review date.
- **AI_GENERATED** — produced by a model, with the model identifier recorded, not expert-reviewed.

We also need (a) a typed derivation link from derived content back to its source articles and (b) a preserved history of article text across amendments. This ARD defines where those live, how they are enforced, and how they interact with existing clean-architecture boundaries.

## Decision

### 1. Tier as a database enum, exposed as a domain value object

Postgres enum type `provenance_tier` with values `AUTHORITATIVE`, `CURATED`, `AI_GENERATED`. Every provenance-bearing table gets a `provenance_tier` column typed as this enum, `NOT NULL`.

```sql
CREATE TYPE provenance_tier AS ENUM ('AUTHORITATIVE', 'CURATED', 'AI_GENERATED');
```

Drizzle exposes it via `pgEnum`, and `@lexius/core/domain` defines a matching TypeScript union:

```typescript
// packages/core/src/domain/value-objects/provenance-tier.ts
export type ProvenanceTier = "AUTHORITATIVE" | "CURATED" | "AI_GENERATED";
```

Rejected alternatives:
- `varchar` with a CHECK constraint — weaker typing on the Drizzle side and no schema-level enumeration.
- `smallint` codes — premature optimisation; breaks readability in raw SQL audits.

### 2. Provenance fields live on the entity row, not a sidecar table

Every provenance-bearing row carries its own provenance fields inline. We considered a single `provenance` table joined by `(entity_type, entity_id)` but rejected it:

- Join on every read, including hot query paths (article lookups, obligation list).
- Denormalised write pattern — 2 writes per row — without a corresponding benefit because tier is intrinsic to the row.
- Audit questions ("show me every `AI_GENERATED` FAQ") are harder through a sidecar.

Columns added to every provenance-bearing table:

```
provenance_tier     provenance_tier NOT NULL
source_url          text           (AUTHORITATIVE: required; others: optional)
source_hash         varchar(64)    (AUTHORITATIVE: required)
fetched_at          timestamp      (AUTHORITATIVE: required)
curated_by          text           (CURATED: required)
reviewed_at         timestamp      (CURATED: required)
generated_by_model  text           (AI_GENERATED: required)
generated_at        timestamp      (AI_GENERATED: required)
```

Required-by-tier is enforced as a **table-level CHECK constraint**, not as nullable columns alone:

```sql
ALTER TABLE articles ADD CONSTRAINT articles_provenance_required CHECK (
  (provenance_tier = 'AUTHORITATIVE' AND source_hash IS NOT NULL AND source_url IS NOT NULL AND fetched_at IS NOT NULL)
  OR (provenance_tier = 'CURATED' AND curated_by IS NOT NULL AND reviewed_at IS NOT NULL)
  OR (provenance_tier = 'AI_GENERATED' AND generated_by_model IS NOT NULL AND generated_at IS NOT NULL)
);
```

Rationale: this guarantees an `AUTHORITATIVE` row cannot exist in the database without a source hash, even if application code forgets to set it. Compliance defense.

### 3. Derivation chain as a typed array

`obligations.derived_from` and `faq.derived_from` are `text[]` — arrays of `article.id` values (primary keys like `eu-ai-act-art-9`). Empty array = "no specific source". No referential integrity constraint (FK on array element is not natively supported), but a trigger in the migration validates that every ID in the array exists in `articles`:

```sql
CREATE OR REPLACE FUNCTION validate_derived_from() RETURNS trigger AS $$
DECLARE missing text;
BEGIN
  SELECT a INTO missing
  FROM unnest(NEW.derived_from) a
  WHERE NOT EXISTS (SELECT 1 FROM articles WHERE id = a);
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'derived_from references unknown article: %', missing;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

Rejected alternatives:
- Join table `obligation_derived_from(obligation_id, article_id)` — more writes and joins for a small, cold field. Array is fine at our scale.
- Single `article_id: varchar` — loses the "paraphrases multiple articles" case which is the common one for obligations spanning Art. 9 + 10.

FAQ already has `article_references: text[]` (informational, untyped). `derived_from` replaces it semantically; the migration copies existing values into `derived_from` and deprecates `article_references` (kept for one release, then dropped in a follow-up migration).

### 4. Article revisions as an append-only sibling table

`article_revisions` stores the prior state of an article whenever the fetcher updates it. The current row stays in `articles`; archived versions go here.

```sql
CREATE TABLE article_revisions (
  id              serial PRIMARY KEY,
  article_id      varchar NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  source_hash     varchar(64) NOT NULL,
  source_url      text,
  source_format   varchar(16),
  title           text NOT NULL,
  full_text       text NOT NULL,
  fetched_at      timestamp NOT NULL,
  superseded_at   timestamp NOT NULL DEFAULT now()
);

CREATE INDEX article_revisions_article_id_idx ON article_revisions (article_id, superseded_at DESC);
```

- Insert-only from the fetcher.
- No `UPDATE` or `DELETE` paths in application code. Enforced by convention + the Specflow contract.
- A database-level trigger on `articles` copies the pre-update row into `article_revisions` before the update applies; application code does not need to remember.

```sql
CREATE OR REPLACE FUNCTION archive_article_revision() RETURNS trigger AS $$
BEGIN
  IF OLD.source_hash IS DISTINCT FROM NEW.source_hash THEN
    INSERT INTO article_revisions (article_id, source_hash, source_url, source_format, title, full_text, fetched_at)
    VALUES (OLD.id, OLD.source_hash, OLD.source_url, OLD.source_format, OLD.title, OLD.full_text, OLD.fetched_at);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER articles_archive_on_update
  BEFORE UPDATE ON articles
  FOR EACH ROW
  WHEN (OLD.source_hash IS NOT NULL)
  EXECUTE FUNCTION archive_article_revision();
```

Rationale: the trigger makes "update without archiving" impossible, even if an LLM-written ingest path forgets. The contract also enforces the application-level pattern for redundancy.

Postgres fires `BEFORE UPDATE` triggers for rows updated by `INSERT ... ON CONFLICT DO UPDATE`, which is how Drizzle's `onConflictDoUpdate` (used by the fetcher) compiles. So the trigger works for the fetcher's upsert path without any code-level cooperation.

### 5. `verbatim` boolean is deprecated, not removed

`articles.verbatim` stays in the schema for one release. During migration:

- `verbatim = true` → `provenance_tier = 'AUTHORITATIVE'`
- `verbatim = false` → `provenance_tier = 'CURATED'` (best default for existing hand-seeded articles)

A follow-up migration removes `verbatim` once all consumers read `provenance_tier`. The migration that adds tier must not break code reading `verbatim`.

Rejected: drop `verbatim` immediately. Would create a flag day across fetcher, seeds, API, and MCP.

### 6. Clean-architecture placement

- **Domain**: `ProvenanceTier` value object, `Provenance` value object bundling tier + fields, `ArticleRevision` entity, repository port `ArticleRevisionRepository`.
- **Use cases**: `GetDerivationChain`, `GetArticleHistory`. Consume repository ports; no infrastructure imports.
- **Infrastructure**: Drizzle schema + repositories, revision archiving trigger (installed by migration).
- **Adapters**: API routes, MCP tools, CLI, seed authoring, fetcher. All read/write through use cases or through `@lexius/db` exports; never reach past the trigger by bypassing the ORM.

No new package. Schema goes in `@lexius/db`, domain types in `@lexius/core/domain`, use cases in `@lexius/core/use-cases`. Agent and fetcher already depend on these.

### 7. Fetcher changes

The fetcher stays the only writer of `AUTHORITATIVE` articles. On ingest:

- Set `provenance_tier = 'AUTHORITATIVE'`
- Populate `source_hash`, `source_url`, `fetched_at`
- Trigger archives the prior row automatically on update
- Remove `verbatim: true` line from upserts (the contract allows it during the deprecation window)

Seed runners that author CURATED or AI_GENERATED rows must supply the matching provenance fields; missing fields fail the CHECK constraint at insert time.

### 8. Consumer surfacing

- REST API DTOs add `provenanceTier`, `sourceUrl`, `sourceHash`, `curatedBy`, `reviewedAt`, `generatedByModel`, `generatedAt`, `derivedFrom`. Fields irrelevant to a row's tier are returned as `null`.
- MCP tool responses mirror the DTO.
- Audit report rendering (`GenerateAuditReport`) attaches a tier to each citation and aggregates a "Reliance by Tier" summary in the report metadata.

The API does not filter by tier by default; `minTier` is a query parameter on list endpoints (P1).

## Consequences

### Positive

- Tier, derivation, and history become **database invariants**, not application conventions. Harder to regress.
- Compliance officers can cite Lexius content honestly; auditors can trace any derived statement to its source.
- Amendments no longer destroy prior text; regulators asking "what did Art. 6 say on 2025-01-01?" get a direct answer.
- Contract enforcement fails CI on missing provenance, so LLM-written seed code cannot silently ship unlabelled content.

### Negative

- Schema migration is the largest to date (7 tables touched, 1 new table, 1 enum type, 2 triggers, 2 functions).
- Every write path to a provenance-bearing table must supply the correct tier + fields; developer ergonomics temporarily worse before helper builders exist.
- Article updates double the write amplification (current row + revision row). Acceptable — updates are cold (fetcher, monthly).
- `article_revisions` grows unbounded over time. No pruning strategy in this ARD; revisit when a regulation ages past its first amendment cycle.

### Mitigations

- Ship `ProvenanceBuilder` helpers in `@lexius/core/domain` for common cases (`authoritative({...})`, `curated({...})`, `aiGenerated({...})`) so seed authors don't hand-fill the tier-required fields.
- The revision trigger fires only when `source_hash` changes, not on every no-op write.
- Contract YAML includes `required_patterns` for every table's insert path; CI catches drift.

## Alternatives Considered

1. **One sidecar `provenance` table** — rejected; join on hot paths, worse ergonomics for audit queries.
2. **Store full provenance as JSONB** — rejected; loses type-level enforcement and makes querying by tier awkward.
3. **Archive revisions in application code instead of a trigger** — rejected; the trigger is the enforcement. Code can still archive explicitly via a use case for tests, but the DB guarantees nothing is lost.
4. **Drop the `verbatim` boolean in the same migration** — rejected; one-release deprecation window avoids a flag day.
5. **Skip CHECK constraints; rely only on the Specflow contract** — rejected; CI protects pre-merge, CHECK protects runtime. Defense in depth.
6. **Tier as 4 values (add `EXPERT_REVIEWED` between CURATED and AUTHORITATIVE)** — rejected for Tier 1. Keep three until we have evidence users want a finer distinction; adding a value later is a cheap `ALTER TYPE`.

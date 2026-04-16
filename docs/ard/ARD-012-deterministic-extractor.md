# ARD-012: Deterministic Extractor Architecture

## Status: Accepted
## Date: 2026-04-16

---

## Context

PRD-008 introduces an extractor that reads fetched article text and produces typed, verbatim-sourced facts (fine amounts, dates, article cross-refs, obligation clauses). These facts must be distinguishable from curated interpretation, verifiable against the source, and regenerated automatically when the source changes.

The extractor is NOT a separate ingest pipeline competing with the fetcher — it is a post-fetch transformation over already-stored verbatim text. This ARD locks in where it lives, how its output is stored, and how cross-checking enforces consistency.

## Decision

### 1. Extractor lives inside `@lexius/fetcher`, not in a new package

The parser for XHTML already exists in `@lexius/fetcher/src/parsers/xhtml-parser.ts`. It walks Formex tags, finds articles, extracts title + body. Adding a second parsing pass over the same body text is a natural extension — not a new responsibility. A new package would duplicate the cheerio dependency and create an artificial boundary.

Structure:

```
packages/fetcher/src/
├── cellar-client.ts            # unchanged
├── parsers/
│   ├── xhtml-parser.ts         # unchanged — emits ParsedArticle
│   └── types.ts                # gains ParsedExtract
├── extractors/                 # NEW
│   ├── fine-amount.ts
│   ├── turnover-percentage.ts
│   ├── date.ts
│   ├── article-cross-ref.ts
│   ├── annex-cross-ref.ts
│   ├── shall-clause.ts
│   └── index.ts                # registry
├── ingest.ts                   # orchestrates fetch → parse → write articles → run extractors → write extracts
└── cli.ts                      # adds `extract` subcommand
```

Rejected:
- **New `@lexius/extractor` package.** Would require re-parsing the article body from scratch, duplicating cheerio. No real separation of concerns — the extractor is the natural second stage of the same parse.
- **Putting extractors in `@lexius/core`.** Violates the clean-architecture rule that domain/use cases don't know about parsing implementation. Extractors are pure infrastructure; they belong alongside the HTTP and HTML parser.

### 2. `article_extracts` as a typed, append-updatable, per-article-hash table

One row per extracted fact. Primary key surrogate (`serial`); natural uniqueness via `(article_id, extract_type, paragraph_ref, value_hash)`.

```sql
CREATE TYPE extract_type AS ENUM (
  'fine_amount_eur',
  'turnover_percentage',
  'date',
  'article_cross_ref',
  'annex_cross_ref',
  'shall_clause',
  'annex_item'           -- P1
);

CREATE TABLE article_extracts (
  id               serial PRIMARY KEY,
  article_id       varchar NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  extract_type     extract_type NOT NULL,
  value_numeric    numeric(20, 2),     -- fine_amount_eur, turnover_percentage
  value_text       text,                -- article_cross_ref (target article ID), shall_clause (sentence), annex_item (text)
  value_date       timestamp,           -- date extracts
  paragraph_ref    text NOT NULL DEFAULT '',  -- "1", "3(a)", "" if article-level
  verbatim_excerpt text NOT NULL,       -- surrounding sentence/clause, for audit
  value_hash       varchar(64) NOT NULL, -- sha256 of canonicalised value (for uniqueness)
  provenance_tier  provenance_tier NOT NULL DEFAULT 'AUTHORITATIVE',
  source_hash      varchar(64) NOT NULL, -- article.source_hash at extraction time
  extracted_at     timestamp NOT NULL DEFAULT now(),
  CONSTRAINT article_extracts_provenance_authoritative
    CHECK (provenance_tier = 'AUTHORITATIVE'),
  CONSTRAINT article_extracts_value_present
    CHECK (value_numeric IS NOT NULL OR value_text IS NOT NULL OR value_date IS NOT NULL),
  CONSTRAINT article_extracts_natural_key
    UNIQUE (article_id, extract_type, paragraph_ref, value_hash)
);

CREATE INDEX article_extracts_article_type_idx
  ON article_extracts (article_id, extract_type);
CREATE INDEX article_extracts_source_hash_idx
  ON article_extracts (source_hash);
```

Rejected alternatives:
- **Columns on existing tables (e.g., `penalties.extracted_max_fine_eur`).** Denormalises; cross-check becomes awkward; no uniform query shape.
- **Single JSONB column `extracted_facts jsonb` on articles.** Loses type-level querying; harder to enforce AUTHORITATIVE tier at the constraint level.
- **Three separate tables per value type.** Over-normalised; the type discriminator is cheap, the unified query shape is high-value.

### 3. Append-only revisions for extracts

Mirrors the Tier 1 pattern for articles. When an extract is updated or deleted as the result of a re-extraction, the prior row archives to `article_extract_revisions` via a DB trigger.

```sql
CREATE TABLE article_extract_revisions (
  id               serial PRIMARY KEY,
  extract_id       integer NOT NULL,  -- not FK; original may be deleted
  article_id       varchar NOT NULL,
  extract_type     extract_type NOT NULL,
  value_numeric    numeric(20, 2),
  value_text       text,
  value_date       timestamp,
  paragraph_ref    text NOT NULL,
  verbatim_excerpt text NOT NULL,
  source_hash      varchar(64) NOT NULL,
  extracted_at     timestamp NOT NULL,
  superseded_at    timestamp NOT NULL DEFAULT now()
);

CREATE TRIGGER article_extracts_archive_on_update
  BEFORE UPDATE OR DELETE ON article_extracts
  FOR EACH ROW
  WHEN (OLD.source_hash IS DISTINCT FROM (CASE TG_OP WHEN 'DELETE' THEN NULL ELSE NEW.source_hash END))
  EXECUTE FUNCTION archive_article_extract_revision();
```

### 4. Re-extraction is idempotent; wires into the article update trigger

The extractor runs against a (article, source_hash) pair. For a given source_hash, the deterministic output is fixed — same input, same output. Implementation:

```
extractArticle(article):
  expectedExtracts = runAllExtractors(article.fullText, article.id)
  existingExtracts = db.select().from(article_extracts).where(article_id = article.id AND source_hash = article.source_hash)
  
  toInsert = expectedExtracts - existingExtracts
  toDelete = existingExtracts - expectedExtracts  // from a stale source_hash
  
  BEGIN TX
    DELETE toDelete        // trigger archives them
    INSERT toInsert
  COMMIT
```

Key property: running `extract` twice in a row against the same article state produces zero writes on the second run.

When the fetcher's `archive_article_revision` trigger fires (source_hash changed), the orchestrator immediately re-runs extraction for the affected article. The old extracts move to `article_extract_revisions` via the new trigger; new extracts populate `article_extracts`.

Rejected alternative: **reactive re-extraction via a DB trigger on `articles.source_hash`.** Too clever — triggers calling back into application logic is an antipattern. The ingest orchestrator handles sequencing.

### 5. Cross-check implemented as a Specflow-adjacent CI step, not a DB constraint

Numeric cross-check asks: "does this curated penalty row's `maxFineEur` match an `article_extracts.value_numeric` of type `fine_amount_eur` on any article in its `derivedFrom`?" That's an arbitrary cross-table query, not expressible as a simple CHECK constraint.

Implementation: a Node script `scripts/extractor-crosscheck.ts` runs in CI. It queries the DB (test fixture loaded) and outputs violations in a format specflow can parse. A new Specflow contract `extractor_crosscheck.yml` references the script as a `custom` rule — falling back to the enforce mechanism used by other contracts.

Alternative path if Specflow doesn't support custom scripts: standalone CI job that fails the build independently. Both are acceptable; we pick whichever integrates cleanest with the existing `npx specflow enforce .` step.

### 6. Cross-reference extraction populates a candidate queue, not direct writes

Cross-refs are the most valuable auto-wiring — they plug the 6 empty `derivedFrom` rows from Tier 1 and prepopulate new legislations. But blindly overwriting curated `derivedFrom` is risky: a curator might deliberately have chosen a narrower set than the law's cross-refs suggest.

Design: the extractor produces `article_cross_ref` rows in `article_extracts`. A separate `DerivationCandidates` view (SQL view, not a table) joins them with curated rows whose `derivedFrom` doesn't yet contain the cross-ref target. A CLI command `lexius-fetch backfill-derivation --dry-run` lists candidates; `--apply` writes them. No automatic writes during extraction itself.

Rejected: **automatic merging into `derivedFrom`**. Curator autonomy matters; extractor is infrastructure, not policy.

### 7. Parser modules are pure functions

Each module exports a function:

```typescript
export function extract(text: string, articleId: string, legislationId: string): ParsedExtract[];
```

No I/O, no DB access, no network. All inputs in, all outputs out. This is what lets us unit-test aggressively with fixture snippets — hundreds of regex edge cases tested in milliseconds.

The orchestrator (`ingest.ts`) composes extractors + writes the DB. Modules know nothing about Drizzle or Postgres.

### 8. Provenance tier on extracts is always AUTHORITATIVE, enforced at the DB

```sql
CONSTRAINT article_extracts_provenance_authoritative
  CHECK (provenance_tier = 'AUTHORITATIVE')
```

Rationale: an extract is a mechanical transformation of verbatim text. If a regex matches "EUR 35,000,000" in Art. 99(3), the resulting `fine_amount_eur` row is as authoritative as the article's full_text. There is no CURATED extract and no AI_GENERATED extract — if someone would want one, they should be writing a curated row instead.

This also makes the contract simple: we already enforce AUTHORITATIVE rows have `source_hash` / `source_url` / `fetched_at` (Tier 1 CHECK). The extract's `source_hash` ties to `article.source_hash`; `source_url` is derivable (`article.source_url + "#art_N"`). We skip storing `source_url` denormalised on the extract and rely on `article_id` + article row for the URL.

### 9. Cross-check failure mode

When `extractor-crosscheck.ts` finds a mismatch, it prints:

```
MISMATCH: eu-ai-act-penalty-prohibited (maxFineEur=3500000)
  derivedFrom: [eu-ai-act-art-99]
  extracted fine_amount_eur values on derivedFrom articles: [35000000, 15000000, 7500000]
  suggestion: update maxFineEur to 35000000 (extract id #42)
```

Developer has three options:
1. Fix the seed value (most common).
2. If the extract is wrong (e.g., the regex matched a non-penalty EUR figure), widen the regex's exclusion list and re-run the extractor.
3. Mark the penalty row `extract_exempt: true` with a justification — this adds a `penalties.extract_exempt_reason` column and an extract-exempt allowance to the contract. Should be rare.

A fourth option is emphatically NOT supported: silencing the check for a specific row. Every cross-check pass must close cleanly.

## Consequences

### Positive

- Highest-consequence error class (wrong numbers) becomes uncatchable-past-CI.
- New legislation onboarding drops from "seed author hand-types 50+ facts" to "run two commands, CI tells you what's left to curate."
- Cross-references populate automatically, filling the derivation-chain gaps we already know about.
- Extractor + cross-check makes Lexius the first layer in a self-auditing regulation database.
- No LLM cost, no hallucination surface, zero latency impact on reads.

### Negative

- Regex is brittle for prose. A regulation that phrases penalties unusually ("a penalty not exceeding thirty-five million euro") defeats the numeric regex. Mitigation: each extractor logs which articles it scanned and found nothing — reviewers can spot-check.
- CHECK constraint on `provenance_tier = 'AUTHORITATIVE'` means we cannot ever backfill a non-authoritative extract. Intentional, but a future "hand-added extract" use case is blocked. Add a separate table if that becomes necessary.
- Re-extraction on article change does more writes per fetch cycle than today. Negligible at our scale (hundreds of articles per regulation, handful of extracts per article).
- `article_extract_revisions` grows without bound, like `article_revisions`. Pruning strategy deferred.

### Mitigations

- Every extractor module ships with a fixture-based test suite covering at minimum: the positive case, a near-miss that must not match, and a currency/date edge case. Brittleness is caught at unit-test time, not in production.
- The cross-check rule explicitly allows `extract_exempt` for the rare cases the extractor can't handle. This is an escape hatch, not a bypass — it requires an explicit reason stored in the row.
- Running `extract` in dry-run mode before merge lets a developer see exactly what the extractor will write.

## Alternatives Considered

1. **LLM-based extraction.** Rejected for Tier 1 of this work. An LLM can handle prose phrasing and multilingual text the regex can't, but introduces hallucination risk and cost. Defer until the regex coverage is shown to be insufficient with hard evidence. Scoped for a future PRD-009 if needed.
2. **PDF/Akoma-Ntoso extraction.** Rejected; Formex/XHTML from CELLAR is the format we've committed to (ARD-010).
3. **Extract into the existing curated tables directly** (e.g., overwrite `penalties.maxFineEur` with the extracted value). Rejected — destroys the curator's value for audit, prevents cross-check, makes the extractor authoritative by overwrite rather than by reference.
4. **Store extracts as JSON in `articles.extracted_facts`.** Rejected — loses type safety and query-ability; see §2.
5. **Run cross-check as a DB constraint** (e.g., triggers on `penalties` insert/update). Rejected — cross-tier queries via triggers are slow and surprising; a CI step is the right layer.
6. **Run extractor inline with the fetcher, before the article row is committed.** Rejected — sequencing the article write first and then the extract write gives a natural recovery point if extraction fails; also lets us re-run extraction against existing articles without re-fetching.
7. **Embed-and-cluster as a structured-data mining technique.** Rejected — embeddings are continuous, extractors need discrete categorical output with exact values.

## Out of Scope for this ARD

- LLM fallback for unmatchable regex cases.
- UI / review interface for cross-check failures.
- Extraction from recitals, preambles, annexes beyond the P1 list-item support.
- Cross-regulation cross-referencing (e.g., DORA citing GDPR).

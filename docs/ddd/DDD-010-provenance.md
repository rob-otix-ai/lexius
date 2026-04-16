# DDD-010: Provenance Domain, Schema, and Use Cases

## Status: Draft
## Date: 2026-04-16

---

## Overview

Implementation details for PRD-007 / ARD-011 Tier 1 provenance. Covers:

- Postgres enum `provenance_tier` and Drizzle exposure
- Column additions across 6 tables (`articles`, `obligations`, `faq`, `penalties`, `deadlines`, `risk_categories`)
- New `article_revisions` table + triggers
- Domain value objects, repository ports, use cases
- Migration strategy, backfill rules, and rollout order
- Seed authoring ergonomics
- Testing strategy

## Schema Changes

### New enum

```typescript
// packages/db/src/schema/enums.ts (new file)
import { pgEnum } from "drizzle-orm/pg-core";

export const provenanceTier = pgEnum("provenance_tier", [
  "AUTHORITATIVE",
  "CURATED",
  "AI_GENERATED",
]);
```

Re-exported from `packages/db/src/schema/index.ts`.

### Columns added to provenance-bearing tables

All six tables (`articles`, `obligations`, `faq`, `penalties`, `deadlines`, `risk_categories`) receive:

```typescript
provenanceTier: provenanceTier("provenance_tier").notNull(),
sourceUrl: text("source_url"),
sourceHash: varchar("source_hash", { length: 64 }),
fetchedAt: timestamp("fetched_at"),
curatedBy: text("curated_by"),
reviewedAt: timestamp("reviewed_at"),
generatedByModel: text("generated_by_model"),
generatedAt: timestamp("generated_at"),
```

`articles` already has `sourceUrl`, `sourceHash`, `fetchedAt` from PRD-006; the migration does not duplicate them. `faq` already has `sourceUrl`; reuse.

### Derivation chain columns

```typescript
// obligations
derivedFrom: text("derived_from").array().notNull().default([]),

// faq
derivedFrom: text("derived_from").array().notNull().default([]),
```

FAQ's existing `articleReferences: text[]` is copied into `derivedFrom` during migration, then left in place (deprecated, removed in a follow-up migration).

### Table-level CHECK constraints

Generated in the migration SQL (Drizzle does not yet emit CHECK from schema declarations cleanly; written by hand in the `0001_*.sql` file):

```sql
-- Repeated for articles, obligations, faq, penalties, deadlines, risk_categories
ALTER TABLE articles ADD CONSTRAINT articles_provenance_required CHECK (
  (provenance_tier = 'AUTHORITATIVE' AND source_hash IS NOT NULL AND source_url IS NOT NULL AND fetched_at IS NOT NULL)
  OR (provenance_tier = 'CURATED' AND curated_by IS NOT NULL AND reviewed_at IS NOT NULL)
  OR (provenance_tier = 'AI_GENERATED' AND generated_by_model IS NOT NULL AND generated_at IS NOT NULL)
);
```

### `article_revisions` table

```typescript
// packages/db/src/schema/article-revisions.ts
import { pgTable, serial, varchar, text, timestamp, index } from "drizzle-orm/pg-core";
import { articles } from "./articles.js";

export const articleRevisions = pgTable(
  "article_revisions",
  {
    id: serial("id").primaryKey(),
    articleId: varchar("article_id")
      .references(() => articles.id, { onDelete: "cascade" })
      .notNull(),
    sourceHash: varchar("source_hash", { length: 64 }).notNull(),
    sourceUrl: text("source_url"),
    sourceFormat: varchar("source_format", { length: 16 }),
    title: text("title").notNull(),
    fullText: text("full_text").notNull(),
    fetchedAt: timestamp("fetched_at").notNull(),
    supersededAt: timestamp("superseded_at").defaultNow().notNull(),
  },
  (table) => ({
    articleIdIdx: index("article_revisions_article_id_idx").on(
      table.articleId,
      table.supersededAt.desc(),
    ),
  }),
);
```

Exported from `packages/db/src/schema/index.ts`.

### Triggers (written in the migration SQL)

```sql
-- 1. Revision archiving trigger
CREATE OR REPLACE FUNCTION archive_article_revision() RETURNS trigger AS $$
BEGIN
  IF OLD.source_hash IS DISTINCT FROM NEW.source_hash THEN
    INSERT INTO article_revisions
      (article_id, source_hash, source_url, source_format, title, full_text, fetched_at)
    VALUES
      (OLD.id, OLD.source_hash, OLD.source_url, OLD.source_format, OLD.title, OLD.full_text, OLD.fetched_at);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER articles_archive_on_update
  BEFORE UPDATE ON articles
  FOR EACH ROW
  WHEN (OLD.source_hash IS NOT NULL)
  EXECUTE FUNCTION archive_article_revision();

-- 2. derived_from referential integrity trigger
CREATE OR REPLACE FUNCTION validate_derived_from() RETURNS trigger AS $$
DECLARE missing text;
BEGIN
  IF NEW.derived_from IS NOT NULL AND array_length(NEW.derived_from, 1) > 0 THEN
    SELECT a INTO missing
    FROM unnest(NEW.derived_from) a
    WHERE NOT EXISTS (SELECT 1 FROM articles WHERE id = a);
    IF missing IS NOT NULL THEN
      RAISE EXCEPTION 'derived_from references unknown article: %', missing;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER obligations_validate_derived_from
  BEFORE INSERT OR UPDATE OF derived_from ON obligations
  FOR EACH ROW EXECUTE FUNCTION validate_derived_from();

CREATE TRIGGER faq_validate_derived_from
  BEFORE INSERT OR UPDATE OF derived_from ON faq
  FOR EACH ROW EXECUTE FUNCTION validate_derived_from();
```

## Domain Layer

### Value objects

```typescript
// packages/core/src/domain/value-objects/provenance-tier.ts
export const PROVENANCE_TIERS = ["AUTHORITATIVE", "CURATED", "AI_GENERATED"] as const;
export type ProvenanceTier = (typeof PROVENANCE_TIERS)[number];

export function tierRank(tier: ProvenanceTier): number {
  switch (tier) {
    case "AUTHORITATIVE": return 3;
    case "CURATED": return 2;
    case "AI_GENERATED": return 1;
  }
}

export function atLeast(tier: ProvenanceTier, min: ProvenanceTier): boolean {
  return tierRank(tier) >= tierRank(min);
}
```

```typescript
// packages/core/src/domain/value-objects/provenance.ts
import type { ProvenanceTier } from "./provenance-tier.js";

export type Provenance =
  | {
      tier: "AUTHORITATIVE";
      sourceUrl: string;
      sourceHash: string;
      fetchedAt: Date;
      sourceFormat?: string;
    }
  | {
      tier: "CURATED";
      curatedBy: string;
      reviewedAt: Date;
      sourceUrl?: string;
    }
  | {
      tier: "AI_GENERATED";
      generatedByModel: string;
      generatedAt: Date;
    };

export function authoritative(p: Extract<Provenance, { tier: "AUTHORITATIVE" }>): Provenance {
  return { ...p, tier: "AUTHORITATIVE" };
}
export function curated(p: Omit<Extract<Provenance, { tier: "CURATED" }>, "tier">): Provenance {
  return { ...p, tier: "CURATED" };
}
export function aiGenerated(p: Omit<Extract<Provenance, { tier: "AI_GENERATED" }>, "tier">): Provenance {
  return { ...p, tier: "AI_GENERATED" };
}
```

The discriminated union guarantees at compile time that `AUTHORITATIVE` callers supply `sourceHash`, `CURATED` callers supply `curatedBy`, etc. Matches the CHECK constraint.

### Entity: ArticleRevision

```typescript
// packages/core/src/domain/entities/article-revision.ts
export interface ArticleRevision {
  id: number;
  articleId: string;
  sourceHash: string;
  sourceUrl: string | null;
  sourceFormat: string | null;
  title: string;
  fullText: string;
  fetchedAt: Date;
  supersededAt: Date;
}
```

### Existing entities gain provenance fields

Every provenance-bearing entity in `packages/core/src/domain/entities/` gets a `provenance: Provenance` field; `Obligation` and `FAQ` additionally get `derivedFrom: string[]`.

```typescript
// packages/core/src/domain/entities/article.ts
import type { Provenance } from "../value-objects/provenance.js";

export interface Article {
  id: string;
  legislationId: string;
  number: string;
  title: string;
  summary: string;
  fullText: string;
  sourceUrl: string | null;
  relatedAnnexes: string[];
  provenance: Provenance;         // new
}

// packages/core/src/domain/entities/obligation.ts
export interface Obligation {
  // ... existing fields
  derivedFrom: string[];          // new
  provenance: Provenance;         // new
}

// Same addition for faq, penalty, deadline, risk-category.
// Only obligation and faq get derivedFrom in Tier 1.
```

### Ports — new repository plus additions to existing ports

```typescript
// packages/core/src/domain/ports/article-revision.repository.ts
import type { ArticleRevision } from "../entities/article-revision.js";

export interface ArticleRevisionRepository {
  findByArticleId(articleId: string): Promise<ArticleRevision[]>;
}
```

`ArticleRepository` and `ObligationRepository` (in `packages/core/src/domain/ports/repositories.ts`) gain `findById` so the use cases below can look up a row by its compound primary key without decomposing it:

```typescript
export interface ArticleRepository {
  // ...existing
  findById(id: string): Promise<Article | null>;   // new
}

export interface ObligationRepository {
  // ...existing
  findById(id: string): Promise<Obligation | null>; // new
}
```

The Drizzle implementations in `packages/infra/src/repositories.ts` gain matching methods:

```typescript
async findById(id: string): Promise<Article | null> {
  const rows = await this.db.select().from(articles).where(eq(articles.id, id));
  return rows.length > 0 ? toArticle(rows[0]) : null;
}
```

`toArticle` (and the sibling `toObligation`, `toFaq`, etc. mapping functions in `packages/infra/src/repositories.ts`) grow to include the new columns and to build the `Provenance` discriminated union via `rowToProvenance` (see below).

## Use Cases

### GetDerivationChain

```typescript
// packages/core/src/use-cases/get-derivation-chain.ts
import type { ObligationRepository } from "../domain/ports/obligation.repository.js";
import type { ArticleRepository } from "../domain/ports/article.repository.js";
import type { Article } from "../domain/entities/article.js";

export interface DerivationChain {
  obligationId: string;
  sourceArticles: Article[];   // in declaration order
}

export class GetDerivationChain {
  constructor(
    private readonly obligations: ObligationRepository,
    private readonly articles: ArticleRepository,
  ) {}

  async execute(obligationId: string): Promise<DerivationChain> {
    const obligation = await this.obligations.findById(obligationId);
    if (!obligation) throw new Error(`Obligation not found: ${obligationId}`);

    const sourceArticles: Article[] = [];
    for (const articleId of obligation.derivedFrom) {
      const a = await this.articles.findById(articleId);
      if (a) sourceArticles.push(a);
    }

    return { obligationId, sourceArticles };
  }
}
```

### GetArticleHistory

```typescript
// packages/core/src/use-cases/get-article-history.ts
import type { ArticleRepository } from "../domain/ports/article.repository.js";
import type { ArticleRevisionRepository } from "../domain/ports/article-revision.repository.js";

export interface ArticleHistoryEntry {
  sourceHash: string;
  title: string;
  fullText: string;
  fetchedAt: Date;
  supersededAt: Date | null;   // null for current row
}

export class GetArticleHistory {
  constructor(
    private readonly articles: ArticleRepository,
    private readonly revisions: ArticleRevisionRepository,
  ) {}

  async execute(articleId: string): Promise<ArticleHistoryEntry[]> {
    const current = await this.articles.findById(articleId);
    if (!current) throw new Error(`Article not found: ${articleId}`);

    const priors = await this.revisions.findByArticleId(articleId);

    const history: ArticleHistoryEntry[] = [
      {
        sourceHash: current.sourceHash ?? "",
        title: current.title,
        fullText: current.fullText ?? "",
        fetchedAt: current.fetchedAt ?? new Date(0),
        supersededAt: null,
      },
      ...priors.map((r) => ({
        sourceHash: r.sourceHash,
        title: r.title,
        fullText: r.fullText,
        fetchedAt: r.fetchedAt,
        supersededAt: r.supersededAt,
      })),
    ];

    // Newest first (current), then prior revisions by supersededAt desc
    return history;
  }
}
```

## Infrastructure Layer

### Drizzle repository updates

Repository implementations live in `packages/infra/src/repositories.ts` (existing file). The new `DrizzleArticleRevisionRepository` is appended to that file alongside the existing repositories, not placed under `packages/core/src/infrastructure/` (which contains only the plugin registry today).

Repositories map the flat DB columns to the `Provenance` discriminated union:

```typescript
function rowToProvenance(row: {
  provenanceTier: ProvenanceTier;
  sourceUrl: string | null;
  sourceHash: string | null;
  fetchedAt: Date | null;
  curatedBy: string | null;
  reviewedAt: Date | null;
  generatedByModel: string | null;
  generatedAt: Date | null;
}): Provenance {
  switch (row.provenanceTier) {
    case "AUTHORITATIVE":
      return {
        tier: "AUTHORITATIVE",
        sourceUrl: row.sourceUrl!,
        sourceHash: row.sourceHash!,
        fetchedAt: row.fetchedAt!,
      };
    case "CURATED":
      return {
        tier: "CURATED",
        curatedBy: row.curatedBy!,
        reviewedAt: row.reviewedAt!,
        sourceUrl: row.sourceUrl ?? undefined,
      };
    case "AI_GENERATED":
      return {
        tier: "AI_GENERATED",
        generatedByModel: row.generatedByModel!,
        generatedAt: row.generatedAt!,
      };
  }
}
```

The non-null assertions are safe because the CHECK constraint guarantees the fields exist for each tier.

### ArticleRevisionRepository (Drizzle)

```typescript
// packages/infra/src/repositories.ts — appended to the existing file
import { articleRevisions } from "@lexius/db";
import type { ArticleRevision, ArticleRevisionRepository } from "@lexius/core";

export class DrizzleArticleRevisionRepository implements ArticleRevisionRepository {
  constructor(private readonly db: Database) {}

  async findByArticleId(articleId: string): Promise<ArticleRevision[]> {
    const rows = await this.db
      .select()
      .from(articleRevisions)
      .where(eq(articleRevisions.articleId, articleId))
      .orderBy(desc(articleRevisions.supersededAt));

    return rows.map((r) => ({
      id: r.id,
      articleId: r.articleId,
      sourceHash: r.sourceHash,
      sourceUrl: r.sourceUrl,
      sourceFormat: r.sourceFormat,
      title: r.title,
      fullText: r.fullText,
      fetchedAt: r.fetchedAt,
      supersededAt: r.supersededAt,
    }));
  }
}
```

## Fetcher Changes

`packages/fetcher/src/ingest.ts` change in the upsert path:

```typescript
await db.insert(articlesTable)
  .values({
    id: `${legislationId}-art-${art.number}`,
    legislationId,
    number: art.number,
    title: art.title,
    summary: art.body.slice(0, 500),
    fullText: art.body,
    sourceUrl: `${url}#art_${art.number}`,
    sourceHash: art.sourceHash,
    sourceFormat: "xhtml",
    fetchedAt: parsed.fetchedAt,
    provenanceTier: "AUTHORITATIVE",   // new
    verbatim: true,                     // kept for one release (deprecated)
    relatedAnnexes: [],
  })
  .onConflictDoUpdate({
    target: articlesTable.id,
    set: {
      title: art.title,
      summary: art.body.slice(0, 500),
      fullText: art.body,
      sourceHash: art.sourceHash,
      sourceFormat: "xhtml",
      fetchedAt: parsed.fetchedAt,
      provenanceTier: "AUTHORITATIVE",  // new (idempotent)
      verbatim: true,
    },
  });
```

The BEFORE UPDATE trigger archives the prior row if `source_hash` changed. The fetcher does **not** write to `article_revisions` directly.

**Postgres note — `ON CONFLICT DO UPDATE` fires UPDATE triggers.** Drizzle's `onConflictDoUpdate` compiles to `INSERT ... ON CONFLICT ... DO UPDATE SET`, which Postgres treats as an UPDATE on the conflicting row and fires `BEFORE UPDATE` triggers. The trigger's WHEN clause (`OLD.source_hash IS NOT NULL`) additionally skips the first-ever fetch of a seeded row (where OLD had no authoritative hash to archive), matching our design: the prior CURATED paraphrase is not an "authoritative revision" and should not appear in `article_revisions`.

## API / MCP Surfacing

### REST DTO

```typescript
// packages/api/src/dto/provenance.ts
export interface ProvenanceDTO {
  tier: "AUTHORITATIVE" | "CURATED" | "AI_GENERATED";
  sourceUrl: string | null;
  sourceHash: string | null;
  fetchedAt: string | null;
  curatedBy: string | null;
  reviewedAt: string | null;
  generatedByModel: string | null;
  generatedAt: string | null;
}

export interface ObligationResponse {
  id: string;
  legislationId: string;
  role: string;
  riskLevel: string;
  obligation: string;
  article: string | null;
  derivedFrom: string[];
  provenance: ProvenanceDTO;
  // ... other existing fields
}
```

### MCP tools

Response shape for `get_obligation`, `search_obligations`, `get_article`, `get_faq` all gain `provenance` and (where applicable) `derivedFrom`.

New tool `get_article_history(articleId)` returns the output of `GetArticleHistory`.
New tool `get_derivation_chain(obligationId)` returns the output of `GetDerivationChain`.

### Audit report

`ComplianceReport` (existing in `@lexius/core/domain`) gains a per-citation `provenanceTier` field and a top-level `relianceByTier: { AUTHORITATIVE: number; CURATED: number; AI_GENERATED: number }` block rendered at the end of the report.

## Migration Strategy

File: `packages/db/src/migrations/0001_tier_1_provenance.sql` (hand-authored, not Drizzle-generated — CHECK constraints and triggers require manual SQL).

Order:

1. `CREATE TYPE provenance_tier ...`
2. `ALTER TABLE` each provenance-bearing table to add new columns (nullable at first)
3. `CREATE TABLE article_revisions`
4. Backfill:
   - Articles: `UPDATE articles SET provenance_tier = CASE WHEN verbatim THEN 'AUTHORITATIVE' ELSE 'CURATED' END`. For the CURATED branch, also set `curated_by = 'legacy-seed'`, `reviewed_at = created_at`. (AUTHORITATIVE articles already have `source_hash`, `source_url`, `fetched_at` from PRD-006.)
   - Obligations — parse the human-readable `article` field (e.g., `"Art. 9"`, `"Art. 9(2)"`) into a DB article ID and populate `derived_from`:
     ```sql
     UPDATE obligations SET
       provenance_tier = 'CURATED',
       curated_by      = 'legacy-seed',
       reviewed_at     = created_at,
       derived_from    = CASE
         WHEN article IS NULL OR article = '' THEN '{}'::text[]
         ELSE ARRAY[
           legislation_id || '-art-' ||
           lower(regexp_replace(article, '^\s*Art\.?\s*(\d+).*$', '\1'))
         ]
       END;
     ```
     Multi-article references (e.g., `"Art. 9 and Art. 10"`) are rare but present. The migration does a *best-effort* single-article parse; a follow-up data-cleanup PR (tracked as an issue, not blocking) sweeps the remainder. Rows where the regex doesn't match leave `derived_from = '{}'` — still valid under the NOT NULL DEFAULT `[]`.
   - FAQ: `provenance_tier = 'CURATED'`, and copy `article_references` (same transform as above) into `derived_from`. `article_references` is retained for one release.
   - Penalties / deadlines / risk_categories: `provenance_tier = 'CURATED'`, `curated_by = 'legacy-seed'`, `reviewed_at = created_at`. No `derived_from` column on these tables in Tier 1.
5. `ALTER TABLE ... ALTER COLUMN provenance_tier SET NOT NULL`
6. `ADD CONSTRAINT ..._provenance_required CHECK (...)` on all six tables
7. Create the two trigger functions and wire them up
8. Create indexes on `article_revisions`

Rollback: the migration file includes a `DOWN` section that drops triggers, constraints, `article_revisions`, added columns, and the enum type. Tested on a shadow DB before merging.

## Seed Authoring Ergonomics

Seed files currently insert raw objects. After migration, every seed row must include provenance. A helper shipped from `@lexius/db`:

```typescript
// packages/db/src/seeds/helpers/provenance.ts
export const SEED_REVIEWER = "seed:rob";
export function curatedSeedProvenance() {
  return {
    provenanceTier: "CURATED" as const,
    curatedBy: SEED_REVIEWER,
    reviewedAt: new Date(),
  };
}
export function aiSeedProvenance(model: string) {
  return {
    provenanceTier: "AI_GENERATED" as const,
    generatedByModel: model,
    generatedAt: new Date(),
  };
}
```

Seed files use `{ ...curatedSeedProvenance(), ...row }`. The Specflow contract requires seed files to spread one of these helpers (pattern match).

## Testing Strategy

### Unit
- `ProvenanceTier` rank and `atLeast` comparisons
- `Provenance` discriminated union narrowing
- `GetDerivationChain` with 0, 1, and N source articles
- `GetArticleHistory` with 0 and N revisions, ordering correctness

### Integration (test DB)
- Insert `AUTHORITATIVE` row without `source_hash` → CHECK violation
- Insert `CURATED` row without `curated_by` → CHECK violation
- Insert `AI_GENERATED` row without `generated_by_model` → CHECK violation
- Update `articles.source_hash` → row appears in `article_revisions`
- Update `articles` field other than `source_hash` → no revision row created
- Insert obligation with `derived_from = ['nonexistent-article']` → trigger raises
- End-to-end fetcher run against fixture with two versions of the same regulation → one `articles` row, one `article_revisions` row, both retrievable via `GetArticleHistory`

### Contract
- `tests/contracts/feature_provenance.yml` enforces:
  - Seed files use `curatedSeedProvenance()` or `aiSeedProvenance()` helpers
  - Fetcher sets `provenanceTier: "AUTHORITATIVE"` on every insert
  - `article_revisions` has no `UPDATE` or `DELETE` statements in application code
  - API DTOs include `provenance` field on provenance-bearing responses

## Rollout Order

1. Land schema migration + Drizzle schema + domain value objects (no consumers depend yet).
2. Update fetcher to set `provenanceTier`.
3. Update seed helpers and convert existing seeds.
4. Update use cases, repositories, API DTOs, MCP tool responses.
5. Update `GenerateAuditReport` to include `relianceByTier`.
6. Add Specflow contract; run CI.
7. Merge. Run fetcher. Verify every row has a tier.

Each step is a mergeable PR. Step 1 is feature-flagged behind not-yet-consumed columns; steps 2-5 progressively use them; step 6 locks them down.

## Open Questions (not blocking)

- Pruning `article_revisions` after N years — revisit in Tier 2 when we have retention requirements.
- Surfacing tier in embedding search results — current semantic search returns unweighted matches; a follow-up can down-weight `AI_GENERATED` results.
- Tier for `legislations` table itself — deferred; the legislation row is metadata, not a quoted fact.

# DDD-011: Deterministic Extractor — Implementation

## Status: Draft
## Date: 2026-04-16

---

## Overview

Implementation details for PRD-008 / ARD-012. The extractor lives inside `@lexius/fetcher`, writes to two new tables (`article_extracts`, `article_extract_revisions`), exposes a new CLI subcommand, and ships a cross-check script that wires into CI via Specflow.

## Package Structure (additions)

```
packages/fetcher/src/
├── cellar-client.ts             # unchanged
├── cli.ts                        # adds `extract` and `backfill-derivation` subcommands
├── ingest.ts                     # orchestrates both fetch-and-extract
├── parsers/
│   └── xhtml-parser.ts           # unchanged
├── extractors/                   # NEW
│   ├── index.ts                  # registry + runAllExtractors()
│   ├── types.ts                  # ParsedExtract, ExtractorFn
│   ├── fine-amount.ts
│   ├── turnover-percentage.ts
│   ├── date.ts
│   ├── article-cross-ref.ts
│   ├── annex-cross-ref.ts
│   └── shall-clause.ts
├── extract-runner.ts             # orchestrates: read article → runAllExtractors → diff → upsert
└── __tests__/
    └── extractors/
        ├── fine-amount.test.ts
        ├── date.test.ts
        └── … (one per extractor)
```

## Schema Changes

### New enum `extract_type`

```typescript
// packages/db/src/schema/enums.ts
export const extractType = pgEnum("extract_type", [
  "fine_amount_eur",
  "turnover_percentage",
  "date",
  "article_cross_ref",
  "annex_cross_ref",
  "shall_clause",
  "annex_item",
]);
```

### `article_extracts`

```typescript
// packages/db/src/schema/article-extracts.ts
import {
  pgTable, serial, varchar, text, timestamp, index, uniqueIndex, numeric,
} from "drizzle-orm/pg-core";
import { articles } from "./articles.js";
import { provenanceTier, extractType } from "./enums.js";

export const articleExtracts = pgTable(
  "article_extracts",
  {
    id: serial("id").primaryKey(),
    articleId: varchar("article_id")
      .references(() => articles.id, { onDelete: "cascade" })
      .notNull(),
    extractType: extractType("extract_type").notNull(),
    valueNumeric: numeric("value_numeric", { precision: 20, scale: 2 }),
    valueText: text("value_text"),
    valueDate: timestamp("value_date"),
    paragraphRef: text("paragraph_ref").notNull().default(""),
    verbatimExcerpt: text("verbatim_excerpt").notNull(),
    valueHash: varchar("value_hash", { length: 64 }).notNull(),
    provenanceTier: provenanceTier("provenance_tier").notNull().default("AUTHORITATIVE"),
    sourceHash: varchar("source_hash", { length: 64 }).notNull(),
    extractedAt: timestamp("extracted_at").defaultNow().notNull(),
  },
  (table) => ({
    articleTypeIdx: index("article_extracts_article_type_idx").on(
      table.articleId, table.extractType,
    ),
    sourceHashIdx: index("article_extracts_source_hash_idx").on(table.sourceHash),
    naturalKey: uniqueIndex("article_extracts_natural_key").on(
      table.articleId, table.extractType, table.paragraphRef, table.valueHash,
    ),
  }),
);
```

### `article_extract_revisions`

Mirrors `article_revisions`. Populated by trigger on UPDATE or DELETE of `article_extracts` when `source_hash` differs.

### Migration SQL additions (`0002_extractor.sql`, hand-authored)

```sql
CREATE TYPE extract_type AS ENUM (
  'fine_amount_eur', 'turnover_percentage', 'date',
  'article_cross_ref', 'annex_cross_ref', 'shall_clause', 'annex_item'
);

CREATE TABLE article_extracts ( ... as above ... );

ALTER TABLE article_extracts
  ADD CONSTRAINT article_extracts_provenance_authoritative
  CHECK (provenance_tier = 'AUTHORITATIVE');

ALTER TABLE article_extracts
  ADD CONSTRAINT article_extracts_value_present
  CHECK (value_numeric IS NOT NULL OR value_text IS NOT NULL OR value_date IS NOT NULL);

CREATE TABLE article_extract_revisions ( ... );

CREATE OR REPLACE FUNCTION archive_article_extract_revision() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' OR OLD.source_hash IS DISTINCT FROM NEW.source_hash THEN
    INSERT INTO article_extract_revisions
      (extract_id, article_id, extract_type, value_numeric, value_text, value_date,
       paragraph_ref, verbatim_excerpt, source_hash, extracted_at)
    VALUES
      (OLD.id, OLD.article_id, OLD.extract_type, OLD.value_numeric, OLD.value_text, OLD.value_date,
       OLD.paragraph_ref, OLD.verbatim_excerpt, OLD.source_hash, OLD.extracted_at);
  END IF;
  RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER article_extracts_archive_on_change
  BEFORE UPDATE OR DELETE ON article_extracts
  FOR EACH ROW EXECUTE FUNCTION archive_article_extract_revision();
```

### Table additions on `penalties`

Penalties didn't get `derived_from` in Tier 1 (PRD-007 scoped it to obligations + FAQ). The extractor cross-check needs it, so this migration adds both the derivation chain and the exemption pair:

```typescript
// packages/db/src/schema/penalties.ts
// add:
derivedFrom: text("derived_from").array().notNull().default([]),
extractExempt: boolean("extract_exempt").default(false).notNull(),
extractExemptReason: text("extract_exempt_reason"),
```

Migration SQL adds the column, backfills `derived_from` from the existing `article` column using the same `regexp_replace` transform Tier 1 used for obligations (`"Art. 99(3)"` → `["eu-ai-act-art-99"]`), and installs the `validate_derived_from` trigger on penalties (same function Tier 1 defined, new trigger).

Constraints:

```sql
ALTER TABLE penalties
  ADD CONSTRAINT penalties_extract_exempt_has_reason
  CHECK (NOT extract_exempt OR extract_exempt_reason IS NOT NULL);

CREATE TRIGGER penalties_validate_derived_from
  BEFORE INSERT OR UPDATE OF derived_from ON penalties
  FOR EACH ROW EXECUTE FUNCTION validate_derived_from();
```

Analogous changes are **not** applied to `deadlines` in this release — the deadline cross-check is deferred until the extractor has evidence it can match dates reliably in production. When deadlines joins, it inherits the same three-column addition + trigger.

### Domain entity + port updates

`Penalty` entity gains `derivedFrom`, `extractExempt`, `extractExemptReason` fields; the Drizzle `toPenalty` mapper in `packages/infra/src/repositories.ts` populates them. The `API/MCP` DTO helpers (`toPenaltyDTO` in `packages/api/src/dto/entities.ts`) surface `derivedFrom` alongside the existing `provenance` field.

New entity:

```typescript
// packages/core/src/domain/entities/article-extract.ts
// (content per DDD-011 §"Domain Entities" below)
```

New port:

```typescript
// packages/core/src/domain/ports/article-extract.repository.ts
// (content per DDD-011 §"Domain Entities" below)
```

Both re-exported from `packages/core/src/domain/entities/index.ts` and `packages/core/src/domain/ports/index.ts` respectively. The new `extractType` pgEnum and `articleExtracts` + `articleExtractRevisions` tables are re-exported from `packages/db/src/schema/index.ts`.

## Core Types

```typescript
// packages/fetcher/src/extractors/types.ts
import type { ExtractType } from "@lexius/db";

export interface ParsedExtract {
  articleId: string;
  extractType: ExtractType;
  valueNumeric?: string;    // numeric as string for precision
  valueText?: string;
  valueDate?: Date;
  paragraphRef: string;
  verbatimExcerpt: string;
  valueHash: string;        // sha256 of normalised value
}

export type ExtractorFn = (
  text: string,
  articleId: string,
  legislationId: string,
) => ParsedExtract[];
```

## Extractor Modules

### Pattern

Each module exports:
- A private regex or set of regexes.
- A private helper to canonicalise the matched value.
- An exported `extract` function matching `ExtractorFn`.
- (If relevant) an exported `skipMarkers: string[]` — phrases whose presence in the surrounding sentence disqualifies a match (to avoid false positives).

### `fine-amount.ts`

```typescript
// Matches "EUR X,XXX,XXX" or "€X million" within a sentence that also contains
// "fine" / "penalty" / "administrative". Excludes explicit non-penalty EUR figures
// (e.g., "turnover exceeding EUR 50 million" when the sentence is about scope).
const FINE_CONTEXT = /(fine|penalty|penalties|administrative)/i;
const EUR_AMOUNT = /(?:EUR|€)\s*([\d]+(?:[\s,\.][\d]+)*)\s*(million|m)?/gi;
const EXCLUDES = /(turnover|threshold|worth)/i;

export function extract(text: string, articleId: string, legislationId: string): ParsedExtract[] {
  const results: ParsedExtract[] = [];
  for (const sentence of splitSentences(text)) {
    if (!FINE_CONTEXT.test(sentence)) continue;
    if (EXCLUDES.test(sentence)) continue;
    for (const match of sentence.matchAll(EUR_AMOUNT)) {
      const normalised = normaliseEur(match[1], match[2]);
      if (normalised === null) continue;
      results.push({
        articleId,
        extractType: "fine_amount_eur",
        valueNumeric: normalised.toString(),
        paragraphRef: inferParagraphRef(text, sentence),
        verbatimExcerpt: sentence.trim(),
        valueHash: sha256(`fine_amount_eur:${normalised}`),
      });
    }
  }
  return results;
}
```

`normaliseEur` handles "35,000,000" → 35000000, "35 million" → 35000000, "7.5 million" → 7500000.

### `turnover-percentage.ts`

Similar pattern. Regex: `(\d+(?:\.\d+)?)\s*%` scoped to sentences mentioning "turnover" and "fine"/"penalty".

### `date.ts`

Regexes for:
- `\b([12]?\d|3[01])\s+(January|February|…|December)\s+(\d{4})\b`
- `\b(\d{4})-(\d{2})-(\d{2})\b`

No context filter — every date in the article is extractable. Paragraph ref inferred from surrounding markup.

### `article-cross-ref.ts`

Regex patterns (case-insensitive):
- `(?:referred to in|under|pursuant to|as set out in|in accordance with)\s+Article\s+(\d+)(?:\(\d+\))?`
- `Article\s+(\d+)` in isolation — but scoped to sentences not starting the article itself (to avoid matching the article's own heading).

Emits `value_text = <legislationId>-art-<N>`. If the cited article doesn't exist in the DB, still emit — the cross-check layer will log a warning, but empty derivation is better than a missed link.

### `annex-cross-ref.ts`

`Annex\s+([IVXL]+)(?:\s+point\s+(\d+))?`. Emits `value_text = <legislationId>-annex-<roman>[-point-N]`.

### `shall-clause.ts`

Walks sentences; identifies any containing ` shall ` / ` must ` / ` shall not ` / ` may not ` as a main verb (heuristic: not inside a subordinate clause starting with "which", "where", "if"). Emits one row per sentence with:

- `value_text = <the full sentence>`
- `paragraphRef = <paragraph number from the article structure>`
- A `subject_hint` embedded in `verbatim_excerpt` as the first 30 chars (used by P1 obligation matching).

### Registry

```typescript
// packages/fetcher/src/extractors/index.ts
import { extract as fineAmount } from "./fine-amount.js";
import { extract as turnoverPct } from "./turnover-percentage.js";
import { extract as date } from "./date.js";
import { extract as articleRef } from "./article-cross-ref.js";
import { extract as annexRef } from "./annex-cross-ref.js";
import { extract as shallClause } from "./shall-clause.js";

const EXTRACTORS = [fineAmount, turnoverPct, date, articleRef, annexRef, shallClause];

export function runAllExtractors(
  text: string, articleId: string, legislationId: string,
): ParsedExtract[] {
  return EXTRACTORS.flatMap((fn) => fn(text, articleId, legislationId));
}
```

Single list, easy to add new extractors. Each extractor is independently testable.

## Orchestrator: `extract-runner.ts`

```typescript
import { and, eq, inArray } from "drizzle-orm";
import { articleExtracts, articles } from "@lexius/db";
import type { Database } from "@lexius/db";
import { runAllExtractors } from "./extractors/index.js";

export interface ExtractResult {
  articleId: string;
  extractsAdded: number;
  extractsUnchanged: number;
  extractsRemoved: number;
}

export async function extractArticle(
  db: Database,
  articleId: string,
  legislationId: string,
): Promise<ExtractResult> {
  const [article] = await db.select().from(articles).where(eq(articles.id, articleId));
  if (!article || !article.fullText || !article.sourceHash) {
    throw new Error(`Article ${articleId} not found or has no source hash`);
  }

  const expected = runAllExtractors(article.fullText, articleId, legislationId);
  const existing = await db
    .select()
    .from(articleExtracts)
    .where(eq(articleExtracts.articleId, articleId));

  const existingKeys = new Set(existing.map(keyOf));
  const expectedKeys = new Set(expected.map(keyOf));

  const toInsert = expected.filter((e) => !existingKeys.has(keyOf(e)));
  const toDelete = existing.filter((e) => !expectedKeys.has(keyOf(e)));

  await db.transaction(async (tx) => {
    if (toDelete.length) {
      await tx.delete(articleExtracts).where(
        inArray(articleExtracts.id, toDelete.map((e) => e.id))
      );
    }
    if (toInsert.length) {
      await tx.insert(articleExtracts).values(
        toInsert.map((e) => ({
          articleId: e.articleId,
          extractType: e.extractType,
          valueNumeric: e.valueNumeric,
          valueText: e.valueText,
          valueDate: e.valueDate,
          paragraphRef: e.paragraphRef,
          verbatimExcerpt: e.verbatimExcerpt,
          valueHash: e.valueHash,
          sourceHash: article.sourceHash!,
          // provenanceTier defaults to AUTHORITATIVE
        })),
      );
    }
  });

  return {
    articleId,
    extractsAdded: toInsert.length,
    extractsUnchanged: existing.length - toDelete.length,
    extractsRemoved: toDelete.length,
  };
}

function keyOf(e: { extractType: string; paragraphRef: string; valueHash: string }): string {
  return `${e.extractType}|${e.paragraphRef}|${e.valueHash}`;
}

export async function extractLegislation(
  db: Database,
  legislationId: string,
): Promise<ExtractResult[]> {
  const all = await db
    .select({ id: articles.id })
    .from(articles)
    .where(eq(articles.legislationId, legislationId));
  const results: ExtractResult[] = [];
  for (const { id } of all) {
    results.push(await extractArticle(db, id, legislationId));
  }
  return results;
}
```

## CLI

```typescript
// packages/fetcher/src/cli.ts (addition)
program
  .command("extract")
  .description("Run deterministic extractor over articles in the DB")
  .option("--legislation <id>", "Legislation ID (e.g., eu-ai-act)")
  .option("--article <id>", "Single article ID (overrides --legislation)")
  .option("--dry-run", "Log what would change without writing")
  .action(async (options) => {
    const { db, pool } = createDb(process.env.DATABASE_URL!);
    try {
      if (options.article) {
        const result = await extractArticle(db, options.article, inferLegislationId(options.article));
        logger.info(result, "Extract complete");
      } else if (options.legislation) {
        const results = await extractLegislation(db, options.legislation);
        logger.info(summarise(results), "Extract complete");
      } else {
        throw new Error("--legislation or --article required");
      }
    } finally {
      await pool.end();
    }
  });

program
  .command("backfill-derivation")
  .description("Propose derivedFrom additions based on article cross-refs")
  .option("--legislation <id>", "Legislation ID")
  .option("--dry-run", "Print suggestions without writing", true)
  .option("--apply", "Actually write the suggestions")
  .action(async (options) => {
    // Queries article_extracts.article_cross_ref rows, joins with curated rows
    // whose derivedFrom does not yet include the referenced article.
    // In --dry-run: print. In --apply: UPDATE obligations/faq.
  });
```

The `ingest` subcommand gains an implicit `extract` pass at the end: `lexius-fetch ingest --celex X --legislation Y` fetches articles and immediately runs the extractor. A `--no-extract` flag skips.

## Cross-Check Script

```typescript
// scripts/extractor-crosscheck.ts
import { eq, sql } from "drizzle-orm";
import { createDb } from "@lexius/db";
import { articleExtracts, penalties } from "@lexius/db";

export interface Mismatch {
  kind: "penalty_fine_mismatch" | "penalty_turnover_mismatch";
  rowId: string;
  expectedValue: string;
  extractedValues: string[];
  derivedFrom: string[];
  suggestion?: string;
}

export async function runCrossCheck(databaseUrl: string): Promise<Mismatch[]> {
  const { db, pool } = createDb(databaseUrl);
  try {
    const mismatches: Mismatch[] = [];

    const rows = await db.select().from(penalties);
    for (const p of rows) {
      if (p.extractExempt) continue;
      if (!p.derivedFrom.length) continue;

      // Check fine amount
      if (p.maxFineEur) {
        const extracts = await db
          .select()
          .from(articleExtracts)
          .where(sql`
            article_id = ANY(${p.derivedFrom}::text[])
            AND extract_type = 'fine_amount_eur'
          `);
        const extractedValues = extracts.map((e) => e.valueNumeric!);
        if (!extractedValues.includes(p.maxFineEur)) {
          mismatches.push({
            kind: "penalty_fine_mismatch",
            rowId: p.id,
            expectedValue: p.maxFineEur,
            extractedValues,
            derivedFrom: p.derivedFrom,
            suggestion: extractedValues[0],
          });
        }
      }

      // Similar check for turnover
    }
    return mismatches;
  } finally {
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const mismatches = await runCrossCheck(process.env.DATABASE_URL!);
  if (mismatches.length) {
    console.error(`EXTRACTOR CROSS-CHECK FAILED: ${mismatches.length} mismatch(es)\n`);
    for (const m of mismatches) {
      console.error(`  ${m.kind} ${m.rowId}`);
      console.error(`    value: ${m.expectedValue}`);
      console.error(`    extracted: ${m.extractedValues.join(", ")}`);
      console.error(`    derivedFrom: ${m.derivedFrom.join(", ")}`);
      if (m.suggestion) console.error(`    suggestion: ${m.suggestion}`);
      console.error();
    }
    process.exit(1);
  }
  console.log("Extractor cross-check: clean.");
}
```

Wired into `.github/workflows/ci.yml` as a new step after `Build`:

```yaml
- name: Extractor cross-check
  run: tsx scripts/extractor-crosscheck.ts
  env:
    DATABASE_URL: postgresql://legal_ai:testpassword@localhost:5432/legal_ai_test
```

(Requires the CI DB to be migrated and seeded, which happens in the `E2E tests` step today — the step order needs adjusting so seed runs before cross-check. Migration PR.)

## Domain Entities

For the API / MCP surface:

```typescript
// packages/core/src/domain/entities/article-extract.ts
export interface ArticleExtract {
  id: number;
  articleId: string;
  extractType:
    | "fine_amount_eur" | "turnover_percentage" | "date"
    | "article_cross_ref" | "annex_cross_ref" | "shall_clause" | "annex_item";
  valueNumeric: string | null;
  valueText: string | null;
  valueDate: Date | null;
  paragraphRef: string;
  verbatimExcerpt: string;
  sourceHash: string;
  extractedAt: Date;
}
```

New port:

```typescript
// packages/core/src/domain/ports/article-extract.repository.ts
export interface ArticleExtractRepository {
  findByArticleId(articleId: string): Promise<ArticleExtract[]>;
  findByArticleAndType(articleId: string, type: ExtractType): Promise<ArticleExtract[]>;
}
```

New use case `GetArticleExtracts(articleId)` — thin wrapper, added later if API consumers need it. Not P0 for the extractor itself.

## API / MCP Surfacing

Extracts surface as a child collection on articles. Extending `GET /articles/:id` or adding `GET /articles/:id/extracts`. The shape:

```json
{
  "articleId": "eu-ai-act-art-99",
  "extracts": [
    {
      "id": 42,
      "extractType": "fine_amount_eur",
      "value": 35000000,
      "paragraphRef": "3",
      "verbatimExcerpt": "…an administrative fine of up to EUR 35,000,000…",
      "sourceHash": "abc123…"
    }
  ]
}
```

MCP tool `legalai_get_article_extracts({ articleId })` follows the pattern from Tier 1's two new tools.

Deferred to a follow-up PR: returning extract refs on penalty/obligation DTOs ("this penalty's `maxFineEur: 35000000` is backed by extract #42 on `eu-ai-act-art-99` paragraph 3").

## Rollout

1. Schema migration `0002_extractor.sql` + Drizzle schema file.
2. Extractor modules + unit tests (one PR per extractor type or all at once — author's choice; each module is small).
3. `extract-runner.ts` + CLI subcommand.
4. Run against EU AI Act + DORA; hand-verify counts match expected. Document baseline in a follow-up.
5. Cross-check script + CI wiring.
6. Domain entity + repo + optional API/MCP surfacing.
7. Backfill-derivation CLI + run against the 6 EU AI Act FAQ rows.

Each step merges independently. Cross-check (step 5) is the gate that locks in the safety property — before that PR, a developer can still introduce a seed typo undetected.

## Testing Strategy

### Unit

- Per extractor module: fixture test with (a) positive match, (b) near-miss that must not match, (c) edge cases (decimal values, million vs explicit, compound sentences).
- `runAllExtractors` composition: no cross-interference.
- `extract-runner` idempotency: running twice on the same article yields zero writes.

### Integration

- Full extractor run on EU AI Act Art. 99 fixture. Assert exactly 3 × `fine_amount_eur` rows (35M / 15M / 7.5M), exactly 3 × `turnover_percentage` (7 / 3 / 1.5).
- Full extractor run on EU AI Act Art. 113. Assert the application date rows.
- Update an article's `full_text` + `source_hash`; re-run extractor; assert old extracts archive to `article_extract_revisions`.

### Cross-check

- Adversarial test: seed a penalty row with a wrong `maxFineEur`; run cross-check; assert it fails with the expected message.
- Allow-list test: mark a row `extract_exempt: true` with a reason; assert cross-check passes.
- Missing-extract test: penalty with `derivedFrom` pointing at an article that has no `fine_amount_eur` extract; assert cross-check flags as missing (not mismatch).

### Contract

`tests/contracts/extractor_determinism.yml` (next section) enforces the code-level rules.

## Open Questions (non-blocking)

- Pruning `article_extract_revisions` — deferred with `article_revisions`.
- Whether to extract from recitals (explanatory text before articles). Not in this release.
- Multilingual extractors — when we add non-English CELLAR fetches, each extractor needs a language-specific regex. Design is extensible; today's modules assume English.

## Specflow contract (lands with implementation PR)

This contract is the enforcement hook for the invariants above. It is NOT shipped in `tests/contracts/` yet, because some rules (EXTRACT-005 in particular) describe a post-rollout state — seeded penalty rows don't yet carry `derivedFrom`. Dropping the file now would fail CI against a codebase that hasn't had the chance to comply.

The rollout PR that lands `0002_extractor.sql` + extractor modules + the penalty schema additions should also create `tests/contracts/extractor_determinism.yml` with the content below, and at that point all rules are enforceable simultaneously.

```yaml
contract_meta:
  id: extractor_determinism
  version: 1
  created_from_spec: "PRD-008 / ARD-012 / DDD-011 — deterministic extractor must be pure, authoritative-only, and CI-cross-checked"
  covers_reqs:
    - EXTRACT-001
    - EXTRACT-002
    - EXTRACT-003
    - EXTRACT-004
    - EXTRACT-005
    - EXTRACT-006
  owner: "legal-ai-team"

llm_policy:
  enforce: true
  llm_may_modify_non_negotiables: false
  override_phrase: "override_contract: extractor_determinism"

rules:
  non_negotiable:
    - id: EXTRACT-001
      title: "Extractor modules must be pure — no LLM, no network, no DB"
      scope:
        - "packages/fetcher/src/extractors/**/*.{ts,js}"
      behavior:
        forbidden_patterns:
          - pattern: /from\s+['"](?:@anthropic-ai\/sdk|openai|@modelcontextprotocol)/
            message: "Extractor modules must not import any LLM SDK — deterministic parsing only"
          - pattern: /\bfetch\s*\(|from\s+['"]node:https?|from\s+['"]axios|from\s+['"]undici/
            message: "Extractor modules must not perform network I/O — they operate on already-fetched text"
          - pattern: /from\s+['"]drizzle-orm|from\s+['"]pg|from\s+['"]@lexius\/db/
            message: "Extractor modules must be pure functions — DB access belongs in extract-runner.ts, not the modules"
          - pattern: /from\s+['"]@lexius\/core/
            message: "Extractor modules are pure infrastructure — no domain imports"

    - id: EXTRACT-002
      title: "Extractor modules must be synchronous — no Promises, no async"
      scope:
        - "packages/fetcher/src/extractors/**/*.{ts,js}"
      behavior:
        forbidden_patterns:
          - pattern: /\bexport\s+async\s+function\s+extract/
            message: "Extractor functions must be synchronous — purity rules out anything async"
          - pattern: /await\s+/
            message: "Extractor modules may not use await — they operate on in-memory text"

    - id: EXTRACT-003
      title: "article_extracts writes must set AUTHORITATIVE tier and source_hash"
      scope:
        - "packages/fetcher/src/extract-runner.{ts,js}"
      behavior:
        required_patterns:
          - pattern: /articleExtracts/
            message: "extract-runner must write to articleExtracts table"
          - pattern: /sourceHash\s*[:=]/
            message: "Every extract must record the source_hash of the article at extraction time"
        forbidden_patterns:
          - pattern: /provenanceTier\s*:\s*["'](?:CURATED|AI_GENERATED)["']/
            message: "Extracts are always AUTHORITATIVE — the DB CHECK constraint also enforces this; do not try to bypass"

    - id: EXTRACT-004
      title: "Application code must not mutate or delete article_extract_revisions"
      scope:
        - "packages/**/*.{ts,js}"
      behavior:
        forbidden_patterns:
          - pattern: /\.update\s*\(\s*articleExtractRevisions\s*\)/
            message: "article_extract_revisions is append-only; revisions are produced by the DB trigger"
          - pattern: /\.delete\s*\(\s*articleExtractRevisions\s*\)/
            message: "article_extract_revisions is append-only; deletion is not permitted in application code"

    - id: EXTRACT-005
      title: "Penalty rows must provide derivedFrom and either match an extract or declare exempt"
      scope:
        - "packages/db/src/seeds/*/penalties.{ts,js}"
      behavior:
        required_patterns:
          - pattern: /derivedFrom\s*:\s*\[/
            message: "Every seeded penalty row must declare a derivedFrom array (may be empty only with extract_exempt: true)"
        forbidden_patterns:
          - pattern: /extractExempt\s*:\s*true(?![\s\S]{0,200}extractExemptReason)/
            message: "If extract_exempt is true, extractExemptReason must be set on the same row"

    - id: EXTRACT-006
      title: "Cross-check script is the only SQL-issuing surface outside extract-runner"
      scope:
        - "scripts/extractor-crosscheck.{ts,js}"
      behavior:
        required_patterns:
          - pattern: /articleExtracts/
            message: "Cross-check script must query the articleExtracts table"
          - pattern: /process\.exit\s*\(\s*1\s*\)/
            message: "Cross-check script must exit non-zero on mismatch so CI fails"
```

# DDD-009: EUR-Lex Fetcher Implementation

## Status: Draft
## Date: 2026-04-16

---

## Overview

Implementation details for `@lexius/fetcher`. It wraps CELLAR REST, parses XHTML, writes verbatim article text to the DB with provenance.

## Package Structure

```
packages/fetcher/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts                 # Public API
    ├── cli.ts                   # lexius-fetch entry point
    ├── cellar-client.ts         # HTTP client for publications.europa.eu
    ├── parsers/
    │   ├── xhtml-parser.ts     # Parse XHTML → article records
    │   └── types.ts             # ParsedArticle, ParsedRegulation
    ├── ingest.ts                # Orchestration: fetch → parse → upsert
    └── logger.ts
```

## Core Types

```typescript
export interface ParsedArticle {
  number: string;      // e.g., "5" or "annex-iii-1"
  title: string;
  body: string;        // verbatim paragraphs, separated by \n\n
  sourceHash: string;  // SHA-256 of body
}

export interface ParsedRegulation {
  celex: string;
  legislationId: string;
  sourceUrl: string;
  sourceFormat: "xhtml" | "fmx4";
  articles: ParsedArticle[];
  fetchedAt: Date;
}

export interface IngestOptions {
  celex: string;
  legislationId: string;
  dryRun?: boolean;
}

export interface IngestResult {
  celex: string;
  articlesUpdated: number;
  articlesUnchanged: number;
  articlesFailed: number;
  errors: string[];
}
```

## CellarClient

```typescript
export class CellarClient {
  constructor(private readonly userAgent = "lexius-fetcher/0.1") {}

  async fetchXhtml(celex: string): Promise<{ html: string; url: string }> {
    const url = `https://publications.europa.eu/resource/celex/${celex}`;
    const response = await fetch(url, {
      headers: {
        "Accept": "application/xhtml+xml",
        "Accept-Language": "eng",
        "User-Agent": this.userAgent,
      },
      redirect: "follow",
    });

    if (!response.ok) {
      throw new Error(`CELLAR returned ${response.status} for ${celex}`);
    }

    return { html: await response.text(), url: response.url };
  }
}
```

## XhtmlParser

Extract articles using cheerio:

```typescript
import { load } from "cheerio";
import { createHash } from "crypto";

export function parseXhtml(html: string, celex: string, legislationId: string): ParsedRegulation {
  const $ = load(html);
  const articles: ParsedArticle[] = [];

  $("p.oj-ti-art").each((_i, el) => {
    const titleEl = $(el);
    const titleText = titleEl.text().trim();            // "Article 5"
    const match = titleText.match(/Article\s+(\d+)/i);
    if (!match) return;
    const number = match[1];

    // Next sibling with class oj-sti-art is the title
    const subTitle = titleEl.nextAll("p.oj-sti-art").first().text().trim();

    // Body: everything until the next oj-ti-art or end of section
    const bodyParts: string[] = [];
    let current = titleEl.next();
    while (current.length && !current.hasClass("oj-ti-art")) {
      const text = current.text().trim();
      if (text) bodyParts.push(text);
      current = current.next();
    }

    const body = bodyParts.join("\n\n");
    const hash = createHash("sha256").update(body).digest("hex");

    articles.push({
      number,
      title: subTitle || titleText,
      body,
      sourceHash: hash,
    });
  });

  return {
    celex,
    legislationId,
    sourceUrl: `https://publications.europa.eu/resource/celex/${celex}`,
    sourceFormat: "xhtml",
    articles,
    fetchedAt: new Date(),
  };
}
```

## Ingestion

```typescript
import { articles as articlesTable } from "@lexius/db";
import { eq, and } from "drizzle-orm";

export async function ingest(
  db: Database,
  options: IngestOptions,
  client: CellarClient,
): Promise<IngestResult> {
  const { celex, legislationId, dryRun } = options;

  const { html, url } = await client.fetchXhtml(celex);
  const parsed = parseXhtml(html, celex, legislationId);

  const result: IngestResult = {
    celex,
    articlesUpdated: 0,
    articlesUnchanged: 0,
    articlesFailed: 0,
    errors: [],
  };

  for (const art of parsed.articles) {
    try {
      const existing = await db
        .select()
        .from(articlesTable)
        .where(and(eq(articlesTable.legislationId, legislationId), eq(articlesTable.number, art.number)))
        .limit(1);

      if (existing[0] && existing[0].sourceHash === art.sourceHash) {
        result.articlesUnchanged++;
        continue;
      }

      if (!dryRun) {
        await db.insert(articlesTable)
          .values({
            id: `${legislationId}-art-${art.number}`,
            legislationId,
            number: art.number,
            title: art.title,
            summary: art.body.slice(0, 500),   // first 500 chars as summary
            fullText: art.body,
            sourceUrl: `${url}#art_${art.number}`,
            sourceHash: art.sourceHash,
            sourceFormat: "xhtml",
            fetchedAt: parsed.fetchedAt,
            verbatim: true,
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
              verbatim: true,
            },
          });
      }

      result.articlesUpdated++;
    } catch (err) {
      result.articlesFailed++;
      result.errors.push(`Article ${art.number}: ${(err as Error).message}`);
    }
  }

  return result;
}
```

## CLI

```typescript
#!/usr/bin/env node
import { Command } from "commander";
import { createDb } from "@lexius/db";
import { CellarClient } from "./cellar-client.js";
import { ingest } from "./ingest.js";
import { logger } from "./logger.js";

const program = new Command();
program
  .name("lexius-fetch")
  .description("Fetch regulation text from EUR-Lex CELLAR")
  .requiredOption("--celex <celex>", "CELEX number (e.g., 32024R1689)")
  .requiredOption("--legislation <id>", "Legislation ID in DB (e.g., eu-ai-act)")
  .option("--dry-run", "Fetch and parse but don't write")
  .action(async (options) => {
    const { db, pool } = createDb(process.env.DATABASE_URL!);
    try {
      const client = new CellarClient();
      logger.info({ celex: options.celex, legislation: options.legislation }, "Fetching");
      const result = await ingest(db, {
        celex: options.celex,
        legislationId: options.legislation,
        dryRun: options.dryRun,
      }, client);
      logger.info(result, "Ingest complete");
    } finally {
      await pool.end();
    }
  });

program.parse();
```

## Schema Migration

New columns on `articles`:

```typescript
// packages/db/src/schema/articles.ts
export const articles = pgTable("articles", {
  // ... existing columns
  sourceFormat: varchar("source_format", { length: 16 }),
  sourceHash: varchar("source_hash", { length: 64 }),
  fetchedAt: timestamp("fetched_at"),
  verbatim: boolean("verbatim").default(false).notNull(),
});
```

Drizzle migration auto-generated via `drizzle-kit generate`.

## Testing Strategy

- Unit tests: parser against fixture XHTML files (snapshot Article 1, 5, 113)
- Unit test: CellarClient with mocked fetch
- Integration: ingest() against test DB with fixture HTML
- Snapshot: full parse of EU AI Act XHTML

## Usage

```bash
# Ingest EU AI Act
lexius-fetch --celex 32024R1689 --legislation eu-ai-act

# Ingest DORA
lexius-fetch --celex 32022R2554 --legislation dora

# Dry-run
lexius-fetch --celex 32024R1689 --legislation eu-ai-act --dry-run
```

## Cross-Regulation Consistency

Both EU AI Act and DORA will use the same fetch pipeline. The fetcher writes verbatim text to the same `articles` schema. The `verbatim` flag distinguishes fetched content from the original paraphrases.

After fetching:
- Paraphrased articles: `verbatim: false`, `sourceHash: null`
- Fetched articles: `verbatim: true`, `sourceHash: <hex>`, `fetchedAt: <timestamp>`

Consumers can query `WHERE verbatim = true` to scope to authoritative content.

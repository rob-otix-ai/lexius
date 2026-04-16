import { and, eq } from "drizzle-orm";
import { articles as articlesTable } from "@lexius/db";
import type { Database } from "@lexius/db";
import type { CellarClient } from "./cellar-client.js";
import { parseXhtml } from "./parsers/xhtml-parser.js";
import { logger } from "./logger.js";

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

export async function ingest(
  db: Database,
  options: IngestOptions,
  client: CellarClient,
): Promise<IngestResult> {
  const { celex, legislationId, dryRun } = options;
  const { html, url } = await client.fetchXhtml(celex);
  const parsed = parseXhtml(html, celex, legislationId, url);

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
        .where(
          and(
            eq(articlesTable.legislationId, legislationId),
            eq(articlesTable.number, art.number),
          ),
        )
        .limit(1);

      if (existing[0] && existing[0].sourceHash === art.sourceHash) {
        result.articlesUnchanged++;
        continue;
      }

      const id = `${legislationId}-art-${art.number}`;
      const summary = art.body.length > 500 ? art.body.slice(0, 497) + "..." : art.body;
      const articleUrl = `${parsed.sourceUrl}#art_${art.number}`;

      if (!dryRun) {
        await db
          .insert(articlesTable)
          .values({
            id,
            legislationId,
            number: art.number,
            title: art.title,
            summary,
            fullText: art.body,
            sourceUrl: articleUrl,
            sourceFormat: parsed.sourceFormat,
            sourceHash: art.sourceHash,
            fetchedAt: parsed.fetchedAt,
            verbatim: true,
            relatedAnnexes: [],
          })
          .onConflictDoUpdate({
            target: articlesTable.id,
            set: {
              title: art.title,
              summary,
              fullText: art.body,
              sourceUrl: articleUrl,
              sourceFormat: parsed.sourceFormat,
              sourceHash: art.sourceHash,
              fetchedAt: parsed.fetchedAt,
              verbatim: true,
            },
          });
      }

      result.articlesUpdated++;
    } catch (err) {
      result.articlesFailed++;
      const message = (err as Error).message;
      result.errors.push(`Article ${art.number}: ${message}`);
      logger.warn({ article: art.number, err: message }, "Article ingest failed");
    }
  }

  logger.info(
    {
      celex,
      updated: result.articlesUpdated,
      unchanged: result.articlesUnchanged,
      failed: result.articlesFailed,
    },
    dryRun ? "Dry-run complete" : "Ingest complete",
  );

  return result;
}

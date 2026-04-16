import { eq, inArray } from "drizzle-orm";
import { articleExtracts, articles } from "@lexius/db";
import type { Database } from "@lexius/db";
import { runAllExtractors } from "./extractors/index.js";
import { logger } from "./logger.js";

export interface ExtractResult {
  articleId: string;
  extractsAdded: number;
  extractsUnchanged: number;
  extractsRemoved: number;
}

export interface ExtractLegislationOptions {
  dryRun?: boolean;
}

export async function extractArticle(
  db: Database,
  articleId: string,
  legislationId: string,
  options: ExtractLegislationOptions = {},
): Promise<ExtractResult> {
  const [article] = await db
    .select()
    .from(articles)
    .where(eq(articles.id, articleId));
  if (!article || !article.fullText || !article.sourceHash) {
    throw new Error(`Article ${articleId} not found or has no source hash`);
  }

  const expected = runAllExtractors(article.fullText, articleId, legislationId);

  // Dedupe expected by the natural key — the same fact may appear in multiple
  // sentences (e.g., two cross-refs to Article 2 from different points). We
  // keep the first occurrence's verbatim_excerpt.
  const dedupedExpected: typeof expected = [];
  const seenKeys = new Set<string>();
  for (const e of expected) {
    const k = keyOf(e);
    if (seenKeys.has(k)) continue;
    seenKeys.add(k);
    dedupedExpected.push(e);
  }

  const existing = await db
    .select()
    .from(articleExtracts)
    .where(eq(articleExtracts.articleId, articleId));

  const existingKeys = new Set(existing.map(keyOf));
  const expectedKeys = new Set(dedupedExpected.map(keyOf));

  const toInsert = dedupedExpected.filter((e) => !existingKeys.has(keyOf(e)));
  const toDelete = existing.filter((e) => !expectedKeys.has(keyOf(e)));

  if (!options.dryRun && (toInsert.length || toDelete.length)) {
    await db.transaction(async (tx) => {
      if (toDelete.length) {
        await tx
          .delete(articleExtracts)
          .where(
            inArray(
              articleExtracts.id,
              toDelete.map((e) => e.id),
            ),
          );
      }
      if (toInsert.length) {
        await tx.insert(articleExtracts).values(
          toInsert.map((e) => ({
            articleId: e.articleId,
            extractType: e.extractType,
            valueNumeric: e.valueNumeric ?? null,
            valueText: e.valueText ?? null,
            valueDate: e.valueDate ?? null,
            paragraphRef: e.paragraphRef,
            verbatimExcerpt: e.verbatimExcerpt,
            valueHash: e.valueHash,
            sourceHash: article.sourceHash!,
            // provenanceTier defaults to AUTHORITATIVE at the DB level
          })),
        );
      }
    });
  }

  return {
    articleId,
    extractsAdded: toInsert.length,
    extractsUnchanged: existing.length - toDelete.length,
    extractsRemoved: toDelete.length,
  };
}

export async function extractLegislation(
  db: Database,
  legislationId: string,
  options: ExtractLegislationOptions = {},
): Promise<ExtractResult[]> {
  const all = await db
    .select({ id: articles.id })
    .from(articles)
    .where(eq(articles.legislationId, legislationId));
  const results: ExtractResult[] = [];
  for (const { id } of all) {
    try {
      results.push(await extractArticle(db, id, legislationId, options));
    } catch (err) {
      logger.warn(
        { articleId: id, err: (err as Error).message },
        "Extract failed for article",
      );
    }
  }
  return results;
}

export function summariseResults(results: ExtractResult[]): {
  articles: number;
  added: number;
  unchanged: number;
  removed: number;
} {
  return results.reduce(
    (acc, r) => ({
      articles: acc.articles + 1,
      added: acc.added + r.extractsAdded,
      unchanged: acc.unchanged + r.extractsUnchanged,
      removed: acc.removed + r.extractsRemoved,
    }),
    { articles: 0, added: 0, unchanged: 0, removed: 0 },
  );
}

function keyOf(e: {
  extractType: string;
  paragraphRef: string;
  valueHash: string;
}): string {
  return `${e.extractType}|${e.paragraphRef}|${e.valueHash}`;
}

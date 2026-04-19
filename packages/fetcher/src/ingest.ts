import { and, eq } from "drizzle-orm";
import { articles as articlesTable } from "@lexius/db";
import type { Database } from "@lexius/db";
import type { CellarClient } from "./cellar-client.js";
import { parseXhtml } from "./parsers/xhtml-parser.js";
import { createAdapter } from "./adapters/index.js";
import type { SourceConfig } from "./adapters/types.js";
import type { ParsedRegulation } from "./parsers/types.js";
import { logger } from "./logger.js";

export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
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
  articlesEmbedded: number;
  errors: string[];
}

const EMBEDDING_BATCH_SIZE = 50;

/**
 * Ingest from a SourceConfig using the adapter pattern.
 * Works for both PDF and CELLAR sources.
 */
export async function ingestFromSource(
  db: Database,
  config: SourceConfig,
  options: { dryRun?: boolean },
  embedder?: EmbeddingProvider,
): Promise<IngestResult> {
  const adapter = createAdapter(config);
  const parsed = await adapter.fetch(config);
  return upsertParsed(db, parsed, config.legislationId, config.sectionPrefix, options.dryRun, embedder);
}

/**
 * Original CELLAR ingest — backward compatible.
 */
export async function ingest(
  db: Database,
  options: IngestOptions,
  client: CellarClient,
  embedder?: EmbeddingProvider,
): Promise<IngestResult> {
  const { celex, legislationId, dryRun } = options;
  const { html, url } = await client.fetchXhtml(celex);
  const parsed = parseXhtml(html, celex, legislationId, url);
  return upsertParsed(db, parsed, legislationId, "art", dryRun, embedder);
}

/**
 * Shared upsert logic: write parsed regulation articles to DB.
 */
async function upsertParsed(
  db: Database,
  parsed: ParsedRegulation,
  legislationId: string,
  sectionPrefix: string,
  dryRun: boolean | undefined,
  embedder?: EmbeddingProvider,
): Promise<IngestResult> {

  const celex = parsed.celex;

  const result: IngestResult = {
    celex,
    articlesUpdated: 0,
    articlesUnchanged: 0,
    articlesFailed: 0,
    articlesEmbedded: 0,
    errors: [],
  };

  // Collect articles that need writing (new or changed)
  const toWrite: Array<{
    art: typeof parsed.articles[number];
    id: string;
    summary: string;
    articleUrl: string;
  }> = [];

  for (const art of parsed.articles) {
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

    if (existing[0] && existing[0].sourceHash === art.sourceHash && existing[0].embedding) {
      result.articlesUnchanged++;
      continue;
    }

    // Article ID: <legislationId>-<prefix>-<number>
    // e.g. eu-ai-act-art-99 or cima-monetary-authority-s-42A
    const articleId = `${legislationId}-${sectionPrefix}-${art.number}`;

    toWrite.push({
      art,
      id: articleId,
      summary: art.body.length > 500 ? art.body.slice(0, 497) + "..." : art.body,
      articleUrl: `${parsed.sourceUrl}#${sectionPrefix}_${art.number}`,
    });
  }

  // Generate embeddings in batches if provider available
  const embeddings = new Map<string, number[]>();
  if (embedder && toWrite.length > 0 && !dryRun) {
    logger.info({ count: toWrite.length, batchSize: EMBEDDING_BATCH_SIZE }, "Generating embeddings");
    for (let i = 0; i < toWrite.length; i += EMBEDDING_BATCH_SIZE) {
      const batch = toWrite.slice(i, i + EMBEDDING_BATCH_SIZE);
      const texts = batch.map((w) => `${w.art.title}. ${w.art.body.slice(0, 4000)}`);
      try {
        const vectors = await embedder.embedBatch(texts);
        batch.forEach((w, idx) => embeddings.set(w.id, vectors[idx]));
        result.articlesEmbedded += batch.length;
      } catch (err) {
        logger.warn({ err: (err as Error).message, batchStart: i }, "Embedding batch failed, continuing without");
      }
    }
  }

  // Write articles
  for (const { art, id, summary, articleUrl } of toWrite) {
    try {
      const embedding = embeddings.get(id) ?? null;

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
            provenanceTier: "AUTHORITATIVE",
            verbatim: true,
            relatedAnnexes: [],
            embedding,
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
              provenanceTier: "AUTHORITATIVE",
              verbatim: true,
              ...(embedding ? { embedding } : {}),
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
      embedded: result.articlesEmbedded,
      failed: result.articlesFailed,
    },
    dryRun ? "Dry-run complete" : "Ingest complete",
  );

  return result;
}

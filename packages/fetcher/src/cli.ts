#!/usr/bin/env node
import { Command } from "commander";
import { and, eq, sql } from "drizzle-orm";
import {
  createDb,
  articleExtracts,
  articles,
  obligations,
  faq,
  penalties,
} from "@lexius/db";
import { OpenAIEmbeddingService } from "@lexius/infra";
import { CellarClient } from "./cellar-client.js";
import { ingest } from "./ingest.js";
import {
  extractArticle,
  extractLegislation,
  summariseResults,
} from "./extract-runner.js";
import { logger } from "./logger.js";

const program = new Command();

program
  .name("lexius-fetch")
  .description("Fetch regulation text from EUR-Lex CELLAR and ingest into the database")
  .version("0.1.0");

program
  .command("ingest")
  .description("Fetch a regulation by CELEX and upsert verbatim article text")
  .requiredOption("--celex <celex>", "CELEX number (e.g., 32024R1689)")
  .requiredOption("--legislation <id>", "Legislation ID in database (e.g., eu-ai-act)")
  .option("--dry-run", "Fetch and parse but don't write to database", false)
  .option("--no-extract", "Skip the deterministic extractor pass after ingest")
  .action(async (options) => {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      logger.fatal("DATABASE_URL environment variable is required");
      process.exit(1);
    }

    const { db, pool } = createDb(connectionString);
    try {
      const client = new CellarClient();
      const embedder = process.env.OPENAI_API_KEY
        ? new OpenAIEmbeddingService(process.env.OPENAI_API_KEY)
        : undefined;
      if (!embedder) {
        logger.warn("OPENAI_API_KEY not set — skipping embedding generation");
      }

      const result = await ingest(db, {
        celex: options.celex,
        legislationId: options.legislation,
        dryRun: options.dryRun,
      }, client, embedder);

      if (result.articlesFailed > 0) {
        logger.error({ errors: result.errors }, "Some articles failed");
        process.exit(2);
      }

      // Run extractor pass unless explicitly skipped or dry-run.
      if (options.extract !== false && !options.dryRun) {
        const extractResults = await extractLegislation(db, options.legislation);
        logger.info(
          summariseResults(extractResults),
          "Extractor pass complete",
        );
      }
    } finally {
      await pool.end();
    }
  });

program
  .command("extract")
  .description("Run deterministic extractor over articles already in the DB")
  .option("--legislation <id>", "Legislation ID (e.g., eu-ai-act)")
  .option("--article <id>", "Single article ID (overrides --legislation)")
  .option("--dry-run", "Log what would change without writing", false)
  .action(async (options) => {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      logger.fatal("DATABASE_URL environment variable is required");
      process.exit(1);
    }

    const { db, pool } = createDb(connectionString);
    try {
      if (options.article) {
        const legislationId = inferLegislationId(options.article);
        const result = await extractArticle(
          db,
          options.article,
          legislationId,
          { dryRun: options.dryRun },
        );
        logger.info(result, options.dryRun ? "Extract dry-run complete" : "Extract complete");
      } else if (options.legislation) {
        const results = await extractLegislation(db, options.legislation, {
          dryRun: options.dryRun,
        });
        logger.info(
          summariseResults(results),
          options.dryRun ? "Extract dry-run complete" : "Extract complete",
        );
      } else {
        logger.fatal("--legislation or --article is required");
        process.exit(1);
      }
    } finally {
      await pool.end();
    }
  });

program
  .command("backfill-derivation")
  .description(
    "Propose derivedFrom additions on curated rows based on article_cross_ref extracts",
  )
  .requiredOption("--legislation <id>", "Legislation ID (e.g., eu-ai-act)")
  .option("--apply", "Actually write the proposals (default is dry-run)", false)
  .action(async (options) => {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      logger.fatal("DATABASE_URL environment variable is required");
      process.exit(1);
    }

    const { db, pool } = createDb(connectionString);
    try {
      const legislationId = options.legislation as string;
      const apply = options.apply as boolean;

      const crossRefs = await db
        .select({
          hostArticle: articleExtracts.articleId,
          targetArticle: articleExtracts.valueText,
        })
        .from(articleExtracts)
        .innerJoin(articles, eq(articles.id, articleExtracts.articleId))
        .where(
          and(
            eq(articles.legislationId, legislationId),
            eq(articleExtracts.extractType, "article_cross_ref"),
          ),
        );

      const byHost = new Map<string, Set<string>>();
      for (const r of crossRefs) {
        if (!r.targetArticle) continue;
        const set = byHost.get(r.hostArticle) ?? new Set<string>();
        set.add(r.targetArticle);
        byHost.set(r.hostArticle, set);
      }

      const validTargets = new Set(
        (
          await db
            .select({ id: articles.id })
            .from(articles)
            .where(eq(articles.legislationId, legislationId))
        ).map((a) => a.id),
      );

      const proposals: Array<{
        table: "obligations" | "faq" | "penalties";
        rowId: string;
        currentDerivedFrom: string[];
        toAdd: string[];
      }> = [];

      const tables = [
        { name: "obligations" as const, table: obligations },
        { name: "faq" as const, table: faq },
        { name: "penalties" as const, table: penalties },
      ];

      for (const { name, table } of tables) {
        const rows = await db
          .select({
            id: table.id,
            derivedFrom: table.derivedFrom,
          })
          .from(table)
          .where(eq(table.legislationId, legislationId));

        for (const row of rows) {
          const current = new Set(row.derivedFrom ?? []);
          const candidateTargets = new Set<string>();
          for (const host of current) {
            const refs = byHost.get(host);
            if (!refs) continue;
            for (const ref of refs) {
              if (!current.has(ref) && validTargets.has(ref)) {
                candidateTargets.add(ref);
              }
            }
          }
          if (candidateTargets.size > 0) {
            proposals.push({
              table: name,
              rowId: row.id,
              currentDerivedFrom: [...current],
              toAdd: [...candidateTargets],
            });
          }
        }
      }

      if (proposals.length === 0) {
        logger.info({ legislationId }, "No derivation additions proposed");
        return;
      }

      for (const p of proposals) {
        logger.info(
          {
            table: p.table,
            rowId: p.rowId,
            currentDerivedFrom: p.currentDerivedFrom,
            toAdd: p.toAdd,
          },
          apply ? "Applying" : "Proposal (dry-run)",
        );
      }

      if (apply) {
        await db.transaction(async (tx) => {
          for (const p of proposals) {
            const table =
              p.table === "obligations"
                ? obligations
                : p.table === "faq"
                  ? faq
                  : penalties;
            const newDerivedFrom = [...p.currentDerivedFrom, ...p.toAdd];
            await tx
              .update(table)
              .set({ derivedFrom: newDerivedFrom })
              .where(eq(table.id, p.rowId));
          }
        });
        logger.info(
          { applied: proposals.length },
          "Backfill complete",
        );
      } else {
        logger.info(
          { proposalCount: proposals.length },
          "Dry-run complete; pass --apply to write",
        );
      }
    } finally {
      await pool.end();
    }
  });

/**
 * Articles use the ID form `<legislationId>-art-<number>` — e.g.
 * `eu-ai-act-art-99` → `eu-ai-act`. We split on the last occurrence of `-art-`.
 */
function inferLegislationId(articleId: string): string {
  const idx = articleId.lastIndexOf("-art-");
  if (idx < 0) {
    throw new Error(
      `Could not infer legislation ID from article ID ${articleId}; expected "<legislation>-art-<number>"`,
    );
  }
  return articleId.slice(0, idx);
}

program.parseAsync(process.argv).catch((err) => {
  logger.fatal({ err }, "Fatal error");
  process.exit(1);
});

#!/usr/bin/env node
import { Command } from "commander";
import { createDb } from "@lexius/db";
import { CellarClient } from "./cellar-client.js";
import { ingest } from "./ingest.js";
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
  .action(async (options) => {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      logger.fatal("DATABASE_URL environment variable is required");
      process.exit(1);
    }

    const { db, pool } = createDb(connectionString);
    try {
      const client = new CellarClient();
      const result = await ingest(db, {
        celex: options.celex,
        legislationId: options.legislation,
        dryRun: options.dryRun,
      }, client);

      if (result.articlesFailed > 0) {
        logger.error({ errors: result.errors }, "Some articles failed");
        process.exit(2);
      }
    } finally {
      await pool.end();
    }
  });

program.parseAsync(process.argv).catch((err) => {
  logger.fatal({ err }, "Fatal error");
  process.exit(1);
});

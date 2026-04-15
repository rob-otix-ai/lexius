import express from "express";
import cors from "cors";
import { createDb } from "@lexius/db";
import { createContainer } from "@lexius/core";
import type { EmbeddingService } from "@lexius/core";
import type pg from "pg";

// ── Mock Embedding Service ──────────────────────────────────────────

export function createMockEmbeddingService(): EmbeddingService {
  return {
    embed: async (_text: string) => new Array(3072).fill(0),
    embedBatch: async (texts: string[]) =>
      texts.map(() => new Array(3072).fill(0)),
  };
}

// ── Database ────────────────────────────────────────────────────────

const DATABASE_URL = process.env.DATABASE_URL;

export function isDatabaseAvailable(): boolean {
  return !!DATABASE_URL;
}

let pool: pg.Pool | null = null;

/**
 * Creates a fully wired Express app using real database repositories
 * and a mock embedding service (to avoid OpenAI dependency in CI).
 *
 * This dynamically imports the api package's built modules to get
 * access to routes, middleware, and repositories.
 */
export async function createTestApp() {
  if (!DATABASE_URL) {
    throw new Error(
      "DATABASE_URL environment variable is required for E2E tests",
    );
  }

  const { db, pool: dbPool } = createDb(DATABASE_URL);
  pool = dbPool;

  // Dynamic imports from the built api package
  const { createApiRouter } = await import(
    "../../packages/api/dist/routes/index.js"
  );
  const { errorHandler } = await import(
    "../../packages/api/dist/middleware/index.js"
  );
  const {
    DrizzleLegislationRepository,
    DrizzleArticleRepository,
    DrizzleRiskCategoryRepository,
    DrizzleObligationRepository,
    DrizzlePenaltyRepository,
    DrizzleDeadlineRepository,
    DrizzleFAQRepository,
  } = await import("../../packages/api/dist/repositories/index.js");

  const legislationRepo = new DrizzleLegislationRepository(db);
  const articleRepo = new DrizzleArticleRepository(db);
  const riskCategoryRepo = new DrizzleRiskCategoryRepository(db);
  const obligationRepo = new DrizzleObligationRepository(db);
  const penaltyRepo = new DrizzlePenaltyRepository(db);
  const deadlineRepo = new DrizzleDeadlineRepository(db);
  const faqRepo = new DrizzleFAQRepository(db);

  const embeddingService = createMockEmbeddingService();

  const container = createContainer({
    legislationRepo,
    articleRepo,
    riskCategoryRepo,
    obligationRepo,
    penaltyRepo,
    deadlineRepo,
    faqRepo,
    embeddingService,
  });

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/v1", createApiRouter(container));
  app.use(errorHandler);

  return app;
}

export async function teardown() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

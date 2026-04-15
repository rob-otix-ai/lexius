import { createDb } from "@legal-ai/db";
import { createContainer } from "@legal-ai/core";
import {
  DrizzleLegislationRepository,
  DrizzleArticleRepository,
  DrizzleRiskCategoryRepository,
  DrizzleObligationRepository,
  DrizzlePenaltyRepository,
  DrizzleDeadlineRepository,
  DrizzleFAQRepository,
} from "./repositories.js";
import { OpenAIEmbeddingService } from "./embedding-service.js";

export async function setup() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  const { db, pool } = createDb(connectionString);

  const legislationRepo = new DrizzleLegislationRepository(db);
  const articleRepo = new DrizzleArticleRepository(db);
  const riskCategoryRepo = new DrizzleRiskCategoryRepository(db);
  const obligationRepo = new DrizzleObligationRepository(db);
  const penaltyRepo = new DrizzlePenaltyRepository(db);
  const deadlineRepo = new DrizzleDeadlineRepository(db);
  const faqRepo = new DrizzleFAQRepository(db);
  const embeddingService = new OpenAIEmbeddingService();

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

  const cleanup = async () => {
    await pool.end();
  };

  return { container, cleanup };
}

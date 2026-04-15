import { createDb } from "@lexius/db";
import { createContainer } from "@lexius/core";
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
import { logger } from "./logger.js";

export function setup() {
  const connectionString =
    process.env.DATABASE_URL ?? "postgresql://localhost:5432/legal_ai";

  const { db, pool } = createDb(connectionString);
  logger.info("Database connection established");

  const legislationRepo = new DrizzleLegislationRepository(db);
  const articleRepo = new DrizzleArticleRepository(db);
  const riskCategoryRepo = new DrizzleRiskCategoryRepository(db);
  const obligationRepo = new DrizzleObligationRepository(db);
  const penaltyRepo = new DrizzlePenaltyRepository(db);
  const deadlineRepo = new DrizzleDeadlineRepository(db);
  const faqRepo = new DrizzleFAQRepository(db);
  const embeddingService = new OpenAIEmbeddingService(
    process.env.OPENAI_API_KEY,
  );

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

  logger.info("Service container created");

  return { container, pool };
}

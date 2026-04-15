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

export function setup() {
  const connectionString =
    process.env.DATABASE_URL ?? "postgresql://localhost:5432/legal_ai";

  const { db, pool } = createDb(connectionString);

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

  return { container, pool };
}

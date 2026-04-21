import { createDb } from "@lexius/db";
import { createContainer, type ContainerDependencies } from "@lexius/core";
import type { EnhancementService } from "@lexius/core";
import {
  DrizzleLegislationRepository,
  DrizzleArticleRepository,
  DrizzleArticleRevisionRepository,
  DrizzleArticleExtractRepository,
  DrizzleRiskCategoryRepository,
  DrizzleObligationRepository,
  DrizzlePenaltyRepository,
  DrizzleDeadlineRepository,
  DrizzleFAQRepository,
} from "./repositories.js";
import { OpenAIEmbeddingService } from "./openai-embedding.js";
import { DrizzleCuratorEditRepository } from "./curator-edit-repository.js";
import { DrizzleTransactionManager } from "./transaction-manager.js";
import { DrizzleCrossCheckService } from "./cross-check-service.js";

export interface SetupOptions {
  databaseUrl?: string;
  openaiApiKey?: string;
  reportEnhancementService?: EnhancementService;
}

export function setup(options: SetupOptions = {}) {
  const connectionString = options.databaseUrl ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  const { db, pool } = createDb(connectionString);

  const embeddingService = new OpenAIEmbeddingService(options.openaiApiKey);

  const container = createContainer({
    legislationRepo: new DrizzleLegislationRepository(db),
    articleRepo: new DrizzleArticleRepository(db),
    articleRevisionRepo: new DrizzleArticleRevisionRepository(db),
    articleExtractRepo: new DrizzleArticleExtractRepository(db),
    riskCategoryRepo: new DrizzleRiskCategoryRepository(db),
    obligationRepo: new DrizzleObligationRepository(db),
    penaltyRepo: new DrizzlePenaltyRepository(db),
    deadlineRepo: new DrizzleDeadlineRepository(db),
    faqRepo: new DrizzleFAQRepository(db),
    embeddingService,
    reportEnhancementService: options.reportEnhancementService,
    curatorEditRepo: new DrizzleCuratorEditRepository(db),
    transactionManager: new DrizzleTransactionManager(db),
    crossCheckService: new DrizzleCrossCheckService(db),
  });

  return { container, pool, db };
}

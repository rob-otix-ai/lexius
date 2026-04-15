import express from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { logger } from "./logger.js";
import { createDb } from "@lexius/db";
import { createContainer } from "@lexius/core";
import { createApiRouter } from "./routes/index.js";
import { errorHandler } from "./middleware/index.js";
import { OpenAIEmbeddingService } from "./services/openai-embedding.js";
import {
  DrizzleLegislationRepository,
  DrizzleArticleRepository,
  DrizzleRiskCategoryRepository,
  DrizzleObligationRepository,
  DrizzlePenaltyRepository,
  DrizzleDeadlineRepository,
  DrizzleFAQRepository,
} from "./repositories/index.js";

const PORT = parseInt(process.env.PORT ?? "3000", 10);
const DATABASE_URL = process.env.DATABASE_URL;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}
if (!OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY environment variable is required");
}

// Database
const { db } = createDb(DATABASE_URL);

// Repositories
const legislationRepo = new DrizzleLegislationRepository(db);
const articleRepo = new DrizzleArticleRepository(db);
const riskCategoryRepo = new DrizzleRiskCategoryRepository(db);
const obligationRepo = new DrizzleObligationRepository(db);
const penaltyRepo = new DrizzlePenaltyRepository(db);
const deadlineRepo = new DrizzleDeadlineRepository(db);
const faqRepo = new DrizzleFAQRepository(db);

// Services
const embeddingService = new OpenAIEmbeddingService(OPENAI_API_KEY);

// Container
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

// Express app
const app = express();

app.use(cors());
app.use(express.json());
app.use(pinoHttp({ logger }));

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// API routes
app.use("/api/v1", createApiRouter(container));

// Error handler (must be registered last)
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info({ port: PORT }, "legal-ai API server started");
});

export default app;

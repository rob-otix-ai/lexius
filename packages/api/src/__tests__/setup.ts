import express, { type Express } from "express";
import { createApiRouter } from "../routes/index.js";
import { errorHandler } from "../middleware/error-handler.js";
import { vi } from "vitest";

export function createTestApp() {
  const container = {
    classifySystem: { execute: vi.fn() },
    getObligations: { execute: vi.fn() },
    calculatePenalty: { execute: vi.fn() },
    searchKnowledge: { execute: vi.fn() },
    getArticle: { execute: vi.fn() },
    getDeadlines: { execute: vi.fn() },
    answerQuestion: { execute: vi.fn() },
    runAssessment: { execute: vi.fn() },
    listLegislations: { execute: vi.fn() },
    getDerivationChain: { execute: vi.fn() },
    getArticleHistory: { execute: vi.fn() },
    penaltyRepo: { findByLegislation: vi.fn(), findByViolationType: vi.fn() },
    deadlineRepo: { findByLegislation: vi.fn(), findUpcoming: vi.fn() },
  };

  const app: Express = express();
  app.use(express.json());
  app.use("/api/v1", createApiRouter(container as any));
  app.use(errorHandler);

  return { app, container };
}

import express from "express";
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
  };

  const app = express();
  app.use(express.json());
  app.use("/api/v1", createApiRouter(container as any));
  app.use(errorHandler);

  return { app, container };
}

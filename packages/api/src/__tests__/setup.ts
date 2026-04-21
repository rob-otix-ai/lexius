import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { createApiRouter } from "../routes/index.js";
import { errorHandler } from "../middleware/error-handler.js";
import { vi } from "vitest";

export interface TestAppOptions {
  role?: "reader" | "curator";
  apiKeyOwner?: string;
  withCurator?: boolean;
}

export function createTestApp(options: TestAppOptions = {}) {
  const role = options.role ?? "curator";
  const apiKeyOwner = options.apiKeyOwner ?? "test@example.com";

  const curator = options.withCurator === false
    ? null
    : {
        updateCuratedObligation: { execute: vi.fn() },
        createCuratedObligation: { execute: vi.fn() },
        deprecateCuratedObligation: { execute: vi.fn() },
        revertCuratorEdit: { execute: vi.fn() },
        listCuratorEdits: { execute: vi.fn() },
        markStaleByArticle: { execute: vi.fn() },
      };

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
    obligationRepo: { findStale: vi.fn() },
    curator,
  };

  const app: Express = express();
  app.use(express.json());
  // Fake auth middleware: tests set role via options.role.
  app.use("/api/v1", (req: Request, _res: Response, next: NextFunction) => {
    (req as any).apiKeyRole = role;
    (req as any).apiKeyOwner = apiKeyOwner;
    next();
  });
  app.use("/api/v1", createApiRouter(container as any));
  app.use(errorHandler);

  return { app, container };
}

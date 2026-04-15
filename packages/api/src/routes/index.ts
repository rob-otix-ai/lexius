import { Router } from "express";
import type { createContainer } from "@lexius/core";
import { classifyRoutes } from "./classify.js";
import { deadlineRoutes } from "./deadlines.js";
import { obligationRoutes } from "./obligations.js";
import { faqRoutes } from "./faq.js";
import { penaltyRoutes } from "./penalties.js";
import { articleRoutes } from "./articles.js";
import { assessmentRoutes } from "./assessments.js";
import { searchRoutes } from "./search.js";
import { legislationRoutes } from "./legislations.js";
import { auditRoutes } from "./audit.js";

export function createApiRouter(
  container: ReturnType<typeof createContainer>,
): Router {
  const router = Router();

  router.use(classifyRoutes(container));
  router.use(deadlineRoutes(container));
  router.use(obligationRoutes(container));
  router.use(faqRoutes(container));
  router.use(penaltyRoutes(container));
  router.use(articleRoutes(container));
  router.use(assessmentRoutes(container));
  router.use(searchRoutes(container));
  router.use(legislationRoutes(container));
  router.use(auditRoutes(container));

  return router;
}

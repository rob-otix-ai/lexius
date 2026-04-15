import { Router } from "express";
import { z } from "zod";
import type { createContainer } from "@legal-ai/core";
import { logger } from "../logger.js";

const SearchBodySchema = z.object({
  legislationId: z.string(),
  query: z.string(),
  limit: z.number().int().positive().max(50).default(10),
  entityType: z.enum(["article", "obligation", "faq", "risk-category"]),
});

export function searchRoutes(
  container: ReturnType<typeof createContainer>,
): Router {
  const router = Router();

  router.post("/knowledge/search", async (req, res, next) => {
    try {
      const input = SearchBodySchema.parse(req.body);
      logger.info({ query: input.query, entityType: input.entityType }, "Knowledge search");
      const result = await container.searchKnowledge.execute(input);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

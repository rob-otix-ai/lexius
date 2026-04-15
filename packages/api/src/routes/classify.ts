import { Router } from "express";
import { z } from "zod";
import type { createContainer } from "@lexius/core";
import { logger } from "../logger.js";

const ClassifyBodySchema = z.object({
  legislationId: z.string(),
  description: z.string().optional(),
  useCase: z.string().optional(),
  role: z.enum(["provider", "deployer", "unknown"]),
  signals: z.record(z.unknown()).optional(),
});

export function classifyRoutes(
  container: ReturnType<typeof createContainer>,
): Router {
  const router = Router();

  router.post("/classify", async (req, res, next) => {
    try {
      const input = ClassifyBodySchema.parse(req.body);
      logger.info({ legislationId: input.legislationId }, "Classifying system");
      const result = await container.classifySystem.execute(input);
      logger.info({ risk: result.riskClassification, confidence: result.confidence }, "Classification complete");
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

import { Router } from "express";
import { z } from "zod";
import type { createContainer } from "@lexius/core";
import { toObligationDTO } from "../dto/entities.js";
import { toArticleDTO } from "../dto/entities.js";

const ObligationsQuerySchema = z.object({
  legislationId: z.string(),
  role: z.string().optional(),
  riskLevel: z.string().optional(),
  category: z.string().optional(),
  minTier: z.enum(["AUTHORITATIVE", "CURATED", "AI_GENERATED"]).optional(),
});

const DerivationParamsSchema = z.object({
  id: z.string(),
});

export function obligationRoutes(
  container: ReturnType<typeof createContainer>,
): Router {
  const router = Router();

  router.get("/obligations", async (req, res, next) => {
    try {
      const filter = ObligationsQuerySchema.parse(req.query);
      const result = await container.getObligations.execute(filter);
      res.json(result.map(toObligationDTO));
    } catch (err) {
      next(err);
    }
  });

  router.get("/obligations/:id/derivation", async (req, res, next) => {
    try {
      const params = DerivationParamsSchema.parse(req.params);
      const chain = await container.getDerivationChain.execute(params.id);
      res.json({
        obligationId: chain.obligationId,
        sourceArticles: chain.sourceArticles.map(toArticleDTO),
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

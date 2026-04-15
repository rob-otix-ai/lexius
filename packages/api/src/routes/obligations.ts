import { Router } from "express";
import { z } from "zod";
import type { createContainer } from "@lexius/core";

const ObligationsQuerySchema = z.object({
  legislationId: z.string(),
  role: z.string().optional(),
  riskLevel: z.string().optional(),
  category: z.string().optional(),
});

export function obligationRoutes(
  container: ReturnType<typeof createContainer>,
): Router {
  const router = Router();

  router.get("/obligations", async (req, res, next) => {
    try {
      const filter = ObligationsQuerySchema.parse(req.query);
      const result = await container.getObligations.execute(filter);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

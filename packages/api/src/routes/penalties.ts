import { Router } from "express";
import { z } from "zod";
import type { createContainer } from "@lexius/core";

const PenaltyBodySchema = z.object({
  legislationId: z.string(),
  violationType: z.string(),
  annualTurnoverEur: z.number(),
  isSme: z.boolean().optional(),
});

export function penaltyRoutes(
  container: ReturnType<typeof createContainer>,
): Router {
  const router = Router();

  router.post("/penalties/calculate", async (req, res, next) => {
    try {
      const input = PenaltyBodySchema.parse(req.body);
      const result = await container.calculatePenalty.execute(input);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

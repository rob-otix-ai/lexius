import { Router } from "express";
import { z } from "zod";
import type { createContainer } from "@lexius/core";
import { toPenaltyDTO } from "../dto/entities.js";

const PenaltyBodySchema = z.object({
  legislationId: z.string(),
  violationType: z.string(),
  annualTurnoverEur: z.number(),
  isSme: z.boolean().optional(),
});

const PenaltiesQuerySchema = z.object({
  legislationId: z.string(),
});

export function penaltyRoutes(
  container: ReturnType<typeof createContainer>,
): Router {
  const router = Router();

  router.get("/penalties", async (req, res, next) => {
    try {
      const query = PenaltiesQuerySchema.parse(req.query);
      const rows = await container.penaltyRepo.findByLegislation(
        query.legislationId,
      );
      res.json(rows.map(toPenaltyDTO));
    } catch (err) {
      next(err);
    }
  });

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

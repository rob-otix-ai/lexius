import { Router } from "express";
import { z } from "zod";
import type { createContainer } from "@legal-ai/core";

const DeadlinesQuerySchema = z.object({
  legislationId: z.string(),
  onlyUpcoming: z
    .string()
    .optional()
    .transform((v) => v === "true"),
});

export function deadlineRoutes(
  container: ReturnType<typeof createContainer>,
): Router {
  const router = Router();

  router.get("/deadlines", async (req, res, next) => {
    try {
      const query = DeadlinesQuerySchema.parse(req.query);
      const result = await container.getDeadlines.execute(
        query.legislationId,
      );

      if (query.onlyUpcoming) {
        res.json({
          deadlines: result.deadlines.filter((d) => !d.isPast),
          nextMilestone: result.nextMilestone,
        });
      } else {
        res.json(result);
      }
    } catch (err) {
      next(err);
    }
  });

  return router;
}

import { Router } from "express";
import { z } from "zod";
import type { createContainer } from "@lexius/core";
import { toDeadlineDTO } from "../dto/entities.js";

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

      const deadlines = query.onlyUpcoming
        ? result.deadlines.filter((d) => !d.isPast)
        : result.deadlines;

      res.json({
        deadlines: deadlines.map(toDeadlineDTO),
        nextMilestone: result.nextMilestone
          ? toDeadlineDTO(result.nextMilestone)
          : null,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

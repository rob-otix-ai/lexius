import { Router } from "express";
import { z } from "zod";
import type { createContainer } from "@lexius/core";

const AssessmentParamsSchema = z.object({
  id: z.string(),
});

const AssessmentBodySchema = z.object({
  legislationId: z.string(),
  input: z.record(z.unknown()),
});

export function assessmentRoutes(
  container: ReturnType<typeof createContainer>,
): Router {
  const router = Router();

  router.post("/assessments/:id", async (req, res, next) => {
    try {
      const params = AssessmentParamsSchema.parse(req.params);
      const body = AssessmentBodySchema.parse(req.body);
      const result = container.runAssessment.execute(
        body.legislationId,
        params.id,
        body.input,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

import { Router } from "express";
import { z } from "zod";
import type { createContainer } from "@legal-ai/core";

const FaqSearchBodySchema = z.object({
  legislationId: z.string(),
  question: z.string(),
});

export function faqRoutes(
  container: ReturnType<typeof createContainer>,
): Router {
  const router = Router();

  router.post("/faq/search", async (req, res, next) => {
    try {
      const body = FaqSearchBodySchema.parse(req.body);
      const result = await container.answerQuestion.execute(
        body.legislationId,
        body.question,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

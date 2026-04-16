import { Router } from "express";
import { z } from "zod";
import type { createContainer } from "@lexius/core";
import { toFaqDTO } from "../dto/entities.js";

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

      if (!result.found || !result.answer) {
        res.json(result);
        return;
      }

      res.json({
        found: result.found,
        answer: {
          similarity: result.answer.similarity,
          item: toFaqDTO(result.answer.item),
        },
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

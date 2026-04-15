import { Router } from "express";
import { z } from "zod";
import type { createContainer } from "@legal-ai/core";

const ArticleParamsSchema = z.object({
  number: z.string(),
});

const ArticleQuerySchema = z.object({
  legislationId: z.string(),
});

export function articleRoutes(
  container: ReturnType<typeof createContainer>,
): Router {
  const router = Router();

  router.get("/articles/:number", async (req, res, next) => {
    try {
      const params = ArticleParamsSchema.parse(req.params);
      const query = ArticleQuerySchema.parse(req.query);
      const result = await container.getArticle.execute(
        query.legislationId,
        params.number,
      );

      if (!result) {
        res.status(404).json({ error: "Article not found" });
        return;
      }

      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

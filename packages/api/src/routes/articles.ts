import { Router } from "express";
import { z } from "zod";
import type { createContainer } from "@lexius/core";
import { toArticleDTO, toArticleExtractDTO } from "../dto/entities.js";

const ArticleParamsSchema = z.object({
  number: z.string(),
});

const ArticleQuerySchema = z.object({
  legislationId: z.string(),
});

const ArticleHistoryParamsSchema = z.object({
  id: z.string(),
});

const ArticleExtractsParamsSchema = z.object({
  id: z.string(),
});

const ArticleExtractsQuerySchema = z.object({
  type: z
    .enum([
      "fine_amount_eur",
      "turnover_percentage",
      "date",
      "article_cross_ref",
      "annex_cross_ref",
      "shall_clause",
      "annex_item",
    ])
    .optional(),
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

      res.json(toArticleDTO(result));
    } catch (err) {
      next(err);
    }
  });

  router.get("/articles/:id/history", async (req, res, next) => {
    try {
      const params = ArticleHistoryParamsSchema.parse(req.params);
      const history = await container.getArticleHistory.execute(params.id);
      res.json(history);
    } catch (err) {
      next(err);
    }
  });

  router.get("/articles/:id/extracts", async (req, res, next) => {
    try {
      const params = ArticleExtractsParamsSchema.parse(req.params);
      const query = ArticleExtractsQuerySchema.parse(req.query);
      const extracts = await container.getArticleExtracts.execute(
        params.id,
        query.type,
      );
      res.json(extracts.map(toArticleExtractDTO));
    } catch (err) {
      next(err);
    }
  });

  return router;
}

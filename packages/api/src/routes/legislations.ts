import { Router } from "express";
import { z } from "zod";
import type { createContainer } from "@lexius/core";

const querySchema = z.object({}).passthrough();

export function legislationRoutes(
  container: ReturnType<typeof createContainer>,
): Router {
  const router = Router();

  router.get("/legislations", async (req, res, next) => {
    try {
      querySchema.parse(req.query);
      const result = await container.listLegislations.execute();
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

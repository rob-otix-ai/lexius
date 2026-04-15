import { Router } from "express";
import { z } from "zod";
import type { createContainer } from "@lexius/core";

const auditInputSchema = z.object({
  legislationId: z.string().default("eu-ai-act"),
  systemDescription: z.string().min(1),
  role: z.enum(["provider", "deployer", "unknown"]).default("unknown"),
  signals: z.record(z.unknown()).optional(),
  annualTurnoverEur: z.number().positive().optional(),
  isSme: z.boolean().optional(),
  enhanced: z.boolean().optional(),
  options: z.object({
    includeDocumentation: z.boolean().optional(),
    includeDeadlines: z.boolean().optional(),
    includePenalties: z.boolean().optional(),
    includeRecommendations: z.boolean().optional(),
  }).optional(),
});

export function auditRoutes(container: ReturnType<typeof createContainer>): Router {
  const router = Router();

  router.post("/audit", async (req, res, next) => {
    try {
      const input = auditInputSchema.parse(req.body);
      const report = await container.generateAuditReport.execute(input);

      let result = report;
      if (input.enhanced && container.enhanceAuditReport) {
        result = await container.enhanceAuditReport.execute(report, input.systemDescription);
      }
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

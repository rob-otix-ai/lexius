import { Router } from "express";
import { z } from "zod";
import type { createContainer } from "@lexius/core";

const RunSwarmSchema = z.object({
  legislationId: z.string(),
  systemDescription: z.string().default(""),
  concurrency: z.number().min(1).max(8).default(4),
});

const SessionParamsSchema = z.object({
  sessionId: z.string().uuid(),
});

const FindingsQuerySchema = z.object({
  type: z
    .enum(["obligation", "penalty", "deadline", "cross_ref", "gap", "risk"])
    .optional(),
});

const SynthesiseSchema = z.object({
  legislationName: z.string().default(""),
  systemDescription: z.string().default(""),
});

export function swarmRoutes(
  container: ReturnType<typeof createContainer>,
): Router {
  const router = Router();

  router.post("/swarm/run", async (req, res, next) => {
    try {
      const body = RunSwarmSchema.parse(req.body);

      // Dynamic import to avoid ARCH-003 static dependency on @robotixai/lexius-agent
      const agentPkg = "@robotixai/lexius-agent";
      const dbPkg = "@lexius/db";
      const { runSwarm } = await import(/* webpackIgnore: true */ agentPkg) as any;
      const { createDb } = await import(/* webpackIgnore: true */ dbPkg) as any;

      const connectionString = process.env.DATABASE_URL;
      if (!connectionString) {
        res.status(500).json({ error: "DATABASE_URL required" });
        return;
      }

      const { db, pool } = createDb(connectionString);
      try {
        const result = await runSwarm(db, body.legislationId, {
          concurrency: body.concurrency,
        });
        res.json({
          sessionId: result.sessionId,
          totalFindings: result.totalFindings,
          findingsByType: result.findingsByType,
          gapCount: result.gapCount,
          durationMs: result.durationMs,
        });
      } finally {
        await pool.end();
      }
    } catch (err) {
      next(err);
    }
  });

  router.get("/swarm/:sessionId/findings", async (req, res, next) => {
    try {
      const params = SessionParamsSchema.parse(req.params);
      const query = FindingsQuerySchema.parse(req.query);

      const dbPkg = "@lexius/db";
      const { createDb, complianceWorkspace } = await import(/* webpackIgnore: true */ dbPkg) as any;
      const { eq, and } = await import("drizzle-orm");

      const connectionString = process.env.DATABASE_URL;
      if (!connectionString) {
        res.status(500).json({ error: "DATABASE_URL required" });
        return;
      }

      const { db, pool } = createDb(connectionString);
      try {
        let rows;
        if (query.type) {
          rows = await db
            .select()
            .from(complianceWorkspace)
            .where(
              and(
                eq(complianceWorkspace.sessionId, params.sessionId),
                eq(complianceWorkspace.findingType, query.type),
              ),
            );
        } else {
          rows = await db
            .select()
            .from(complianceWorkspace)
            .where(eq(complianceWorkspace.sessionId, params.sessionId));
        }
        res.json(rows);
      } finally {
        await pool.end();
      }
    } catch (err) {
      next(err);
    }
  });

  router.post("/swarm/:sessionId/synthesise", async (req, res, next) => {
    try {
      const params = SessionParamsSchema.parse(req.params);
      const body = SynthesiseSchema.parse(req.body);

      const agentPkg = "@robotixai/lexius-agent";
      const dbPkg = "@lexius/db";
      const { synthesise } = await import(/* webpackIgnore: true */ agentPkg) as any;
      const { createDb } = await import(/* webpackIgnore: true */ dbPkg) as any;

      const connectionString = process.env.DATABASE_URL;
      if (!connectionString) {
        res.status(500).json({ error: "DATABASE_URL required" });
        return;
      }

      const { db, pool } = createDb(connectionString);
      try {
        const report = await synthesise(db, params.sessionId, {
          legislationId: "",
          legislationName: body.legislationName,
          systemDescription: body.systemDescription,
        });
        res.json(report);
      } finally {
        await pool.end();
      }
    } catch (err) {
      next(err);
    }
  });

  router.delete("/swarm/:sessionId", async (req, res, next) => {
    try {
      const params = SessionParamsSchema.parse(req.params);

      const agentPkg = "@robotixai/lexius-agent";
      const dbPkg = "@lexius/db";
      const { cleanupSession } = await import(/* webpackIgnore: true */ agentPkg) as any;
      const { createDb } = await import(/* webpackIgnore: true */ dbPkg) as any;

      const connectionString = process.env.DATABASE_URL;
      if (!connectionString) {
        res.status(500).json({ error: "DATABASE_URL required" });
        return;
      }

      const { db, pool } = createDb(connectionString);
      try {
        await cleanupSession(db, params.sessionId);
        res.json({ deleted: true });
      } finally {
        await pool.end();
      }
    } catch (err) {
      next(err);
    }
  });

  return router;
}

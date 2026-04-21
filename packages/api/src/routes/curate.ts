import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import type { createContainer } from "@lexius/core";
import {
  AuthoritativeImmutable,
  CrossCheckFailed,
  DerivedFromRequired,
  DerivedFromUnresolved,
  DerivedFromImmutable,
  EditNotFound,
  EditNotRevertable,
  ObligationNotFound,
  ReasonRequired,
  RowVersionMismatch,
} from "@lexius/core";
import { requireCuratorRole } from "../middleware/require-curator-role.js";
import {
  toCuratorEditDTO,
  toObligationCuratorDTO,
} from "../dto/curator-edit.js";

const CreateBody = z.object({
  id: z.string().min(1),
  legislationId: z.string().min(1),
  role: z.string().min(1),
  riskLevel: z.string().min(1),
  obligation: z.string().min(1),
  article: z.string().default(""),
  deadline: z.string().datetime().nullable().default(null),
  details: z.string().default(""),
  category: z.string().default(""),
  derivedFrom: z.array(z.string()).min(1),
  reason: z.string().min(1),
});

const UpdateBody = z.object({
  changes: z
    .object({
      role: z.string().optional(),
      riskLevel: z.string().optional(),
      obligation: z.string().optional(),
      article: z.string().optional(),
      deadline: z.string().datetime().nullable().optional(),
      details: z.string().optional(),
      category: z.string().optional(),
    })
    .strict(),
  reason: z.string().min(1),
});

const DeprecateBody = z.object({
  reason: z.string().min(1),
});

const RevertBody = z.object({
  editId: z.string().min(1),
  reason: z.string().min(1),
});

function isDryRun(req: Request): boolean {
  const v = req.query.dry_run;
  return v === "true" || v === "1";
}

function parseIfMatch(req: Request, res: Response): number | null {
  const hdr = req.header("If-Match");
  if (!hdr) {
    res.status(428).json({
      error: "if_match_required",
      message: "If-Match header with current row_version is required.",
    });
    return null;
  }
  const parsed = Number(hdr);
  if (!Number.isInteger(parsed) || parsed < 1) {
    res.status(400).json({
      error: "if_match_invalid",
      message: "If-Match must be a positive integer row_version.",
    });
    return null;
  }
  return parsed;
}

function curatorAttribution(req: Request) {
  const editorId = (req as any).apiKeyOwner ?? "unknown";
  const editorIp = req.ip ?? req.socket.remoteAddress ?? null;
  const editorUa = req.header("user-agent") ?? null;
  return { editorId, editorIp, editorUa };
}

export function curateRoutes(
  container: ReturnType<typeof createContainer>,
): Router {
  const router = Router();

  router.use(requireCuratorRole);

  router.get("/curate/whoami", async (req, res) => {
    res.json({
      editor_id: (req as any).apiKeyOwner ?? null,
      role: (req as any).apiKeyRole ?? "reader",
    });
  });

  router.post("/curate/obligations", async (req, res, next) => {
    try {
      if (!container.curator) {
        res.status(503).json({ error: "curator_workflow_unavailable" });
        return;
      }
      const body = CreateBody.parse(req.body);
      const { editorId, editorIp, editorUa } = curatorAttribution(req);

      const result = await container.curator.createCuratedObligation.execute({
        obligation: {
          id: body.id,
          legislationId: body.legislationId,
          role: body.role,
          riskLevel: body.riskLevel,
          obligation: body.obligation,
          article: body.article,
          deadline: body.deadline ? new Date(body.deadline) : null,
          details: body.details,
          category: body.category,
          derivedFrom: body.derivedFrom,
        },
        editorId,
        editorIp,
        editorUa,
        source: "api",
        reason: body.reason,
        dryRun: isDryRun(req),
      });

      res.status(result.dryRun ? 200 : 201).json({
        dry_run: result.dryRun,
        obligation: result.obligation
          ? toObligationCuratorDTO(result.obligation)
          : null,
      });
    } catch (err) {
      next(err);
    }
  });

  router.patch("/curate/obligations/:id", async (req, res, next) => {
    try {
      if (!container.curator) {
        res.status(503).json({ error: "curator_workflow_unavailable" });
        return;
      }
      const rowVersion = parseIfMatch(req, res);
      if (rowVersion === null) return;
      const body = UpdateBody.parse(req.body);
      const { editorId, editorIp, editorUa } = curatorAttribution(req);

      const changes: Record<string, unknown> = { ...body.changes };
      if ("deadline" in changes) {
        changes.deadline = changes.deadline
          ? new Date(changes.deadline as string)
          : null;
      }

      const result = await container.curator.updateCuratedObligation.execute({
        obligationId: req.params.id,
        rowVersion,
        editorId,
        editorIp,
        editorUa,
        source: "api",
        reason: body.reason,
        changes: changes as any,
        dryRun: isDryRun(req),
      });

      res.json({
        dry_run: result.dryRun,
        obligation: result.obligation
          ? toObligationCuratorDTO(result.obligation)
          : null,
        cross_check_result: result.crossCheckResult,
        embedding_regenerated: result.embeddingRegenerated,
      });
    } catch (err) {
      next(err);
    }
  });

  router.delete("/curate/obligations/:id", async (req, res, next) => {
    try {
      if (!container.curator) {
        res.status(503).json({ error: "curator_workflow_unavailable" });
        return;
      }
      const rowVersion = parseIfMatch(req, res);
      if (rowVersion === null) return;
      const body = DeprecateBody.parse(req.body);
      const { editorId, editorIp, editorUa } = curatorAttribution(req);

      const result = await container.curator.deprecateCuratedObligation.execute({
        obligationId: req.params.id,
        rowVersion,
        editorId,
        editorIp,
        editorUa,
        source: "api",
        reason: body.reason,
        dryRun: isDryRun(req),
      });

      res.json({
        dry_run: result.dryRun,
        obligation: result.obligation
          ? toObligationCuratorDTO(result.obligation)
          : null,
      });
    } catch (err) {
      next(err);
    }
  });

  router.post("/curate/obligations/:id/revert", async (req, res, next) => {
    try {
      if (!container.curator) {
        res.status(503).json({ error: "curator_workflow_unavailable" });
        return;
      }
      const body = RevertBody.parse(req.body);
      const { editorId, editorIp, editorUa } = curatorAttribution(req);

      const result = await container.curator.revertCuratorEdit.execute({
        editId: body.editId,
        editorId,
        editorIp,
        editorUa,
        source: "api",
        reason: body.reason,
        dryRun: isDryRun(req),
      });

      res.json({
        dry_run: result.dryRun,
        obligation: result.obligation
          ? toObligationCuratorDTO(result.obligation)
          : null,
      });
    } catch (err) {
      next(err);
    }
  });

  router.get("/curate/edits", async (req, res, next) => {
    try {
      if (!container.curator) {
        res.status(503).json({ error: "curator_workflow_unavailable" });
        return;
      }
      const entityType = req.query.entity_type as
        | "obligation"
        | undefined;
      const entityId = req.query.entity_id as string | undefined;
      const editorId = req.query.editor_id as string | undefined;
      const since = req.query.since
        ? new Date(req.query.since as string)
        : undefined;

      const edits = await container.curator.listCuratorEdits.execute({
        entityType,
        entityId,
        editorId,
        since,
      });
      res.json({ edits: edits.map(toCuratorEditDTO) });
    } catch (err) {
      next(err);
    }
  });

  router.get("/curate/queue", async (_req, res, next) => {
    try {
      if (!container.curator) {
        res.status(503).json({ error: "curator_workflow_unavailable" });
        return;
      }
      const stale = await container.obligationRepo.findStale();
      res.json({
        obligations: stale.map(toObligationCuratorDTO),
      });
    } catch (err) {
      next(err);
    }
  });

  router.use(curatorErrorHandler);

  return router;
}

function curatorErrorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (err instanceof ObligationNotFound) {
    res.status(404).json({ error: "obligation_not_found", message: err.message });
    return;
  }
  if (err instanceof AuthoritativeImmutable) {
    res.status(403).json({ error: "authoritative_immutable", message: err.message });
    return;
  }
  if (err instanceof RowVersionMismatch) {
    res.status(409).json({
      error: "row_version_mismatch",
      current: err.current,
      message: err.message,
    });
    return;
  }
  if (err instanceof ReasonRequired) {
    res.status(422).json({ error: "reason_required", message: err.message });
    return;
  }
  if (err instanceof DerivedFromRequired) {
    res.status(422).json({ error: "derived_from_required", message: err.message });
    return;
  }
  if (err instanceof DerivedFromUnresolved) {
    res.status(422).json({
      error: "derived_from_unresolved",
      missing: err.missing,
      message: err.message,
    });
    return;
  }
  if (err instanceof DerivedFromImmutable) {
    res.status(422).json({ error: "derived_from_immutable", message: err.message });
    return;
  }
  if (err instanceof CrossCheckFailed) {
    res.status(422).json({
      error: "cross_check_failed",
      mismatches: err.mismatches,
      message: err.message,
    });
    return;
  }
  if (err instanceof EditNotFound) {
    res.status(404).json({ error: "edit_not_found", message: err.message });
    return;
  }
  if (err instanceof EditNotRevertable) {
    res.status(409).json({ error: "edit_not_revertable", message: err.message });
    return;
  }
  next(err);
}

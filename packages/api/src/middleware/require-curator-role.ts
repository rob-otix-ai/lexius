import type { Request, Response, NextFunction } from "express";

/**
 * Gates a route to curator-scoped API keys only. Must be mounted AFTER
 * apiKeyAuth so that req.apiKeyRole is populated.
 *
 * Reader-scoped keys (the default) receive 403 with a machine-readable
 * error code. Curator-scoped keys pass through.
 */
export function requireCuratorRole(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const role = (req as any).apiKeyRole;
  if (role !== "curator") {
    res.status(403).json({
      error: "curator_role_required",
      message: "This route requires a curator-scoped API key.",
    });
    return;
  }
  next();
}

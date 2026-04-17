import type { Request, Response, NextFunction } from "express";
import { createHash } from "node:crypto";
import { eq, isNull } from "drizzle-orm";
import type { Database } from "@lexius/db";
import { apiKeys } from "@lexius/db";

/**
 * API key authentication middleware.
 *
 * Primary:  Authorization: Bearer lx_...
 * Fallback: x-api-key header (backward compat)
 *
 * When LEXIUS_SKIP_DB_AUTH=true (local dev), falls through to the legacy
 * env-var check against LEXIUS_API_KEY. This prevents breaking local dev
 * when the api_keys table is empty or doesn't exist.
 */
export function apiKeyAuth(options: { db?: Database } = {}) {
  const skipDbAuth = process.env.LEXIUS_SKIP_DB_AUTH === "true";
  const legacyKey = process.env.LEXIUS_API_KEY;

  // If no API key configured AND no DB auth, skip auth (open mode)
  if (!legacyKey && !options.db && skipDbAuth) {
    return (_req: Request, _res: Response, next: NextFunction) => next();
  }

  return async (req: Request, res: Response, next: NextFunction) => {
    // Extract key from Authorization header or x-api-key
    let rawKey: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      rawKey = authHeader.slice(7);
    }
    if (!rawKey) {
      const xApiKey = req.headers["x-api-key"];
      if (typeof xApiKey === "string") {
        rawKey = xApiKey;
      }
    }

    if (!rawKey) {
      // No key at all — if open mode, pass through
      if (!legacyKey && skipDbAuth) {
        return next();
      }
      res.status(401).json({ error: "Missing API key." });
      return;
    }

    // Try DB-backed auth first (if DB is available and not skipped)
    if (options.db && !skipDbAuth && rawKey.startsWith("lx_")) {
      try {
        const hash = createHash("sha256").update(rawKey).digest("hex");
        const rows = await options.db
          .select()
          .from(apiKeys)
          .where(eq(apiKeys.keyHash, hash))
          .limit(1);

        const row = rows[0];
        if (!row) {
          res.status(401).json({ error: "Invalid or revoked API key." });
          return;
        }
        if (row.revokedAt) {
          res.status(401).json({ error: "Invalid or revoked API key." });
          return;
        }

        // Fire-and-forget update last_used_at
        options.db
          .update(apiKeys)
          .set({ lastUsedAt: new Date() })
          .where(eq(apiKeys.id, row.id))
          .then(() => {})
          .catch(() => {});

        // Attach key info for rate limiting
        (req as any).apiKeyId = row.id;
        (req as any).apiKeyRateLimit = row.rateLimit;
        return next();
      } catch {
        // DB lookup failed — fall through to legacy check if available
        if (!legacyKey) {
          res.status(500).json({ error: "Auth service unavailable." });
          return;
        }
      }
    }

    // Legacy env-var check (local dev / backward compat)
    if (legacyKey) {
      if (rawKey === legacyKey) {
        return next();
      }
      res.status(401).json({ error: "Invalid or missing API key." });
      return;
    }

    // DB auth skipped but key doesn't match any pattern
    if (skipDbAuth) {
      return next();
    }

    res.status(401).json({ error: "Invalid or missing API key." });
  };
}

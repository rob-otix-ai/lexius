import type { Request, Response, NextFunction } from "express";
import { desc, sql } from "drizzle-orm";
import type { Database } from "@lexius/db";
import { articles, legislations } from "@lexius/db";

const VERSION = "0.3.0";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface ProvenanceCache {
  dataAsOf: string | null;
  legislationsAvailable: string[];
  loadedAt: number;
}

let cache: ProvenanceCache | null = null;

async function loadProvenanceData(db: Database): Promise<ProvenanceCache> {
  const now = Date.now();
  if (cache && now - cache.loadedAt < CACHE_TTL_MS) {
    return cache;
  }

  try {
    // Most recent fetched_at across all articles
    const [latestRow] = await db
      .select({ fetchedAt: articles.fetchedAt })
      .from(articles)
      .orderBy(desc(articles.fetchedAt))
      .limit(1);

    // All legislation IDs
    const legRows = await db
      .select({ id: legislations.id })
      .from(legislations);

    cache = {
      dataAsOf: latestRow?.fetchedAt?.toISOString() ?? null,
      legislationsAvailable: legRows.map((r) => r.id),
      loadedAt: now,
    };
  } catch {
    // If DB query fails, return stale cache or empty
    if (cache) return cache;
    cache = {
      dataAsOf: null,
      legislationsAvailable: [],
      loadedAt: now,
    };
  }

  return cache;
}

/**
 * Express middleware that wraps res.json() to inject _provenance metadata
 * into every JSON response on /api/v1 routes.
 */
export function provenanceMetadata(db: Database) {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);

    res.json = function (body: any) {
      // Only wrap object/array responses; skip if body already has _provenance
      if (body && typeof body === "object" && !body._provenance) {
        loadProvenanceData(db).then((prov) => {
          const wrapped = {
            _provenance: {
              source: "lexius",
              version: VERSION,
              dataAsOf: prov.dataAsOf,
              legislationsAvailable: prov.legislationsAvailable,
            },
            ...(Array.isArray(body) ? { result: body } : body),
          };
          return originalJson(wrapped);
        }).catch(() => {
          // If provenance loading fails, send response without it
          return originalJson(body);
        });
      } else {
        return originalJson(body);
      }
      return res;
    } as any;

    next();
  };
}

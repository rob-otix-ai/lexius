import { eq, sql } from "drizzle-orm";
import { complianceWorkspace, obligations } from "@lexius/db";
import type { Database } from "@lexius/db";
import { createSwarmSession } from "./session.js";
import { runSwarmAgent } from "./agent-loop.js";
import type { SwarmResult, FindingType } from "./types.js";

const DEFAULT_CONCURRENCY = 4;
const MAX_CONCURRENCY = 8;

export async function runSwarm(
  db: Database,
  legislationId: string,
  options?: { concurrency?: number; batchSize?: number; gapThreshold?: number },
): Promise<SwarmResult> {
  const concurrency = Math.min(
    Math.max(1, options?.concurrency ?? DEFAULT_CONCURRENCY),
    MAX_CONCURRENCY,
  );

  // 1. Create session (populates work queue)
  const sessionId = await createSwarmSession(db, legislationId);

  // 2. Load curated obligations for gap detection
  const curatedObligations = await db
    .select({ id: obligations.id, obligation: obligations.obligation })
    .from(obligations)
    .where(eq(obligations.legislationId, legislationId));

  // 3. Spawn N agents in parallel via Promise.all
  const start = Date.now();

  const agents = Array.from({ length: concurrency }, (_, i) =>
    runSwarmAgent(db, sessionId, `swarm-agent-${i}`, {
      batchSize: options?.batchSize,
      gapThreshold: options?.gapThreshold,
    }),
  );

  await Promise.all(agents);

  const durationMs = Date.now() - start;

  // 4. Query workspace for aggregate counts by finding_type
  const counts = await db
    .select({
      findingType: complianceWorkspace.findingType,
      count: sql<number>`count(*)::int`,
    })
    .from(complianceWorkspace)
    .where(eq(complianceWorkspace.sessionId, sessionId))
    .groupBy(complianceWorkspace.findingType);

  // 5. Build findingsByType map with all types defaulting to 0
  const allTypes: FindingType[] = [
    "obligation",
    "penalty",
    "deadline",
    "cross_ref",
    "gap",
    "risk",
  ];
  const findingsByType: Record<FindingType, number> = {} as Record<FindingType, number>;
  for (const t of allTypes) {
    findingsByType[t] = 0;
  }
  for (const row of counts) {
    findingsByType[row.findingType as FindingType] = row.count;
  }

  const totalFindings = Object.values(findingsByType).reduce((a, b) => a + b, 0);

  // 6. Count total articles processed
  const totalArticles = counts.length > 0 ? totalFindings : 0;

  return {
    sessionId,
    totalArticles,
    totalFindings,
    findingsByType,
    gapCount: findingsByType.gap,
    durationMs,
  };
}

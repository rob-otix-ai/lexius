import { randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { articles, swarmWorkQueue, complianceWorkspace } from "@lexius/db";
import type { Database } from "@lexius/db";

export async function createSwarmSession(
  db: Database,
  legislationId: string,
): Promise<string> {
  const sessionId = randomUUID();

  // Populate work queue with all AUTHORITATIVE articles for this legislation
  const allArticles = await db
    .select({ id: articles.id })
    .from(articles)
    .where(
      and(
        eq(articles.legislationId, legislationId),
        eq(articles.provenanceTier, "AUTHORITATIVE"),
      ),
    );

  if (allArticles.length === 0) {
    throw new Error(
      `No AUTHORITATIVE articles found for legislation '${legislationId}'`,
    );
  }

  await db.insert(swarmWorkQueue).values(
    allArticles.map((a) => ({
      sessionId,
      articleId: a.id,
    })),
  );

  return sessionId;
}

export async function cleanupSession(
  db: Database,
  sessionId: string,
): Promise<void> {
  await db
    .delete(complianceWorkspace)
    .where(eq(complianceWorkspace.sessionId, sessionId));
  await db
    .delete(swarmWorkQueue)
    .where(eq(swarmWorkQueue.sessionId, sessionId));
}

/**
 * Test script: single-threaded swarm run against the live DB.
 *
 * Usage:
 *   set -a; source .env; set +a
 *   npx tsx packages/agent/src/swarm/test-single-threaded.ts
 */
import { createDb } from "@lexius/db";
import { complianceWorkspace } from "@lexius/db";
import { eq, sql } from "drizzle-orm";
import { createSwarmSession, cleanupSession } from "./session.js";
import { runSwarmAgent } from "./agent-loop.js";

const LEGISLATION_ID = "eu-ai-act";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const { db, pool } = createDb(connectionString);

  console.log(`Creating swarm session for '${LEGISLATION_ID}'...`);
  const sessionId = await createSwarmSession(db, LEGISLATION_ID);
  console.log(`Session created: ${sessionId}`);

  const start = Date.now();
  console.log("Running single-threaded swarm agent...");
  const totalFindings = await runSwarmAgent(db, sessionId, "test-agent-0", {
    batchSize: 10,
  });
  const durationMs = Date.now() - start;

  console.log(`\nAgent completed in ${durationMs}ms`);
  console.log(`Total findings inserted: ${totalFindings}`);

  // Query workspace: counts by finding_type
  const counts = await db
    .select({
      findingType: complianceWorkspace.findingType,
      count: sql<number>`count(*)::int`,
    })
    .from(complianceWorkspace)
    .where(eq(complianceWorkspace.sessionId, sessionId))
    .groupBy(complianceWorkspace.findingType);

  console.log("\n--- Finding Counts by Type ---");
  let verifiedTotal = 0;
  for (const row of counts) {
    console.log(`  ${row.findingType}: ${row.count}`);
    verifiedTotal += row.count;
  }
  console.log(`  TOTAL: ${verifiedTotal}`);

  // Show a few gap examples
  const gapExamples = await db
    .select({ finding: complianceWorkspace.finding })
    .from(complianceWorkspace)
    .where(
      eq(complianceWorkspace.sessionId, sessionId),
    )
    .limit(5);

  const gaps = gapExamples.filter(
    (r: any) => (r.finding as any).type === "gap",
  );
  if (gaps.length > 0) {
    console.log("\n--- Gap Examples (up to 5) ---");
    for (const g of gaps) {
      const finding = g.finding as any;
      console.log(
        `  [${finding.articleRef}] ${finding.shallClauseText?.slice(0, 100)}...`,
      );
    }
  }

  // Cleanup
  console.log("\nCleaning up session...");
  await cleanupSession(db, sessionId);
  console.log("Session cleaned up.");

  await pool.end();
}

main().catch((err) => {
  console.error("Swarm test failed:", err);
  process.exit(1);
});

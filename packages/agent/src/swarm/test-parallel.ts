/**
 * Test script: parallel swarm run (4 agents) + synthesis against the live DB.
 *
 * Usage:
 *   set -a; source .env; set +a
 *   node --import tsx packages/agent/src/swarm/test-parallel.ts
 */
import { createDb } from "@lexius/db";
import { runSwarm } from "./run-swarm.js";
import { synthesise } from "./synthesise.js";
import { cleanupSession } from "./session.js";

const LEGISLATION_ID = "eu-ai-act";
const CONCURRENCY = 4;

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const { db, pool } = createDb(connectionString);

  // --- Run 1 ---
  console.log(`\n=== Run 1: parallel swarm (concurrency=${CONCURRENCY}) ===`);
  const result1 = await runSwarm(db, LEGISLATION_ID, {
    concurrency: CONCURRENCY,
    batchSize: 5,
  });

  console.log(`Session: ${result1.sessionId}`);
  console.log(`Duration: ${result1.durationMs}ms`);
  console.log(`Total findings: ${result1.totalFindings}`);
  console.log("Findings by type:");
  for (const [type, count] of Object.entries(result1.findingsByType)) {
    console.log(`  ${type}: ${count}`);
  }
  console.log(`Gap count: ${result1.gapCount}`);

  // Synthesise
  console.log("\n--- Synthesis (Run 1) ---");
  const report1 = await synthesise(db, result1.sessionId, {
    legislationId: LEGISLATION_ID,
    legislationName: "EU AI Act",
    systemDescription: "Test system for parallel swarm verification",
  });

  console.log(`Obligations: ${report1.obligations.length}`);
  console.log(`Recommendations (gaps): ${report1.recommendations.length}`);
  console.log(`Penalty exposure: ${report1.penaltyExposure ? `max fine = ${report1.penaltyExposure.maxFine}` : "none"}`);
  console.log(`Deadlines: ${report1.deadlines.length}`);
  console.log(`Citations: ${report1.citations.length}`);
  console.log(`Confidence: ${report1.confidence.overall} (${(report1.confidence.signalCompleteness * 100).toFixed(0)}% authoritative)`);
  console.log(`Reliance: AUTH=${report1.relianceByTier.AUTHORITATIVE} CUR=${report1.relianceByTier.CURATED} AI=${report1.relianceByTier.AI_GENERATED}`);

  // Cleanup run 1
  await cleanupSession(db, result1.sessionId);
  console.log("Run 1 session cleaned up.");

  // --- Run 2 (determinism test) ---
  console.log(`\n=== Run 2: determinism check (concurrency=${CONCURRENCY}) ===`);
  const result2 = await runSwarm(db, LEGISLATION_ID, {
    concurrency: CONCURRENCY,
    batchSize: 5,
  });

  console.log(`Session: ${result2.sessionId}`);
  console.log(`Duration: ${result2.durationMs}ms`);
  console.log(`Total findings: ${result2.totalFindings}`);
  console.log("Findings by type:");
  for (const [type, count] of Object.entries(result2.findingsByType)) {
    console.log(`  ${type}: ${count}`);
  }
  console.log(`Gap count: ${result2.gapCount}`);

  // Cleanup run 2
  await cleanupSession(db, result2.sessionId);
  console.log("Run 2 session cleaned up.");

  // --- Determinism comparison ---
  console.log("\n=== Determinism Comparison ===");
  const match = result1.totalFindings === result2.totalFindings &&
    result1.gapCount === result2.gapCount &&
    JSON.stringify(result1.findingsByType) === JSON.stringify(result2.findingsByType);

  console.log(`Run 1 total: ${result1.totalFindings}, Run 2 total: ${result2.totalFindings}`);
  console.log(`Run 1 gaps: ${result1.gapCount}, Run 2 gaps: ${result2.gapCount}`);
  console.log(`Deterministic: ${match ? "YES" : "NO"}`);

  if (!match) {
    console.log("MISMATCH in findingsByType:");
    console.log("  Run 1:", JSON.stringify(result1.findingsByType));
    console.log("  Run 2:", JSON.stringify(result2.findingsByType));
  }

  await pool.end();
  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Parallel swarm test failed:", err);
  process.exit(1);
});

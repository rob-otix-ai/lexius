import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

type Container = ReturnType<typeof import("@lexius/core").createContainer>;

export function registerSwarmAssessmentTool(
  server: McpServer,
  container: Container,
): void {
  server.tool(
    "legalai_run_swarm_assessment",
    "Run a hivemind swarm assessment — N parallel agents analyse all articles for a legislation, producing obligations, penalties, deadlines, cross-references, and gap findings. Returns a ComplianceReport with provenance tiers on every finding.",
    {
      legislationId: z.string().describe("Legislation identifier (e.g. 'eu-ai-act')"),
      systemDescription: z.string().optional().describe("Description of the AI system being assessed"),
      concurrency: z.number().min(1).max(8).optional().describe("Number of parallel agents (default 4)"),
    },
    async (args) => {
      try {
        // Runtime-only imports — bypass tsc module resolution
        const agentPkg = "@robotixai/lexius-agent";
        const dbPkg = "@lexius/db";
        const agentMod: any = await import(/* webpackIgnore: true */ agentPkg);
        const dbMod: any = await import(/* webpackIgnore: true */ dbPkg);

        const connectionString = process.env.DATABASE_URL;
        if (!connectionString) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ error: "DATABASE_URL required for swarm assessment" }),
            }],
          };
        }

        const { db, pool } = dbMod.createDb(connectionString);
        try {
          const result = await agentMod.runSwarm(db, args.legislationId, {
            concurrency: args.concurrency ?? 4,
          });

          const report = await agentMod.synthesise(db, result.sessionId, {
            legislationId: args.legislationId,
            legislationName: args.legislationId,
            systemDescription: args.systemDescription ?? "",
          });

          await agentMod.cleanupSession(db, result.sessionId);

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                swarmResult: {
                  totalFindings: result.totalFindings,
                  findingsByType: result.findingsByType,
                  gapCount: result.gapCount,
                  durationMs: result.durationMs,
                },
                report,
              }, null, 2),
            }],
          };
        } finally {
          await pool.end();
        }
      } catch (err) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ error: (err as Error).message }),
          }],
        };
      }
    },
  );
}

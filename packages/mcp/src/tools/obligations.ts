import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

type Container = ReturnType<typeof import("@legal-ai/core").createContainer>;

export function registerObligationsTool(
  server: McpServer,
  container: Container,
): void {
  server.tool(
    "legalai_get_obligations",
    "Get compliance obligations filtered by legislation, role, and risk level.",
    {
      legislationId: z.string().describe("Legislation identifier"),
      role: z.string().optional().describe("Role (e.g. provider, deployer)"),
      riskLevel: z
        .string()
        .optional()
        .describe("Risk level (e.g. high, limited, minimal)"),
    },
    async (args) => {
      const result = await container.getObligations.execute({
        legislationId: args.legislationId,
        role: args.role,
        riskLevel: args.riskLevel,
      });

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}

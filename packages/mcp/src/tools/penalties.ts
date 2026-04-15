import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

type Container = ReturnType<typeof import("@lexius/core").createContainer>;

export function registerPenaltiesTool(
  server: McpServer,
  container: Container,
): void {
  server.tool(
    "legalai_calculate_penalty",
    "Calculate potential penalty/fine for a specific violation type under a legislation.",
    {
      legislationId: z.string().describe("Legislation identifier"),
      violationType: z.string().describe("Type of violation"),
      annualTurnoverEur: z
        .number()
        .describe("Annual global turnover in EUR"),
      isSme: z
        .boolean()
        .default(false)
        .describe("Whether the organisation is an SME"),
    },
    async (args) => {
      const result = await container.calculatePenalty.execute({
        legislationId: args.legislationId,
        violationType: args.violationType,
        annualTurnoverEur: args.annualTurnoverEur,
        isSme: args.isSme,
      });

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}

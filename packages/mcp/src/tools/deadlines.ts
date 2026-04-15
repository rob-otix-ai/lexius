import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

type Container = ReturnType<typeof import("@lexius/core").createContainer>;

export function registerDeadlinesTool(
  server: McpServer,
  container: Container,
): void {
  server.tool(
    "legalai_check_deadlines",
    "Check compliance deadlines for a legislation. Returns all deadlines with status and the next upcoming milestone.",
    {
      legislationId: z.string().describe("Legislation identifier"),
      onlyUpcoming: z
        .boolean()
        .default(false)
        .describe("If true, only return future deadlines"),
    },
    async (args) => {
      const result = await container.getDeadlines.execute(args.legislationId);

      const deadlines = args.onlyUpcoming
        ? result.deadlines.filter((d) => !d.isPast)
        : result.deadlines;

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { deadlines, nextMilestone: result.nextMilestone },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}

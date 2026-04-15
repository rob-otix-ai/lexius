import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

type Container = ReturnType<typeof import("@legal-ai/core").createContainer>;

export function registerAssessmentsTool(
  server: McpServer,
  container: Container,
): void {
  server.tool(
    "legalai_run_assessment",
    "Run a compliance assessment (e.g. conformity assessment, FRIA) with provided inputs.",
    {
      legislationId: z.string().describe("Legislation identifier"),
      assessmentId: z
        .string()
        .describe("Assessment identifier (e.g. 'conformity-assessment')"),
      input: z
        .record(z.unknown())
        .describe("Assessment input fields"),
    },
    async (args) => {
      const result = container.runAssessment.execute(
        args.legislationId,
        args.assessmentId,
        args.input,
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}

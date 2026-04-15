import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

type Container = ReturnType<typeof import("@lexius/core").createContainer>;

export function registerAuditTool(server: McpServer, container: Container) {
  server.tool(
    "legalai_generate_audit_report",
    "Generate a complete compliance assessment report for an AI system — includes classification, obligations, assessments, penalties, deadlines, and recommendations",
    {
      legislationId: z
        .string()
        .default("eu-ai-act")
        .describe("Legislation to assess against"),
      systemDescription: z
        .string()
        .describe("Description of the AI system"),
      role: z
        .enum(["provider", "deployer", "unknown"])
        .default("unknown")
        .describe("Role in the AI value chain"),
      signals: z
        .record(z.unknown())
        .optional()
        .describe("Structured classification signals"),
      annualTurnoverEur: z
        .number()
        .optional()
        .describe("Annual global turnover in EUR"),
      isSme: z
        .boolean()
        .optional()
        .describe("SME/startup status"),
      enhanced: z
        .boolean()
        .optional()
        .describe("Enhance with AI-powered analysis"),
    },
    async (args) => {
      const report = await container.generateAuditReport.execute({
        legislationId: args.legislationId,
        systemDescription: args.systemDescription,
        role: args.role,
        signals: args.signals,
        annualTurnoverEur: args.annualTurnoverEur,
        isSme: args.isSme,
      });

      let result = report;
      if (args.enhanced && container.enhanceAuditReport) {
        result = await container.enhanceAuditReport.execute(report, args.systemDescription);
      }

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}

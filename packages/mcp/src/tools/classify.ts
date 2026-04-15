import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

type Container = ReturnType<typeof import("@lexius/core").createContainer>;

export function registerClassifyTool(
  server: McpServer,
  container: Container,
): void {
  server.tool(
    "legalai_classify_system",
    "Classify an AI system under a legislation framework (e.g. EU AI Act). Returns risk level, matched category, relevant articles, and next steps.",
    {
      legislationId: z
        .string()
        .default("eu-ai-act")
        .describe("Legislation identifier"),
      description: z
        .string()
        .optional()
        .describe("Description of the AI system"),
      useCase: z
        .string()
        .optional()
        .describe("Specific use case of the AI system"),
      role: z
        .enum(["provider", "deployer", "unknown"])
        .describe("Role of the organisation with respect to the AI system"),
      signals: z
        .record(z.unknown())
        .optional()
        .describe("Signal-based classification inputs"),
    },
    async (args) => {
      const result = await container.classifySystem.execute({
        legislationId: args.legislationId,
        description: args.description,
        useCase: args.useCase,
        role: args.role,
        signals: args.signals,
      });

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

type Container = ReturnType<typeof import("@legal-ai/core").createContainer>;

export function registerSearchTool(
  server: McpServer,
  container: Container,
): void {
  server.tool(
    "legalai_search_knowledge",
    "Semantic search across the legislation knowledge base. Search articles, obligations, FAQs, or risk categories.",
    {
      legislationId: z.string().describe("Legislation identifier"),
      query: z.string().describe("Natural language search query"),
      limit: z.number().default(5).describe("Maximum number of results"),
      entityType: z
        .enum(["article", "obligation", "faq", "risk-category"])
        .describe("Type of entity to search"),
    },
    async (args) => {
      const results = await container.searchKnowledge.execute({
        legislationId: args.legislationId,
        query: args.query,
        limit: args.limit,
        entityType: args.entityType,
      });

      return {
        content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }],
      };
    },
  );
}

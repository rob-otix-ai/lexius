import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

type Container = ReturnType<typeof import("@legal-ai/core").createContainer>;

export function registerArticlesTool(
  server: McpServer,
  container: Container,
): void {
  server.tool(
    "legalai_get_article",
    "Retrieve a specific article by number from a legislation.",
    {
      legislationId: z.string().describe("Legislation identifier"),
      article: z.string().describe("Article number (e.g. '6', '52')"),
    },
    async (args) => {
      const result = await container.getArticle.execute(
        args.legislationId,
        args.article,
      );

      if (!result) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: `Article ${args.article} not found in ${args.legislationId}`,
              }),
            },
          ],
        };
      }

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}

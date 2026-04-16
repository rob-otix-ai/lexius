import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

type Container = ReturnType<typeof import("@lexius/core").createContainer>;

export function registerArticleHistoryTool(
  server: McpServer,
  container: Container,
): void {
  server.tool(
    "legalai_get_article_history",
    "Retrieve the full revision history of an article, including current text and all prior superseded versions.",
    {
      articleId: z.string().describe("Article identifier (e.g. 'eu-ai-act-art-5')"),
    },
    async (args) => {
      try {
        const history = await container.getArticleHistory.execute(args.articleId);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(history, null, 2) },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: (err as Error).message,
              }),
            },
          ],
        };
      }
    },
  );
}

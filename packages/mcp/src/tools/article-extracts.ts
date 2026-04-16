import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

type Container = ReturnType<typeof import("@lexius/core").createContainer>;

const EXTRACT_TYPES = [
  "fine_amount_eur",
  "turnover_percentage",
  "date",
  "article_cross_ref",
  "annex_cross_ref",
  "shall_clause",
  "annex_item",
] as const;

export function registerArticleExtractsTool(
  server: McpServer,
  container: Container,
): void {
  server.tool(
    "legalai_get_article_extracts",
    "Retrieve the typed facts deterministically extracted from an article's verbatim text (fine amounts, percentages, dates, cross-refs, 'shall' clauses). All extracts are AUTHORITATIVE.",
    {
      articleId: z.string().describe("Article identifier (e.g. 'eu-ai-act-art-99')"),
      extractType: z
        .enum(EXTRACT_TYPES)
        .optional()
        .describe("Optional filter by extract type"),
    },
    async (args) => {
      try {
        const extracts = await container.getArticleExtracts.execute(
          args.articleId,
          args.extractType,
        );
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(extracts, null, 2) },
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

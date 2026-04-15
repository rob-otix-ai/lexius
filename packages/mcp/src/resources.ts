import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

type Container = ReturnType<typeof import("@legal-ai/core").createContainer>;

export function registerResources(
  server: McpServer,
  container: Container,
): void {
  server.resource(
    "timeline",
    new ResourceTemplate("legalai://{legislationId}/timeline", {
      list: undefined,
    }),
    { description: "All compliance deadlines with status and days remaining" },
    async (uri, { legislationId }) => {
      const result = await container.getDeadlines.execute(
        legislationId as string,
      );
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    },
  );

  server.resource(
    "risk-levels",
    new ResourceTemplate("legalai://{legislationId}/risk-levels", {
      list: undefined,
    }),
    { description: "All risk categories and their classification levels" },
    async (uri, { legislationId }) => {
      const categories = await container.searchKnowledge.execute({
        legislationId: legislationId as string,
        query: "risk level classification",
        limit: 50,
        entityType: "risk-category",
      });
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(categories, null, 2),
          },
        ],
      };
    },
  );

  server.resource(
    "annex-iii",
    new ResourceTemplate("legalai://{legislationId}/annex/iii", {
      list: undefined,
    }),
    { description: "Annex III — High-risk AI system categories" },
    async (uri, { legislationId }) => {
      const article = await container.getArticle.execute(
        legislationId as string,
        "annex-iii",
      );
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(article, null, 2),
          },
        ],
      };
    },
  );

  server.resource(
    "annex-iv",
    new ResourceTemplate("legalai://{legislationId}/annex/iv", {
      list: undefined,
    }),
    { description: "Annex IV — Technical documentation requirements" },
    async (uri, { legislationId }) => {
      const article = await container.getArticle.execute(
        legislationId as string,
        "annex-iv",
      );
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(article, null, 2),
          },
        ],
      };
    },
  );
}

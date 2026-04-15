import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

type Container = ReturnType<typeof import("@legal-ai/core").createContainer>;

export function registerResources(
  server: McpServer,
  container: Container,
): void {
  server.resource(
    "timeline",
    "legalai://timeline",
    { description: "All compliance deadlines with status and days remaining" },
    async (uri) => {
      const result = await container.getDeadlines.execute("eu-ai-act");
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
    "legalai://risk-levels",
    { description: "All risk categories and their classification levels" },
    async (uri) => {
      const categories = await container.searchKnowledge.execute({
        legislationId: "eu-ai-act",
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
    "legalai://annex/iii",
    { description: "Annex III — High-risk AI system categories" },
    async (uri) => {
      const article = await container.getArticle.execute(
        "eu-ai-act",
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
    "legalai://annex/iv",
    { description: "Annex IV — Technical documentation requirements" },
    async (uri) => {
      const article = await container.getArticle.execute(
        "eu-ai-act",
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

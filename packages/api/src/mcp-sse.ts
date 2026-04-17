/**
 * SSE transport for the MCP server, mounted on the Express API.
 *
 * - GET  /mcp/sse       — SSE connection endpoint (one McpServer + SSEServerTransport per connection)
 * - POST /mcp/messages  — message endpoint for MCP client-to-server messages
 *
 * Both routes are behind the same apiKeyAuth middleware as the REST routes.
 *
 * NOTE: We cannot import from @lexius/mcp (consumer boundary — ARCH-006).
 * Instead we create the McpServer directly from the SDK and register tools inline,
 * delegating to the same container use cases as the MCP package does.
 */
import type { Express, Request, Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import { logger } from "./logger.js";

type Container = ReturnType<typeof import("@lexius/core").createContainer>;

const SERVER_NAME = "lexius";
const SERVER_VERSION = "0.3.0";

/** Active SSE sessions keyed by session ID */
const sessions = new Map<string, SSEServerTransport>();

/**
 * Register all MCP tools on a server instance.
 * Mirrors the tool definitions in @lexius/mcp/src/tools but avoids the cross-consumer import.
 */
function registerMcpTools(server: McpServer, container: Container): void {
  server.tool(
    "legalai_classify_system",
    "Classify an AI system under a legislation framework (e.g. EU AI Act).",
    {
      legislationId: z.string().default("eu-ai-act").describe("Legislation identifier"),
      description: z.string().optional().describe("Description of the AI system"),
      useCase: z.string().optional().describe("Specific use case"),
      role: z.enum(["provider", "deployer", "unknown"]).describe("Role of the organisation"),
      signals: z.record(z.unknown()).optional().describe("Signal-based classification inputs"),
    },
    async (args) => {
      const result = await container.classifySystem.execute(args);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "legalai_get_obligations",
    "Get compliance obligations filtered by legislation, role, and risk level.",
    {
      legislationId: z.string().describe("Legislation identifier"),
      role: z.string().optional().describe("Role (e.g. provider, deployer)"),
      riskLevel: z.string().optional().describe("Risk level (e.g. high, limited, minimal)"),
    },
    async (args) => {
      const result = await container.getObligations.execute(args);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "legalai_calculate_penalty",
    "Calculate potential penalty/fine for a specific violation type.",
    {
      legislationId: z.string().describe("Legislation identifier"),
      violationType: z.string().describe("Type of violation"),
      annualTurnoverEur: z.number().describe("Annual global turnover in EUR"),
      isSme: z.boolean().default(false).describe("Whether the organisation is an SME"),
    },
    async (args) => {
      const result = await container.calculatePenalty.execute(args);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "legalai_search_knowledge",
    "Semantic search across the legislation knowledge base.",
    {
      legislationId: z.string().describe("Legislation identifier"),
      query: z.string().describe("Natural language search query"),
      limit: z.number().default(5).describe("Maximum number of results"),
      entityType: z.enum(["article", "obligation", "faq", "risk-category"]).describe("Type of entity to search"),
    },
    async (args) => {
      const results = await container.searchKnowledge.execute(args);
      return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
    },
  );

  server.tool(
    "legalai_get_article",
    "Retrieve a specific article by number from a legislation.",
    {
      legislationId: z.string().describe("Legislation identifier"),
      article: z.string().describe("Article number (e.g. '6', '52')"),
    },
    async (args) => {
      const result = await container.getArticle.execute(args.legislationId, args.article);
      if (!result) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Article ${args.article} not found in ${args.legislationId}` }) }] };
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "legalai_check_deadlines",
    "Check compliance deadlines for a legislation.",
    {
      legislationId: z.string().describe("Legislation identifier"),
      onlyUpcoming: z.boolean().default(false).describe("If true, only return future deadlines"),
    },
    async (args) => {
      const result = await container.getDeadlines.execute(args.legislationId);
      const deadlines = args.onlyUpcoming ? result.deadlines.filter((d: any) => !d.isPast) : result.deadlines;
      return { content: [{ type: "text" as const, text: JSON.stringify({ deadlines, nextMilestone: result.nextMilestone }, null, 2) }] };
    },
  );

  server.tool(
    "legalai_answer_question",
    "Answer a question about a legislation using semantic search over the FAQ knowledge base.",
    {
      legislationId: z.string().describe("Legislation identifier"),
      question: z.string().describe("The question to answer"),
    },
    async (args) => {
      const result = await container.answerQuestion.execute(args.legislationId, args.question);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "legalai_run_assessment",
    "Run a compliance assessment with provided inputs.",
    {
      legislationId: z.string().describe("Legislation identifier"),
      assessmentId: z.string().describe("Assessment identifier"),
      input: z.record(z.unknown()).describe("Assessment input fields"),
    },
    async (args) => {
      const result = container.runAssessment.execute(args.legislationId, args.assessmentId, args.input);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "legalai_list_legislations",
    "List all available legislations in the database.",
    {},
    async () => {
      const result = await container.listLegislations.execute();
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "legalai_generate_audit_report",
    "Generate a complete compliance assessment report for an AI system.",
    {
      legislationId: z.string().default("eu-ai-act").describe("Legislation to assess against"),
      systemDescription: z.string().describe("Description of the AI system"),
      role: z.enum(["provider", "deployer", "unknown"]).default("unknown").describe("Role in the AI value chain"),
      signals: z.record(z.unknown()).optional().describe("Structured classification signals"),
      annualTurnoverEur: z.number().optional().describe("Annual global turnover in EUR"),
      isSme: z.boolean().optional().describe("SME/startup status"),
    },
    async (args) => {
      const report = await container.generateAuditReport.execute(args);
      return { content: [{ type: "text" as const, text: JSON.stringify(report, null, 2) }] };
    },
  );

  server.tool(
    "legalai_get_article_history",
    "Retrieve the full revision history of an article.",
    {
      articleId: z.string().describe("Article identifier"),
    },
    async (args) => {
      try {
        const history = await container.getArticleHistory.execute(args.articleId);
        return { content: [{ type: "text" as const, text: JSON.stringify(history, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: (err as Error).message }) }] };
      }
    },
  );

  server.tool(
    "legalai_get_derivation_chain",
    "Retrieve the source articles an obligation derives from.",
    {
      obligationId: z.string().describe("Obligation identifier"),
    },
    async (args) => {
      try {
        const chain = await container.getDerivationChain.execute(args.obligationId);
        return { content: [{ type: "text" as const, text: JSON.stringify(chain, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: (err as Error).message }) }] };
      }
    },
  );

  server.tool(
    "legalai_get_article_extracts",
    "Retrieve the typed facts extracted from an article's verbatim text.",
    {
      articleId: z.string().describe("Article identifier"),
      extractType: z.enum([
        "fine_amount_eur", "turnover_percentage", "date",
        "article_cross_ref", "annex_cross_ref", "shall_clause", "annex_item",
      ]).optional().describe("Optional filter by extract type"),
    },
    async (args) => {
      try {
        const extracts = await container.getArticleExtracts.execute(args.articleId, args.extractType);
        return { content: [{ type: "text" as const, text: JSON.stringify(extracts, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: (err as Error).message }) }] };
      }
    },
  );
}

export function mountMcpSse(app: Express, container: Container): void {
  app.get("/mcp/sse", async (req: Request, res: Response) => {
    logger.info("New MCP SSE connection");

    const server = new McpServer({
      name: SERVER_NAME,
      version: SERVER_VERSION,
    });
    registerMcpTools(server, container);

    const transport = new SSEServerTransport("/mcp/messages", res);
    sessions.set(transport.sessionId, transport);

    // Clean up on disconnect
    res.on("close", () => {
      sessions.delete(transport.sessionId);
      logger.info({ sessionId: transport.sessionId }, "MCP SSE session closed");
    });

    await server.connect(transport);
    logger.info({ sessionId: transport.sessionId }, "MCP SSE session connected");
  });

  app.post("/mcp/messages", async (req: Request, res: Response) => {
    const sessionId = req.query.sessionId as string | undefined;
    if (!sessionId) {
      res.status(400).json({ error: "Missing sessionId query parameter" });
      return;
    }

    const transport = sessions.get(sessionId);
    if (!transport) {
      res.status(404).json({ error: "Unknown session" });
      return;
    }

    await transport.handlePostMessage(req, res);
  });

  logger.info("MCP SSE endpoints mounted at /mcp/sse and /mcp/messages");
}

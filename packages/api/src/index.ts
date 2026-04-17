import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { desc, sql, count } from "drizzle-orm";
import { logger } from "./logger.js";
import { setup } from "@lexius/infra";
import { articles, legislations, articleExtracts } from "@lexius/db";
import { createApiRouter } from "./routes/index.js";
import { swarmRoutes } from "./routes/swarm.js";
import { errorHandler, rateLimiter, requestSizeLimit, apiKeyAuth } from "./middleware/index.js";
import { provenanceMetadata } from "./middleware/provenance-metadata.js";
import { mountMcpSse } from "./mcp-sse.js";

const { container, pool, db } = setup();

const app: Express = express();
app.use(cors());
app.use(express.json());
app.use((pinoHttp as any)({ logger }));
app.use(requestSizeLimit(1_048_576));  // 1MB
app.use(rateLimiter({ windowMs: 60_000, max: 100 }));

/* ------------------------------------------------------------------ */
/* Health endpoint with DB stats (cached 60s) — unauthenticated       */
/* ------------------------------------------------------------------ */
const startTime = Date.now();
let healthCache: { data: Record<string, unknown>; loadedAt: number } | null = null;
const HEALTH_CACHE_TTL = 60_000; // 60 seconds

app.get("/health", async (_req, res) => {
  const now = Date.now();
  if (healthCache && now - healthCache.loadedAt < HEALTH_CACHE_TTL) {
    res.json({ ...healthCache.data, uptime: Math.floor((now - startTime) / 1000) });
    return;
  }

  try {
    const [legCount] = await db.select({ value: count() }).from(legislations);
    const [artCount] = await db.select({ value: count() }).from(articles);
    const [extCount] = await db.select({ value: count() }).from(articleExtracts);
    const [latest] = await db
      .select({ fetchedAt: articles.fetchedAt })
      .from(articles)
      .orderBy(desc(articles.fetchedAt))
      .limit(1);

    const data: Record<string, unknown> = {
      status: "ok",
      version: "0.3.0",
      database: "connected",
      legislations: legCount?.value ?? 0,
      articles: artCount?.value ?? 0,
      extracts: extCount?.value ?? 0,
      lastFetchedAt: latest?.fetchedAt?.toISOString() ?? null,
    };

    healthCache = { data, loadedAt: now };
    res.json({ ...data, uptime: Math.floor((now - startTime) / 1000) });
  } catch (err) {
    res.status(503).json({
      status: "degraded",
      version: "0.3.0",
      uptime: Math.floor((now - startTime) / 1000),
      database: "disconnected",
      error: (err as Error).message,
    });
  }
});

/* ------------------------------------------------------------------ */
/* Integration manifest endpoint                                      */
/* ------------------------------------------------------------------ */
let manifestCache: { json: string; loadedAt: number } | null = null;
const MANIFEST_CACHE_TTL = 300_000; // 5 minutes

app.get("/integration-manifest.json", async (_req, res) => {
  const now = Date.now();
  if (manifestCache && now - manifestCache.loadedAt < MANIFEST_CACHE_TTL) {
    res.setHeader("Content-Type", "application/json");
    res.send(manifestCache.json);
    return;
  }

  try {
    // Dynamic import to avoid hard-wiring @lexius/agent into the API at module load
    const { loadAgentConfig } = await import("@robotixai/lexius-agent");
    const config = await loadAgentConfig(container);

    const manifest = buildManifest(config);
    const json = JSON.stringify(manifest, null, 2);
    manifestCache = { json, loadedAt: now };
    res.setHeader("Content-Type", "application/json");
    res.send(json);
  } catch (err) {
    logger.error(err, "Failed to generate integration manifest");
    res.status(500).json({ error: "Failed to generate manifest" });
  }
});

function buildManifest(config: { legislationIds: string[]; violationTypes: string[]; roles: string[]; riskLevels: string[] }) {
  return {
    schema_version: "1",
    name: "Lexius Compliance",
    description:
      "AI regulatory compliance database with provenance-tracked obligations, penalties, deadlines, and verbatim regulation text for EU AI Act and DORA.",
    auth: {
      type: "api_key",
      header: "Authorization",
      prefix: "Bearer ",
    },
    base_url: process.env.LEXIUS_API_URL || "https://your-lexius-instance.example.com",
    mcp_sse_url: (process.env.LEXIUS_API_URL || "https://your-lexius-instance.example.com") + "/mcp/sse",
    tools: [
      {
        name: "legalai_classify_system",
        description: "Classify an AI system under a legislation framework.",
        input_schema: {
          type: "object",
          properties: {
            legislationId: { type: "string", enum: config.legislationIds },
            description: { type: "string" },
            useCase: { type: "string" },
            role: { type: "string", enum: ["provider", "deployer", "unknown"] },
            signals: { type: "object" },
          },
          required: ["legislationId"],
        },
      },
      {
        name: "legalai_get_obligations",
        description: "Get compliance obligations filtered by legislation, role, and risk level.",
        input_schema: {
          type: "object",
          properties: {
            legislationId: { type: "string", enum: config.legislationIds },
            role: { type: "string", enum: config.roles },
            riskLevel: { type: "string", enum: config.riskLevels },
          },
          required: ["legislationId"],
        },
      },
      {
        name: "legalai_calculate_penalty",
        description: "Calculate potential penalties for a specific violation type.",
        input_schema: {
          type: "object",
          properties: {
            legislationId: { type: "string", enum: config.legislationIds },
            violationType: { type: "string", enum: config.violationTypes },
            annualTurnoverEur: { type: "number" },
            isSme: { type: "boolean" },
          },
          required: ["legislationId", "violationType", "annualTurnoverEur"],
        },
      },
      {
        name: "legalai_search_knowledge",
        description: "Semantic search across the legislation knowledge base.",
        input_schema: {
          type: "object",
          properties: {
            legislationId: { type: "string", enum: config.legislationIds },
            query: { type: "string" },
            limit: { type: "number" },
            entityType: { type: "string", enum: ["article", "obligation", "faq", "risk-category"] },
          },
          required: ["legislationId", "query", "entityType"],
        },
      },
      {
        name: "legalai_get_article",
        description: "Retrieve a specific article by number from a legislation.",
        input_schema: {
          type: "object",
          properties: {
            legislationId: { type: "string", enum: config.legislationIds },
            article: { type: "string" },
          },
          required: ["legislationId", "article"],
        },
      },
      {
        name: "legalai_check_deadlines",
        description: "Check compliance deadlines for a legislation.",
        input_schema: {
          type: "object",
          properties: {
            legislationId: { type: "string", enum: config.legislationIds },
            onlyUpcoming: { type: "boolean" },
          },
          required: ["legislationId"],
        },
      },
      {
        name: "legalai_answer_question",
        description: "Answer a question using the FAQ knowledge base.",
        input_schema: {
          type: "object",
          properties: {
            legislationId: { type: "string", enum: config.legislationIds },
            question: { type: "string" },
          },
          required: ["legislationId", "question"],
        },
      },
      {
        name: "legalai_run_assessment",
        description: "Run a structured compliance assessment.",
        input_schema: {
          type: "object",
          properties: {
            legislationId: { type: "string", enum: config.legislationIds },
            assessmentId: { type: "string" },
            input: { type: "object" },
          },
          required: ["legislationId", "assessmentId"],
        },
      },
      {
        name: "legalai_list_legislations",
        description: "List all available legislations in the database.",
        input_schema: { type: "object", properties: {}, required: [] },
      },
      {
        name: "legalai_generate_audit_report",
        description: "Generate a complete compliance assessment report for an AI system.",
        input_schema: {
          type: "object",
          properties: {
            legislationId: { type: "string", enum: config.legislationIds },
            systemDescription: { type: "string" },
            role: { type: "string", enum: ["provider", "deployer", "unknown"] },
            signals: { type: "object" },
            annualTurnoverEur: { type: "number" },
            isSme: { type: "boolean" },
            enhanced: { type: "boolean" },
          },
          required: ["legislationId", "systemDescription"],
        },
      },
      {
        name: "legalai_get_article_history",
        description: "Retrieve the full revision history of an article.",
        input_schema: {
          type: "object",
          properties: {
            articleId: { type: "string" },
          },
          required: ["articleId"],
        },
      },
      {
        name: "legalai_get_derivation_chain",
        description: "Retrieve the source articles an obligation derives from.",
        input_schema: {
          type: "object",
          properties: {
            obligationId: { type: "string" },
          },
          required: ["obligationId"],
        },
      },
      {
        name: "legalai_get_article_extracts",
        description: "Retrieve typed facts extracted from an article's verbatim text.",
        input_schema: {
          type: "object",
          properties: {
            articleId: { type: "string" },
            extractType: {
              type: "string",
              enum: ["fine_amount_eur", "turnover_percentage", "date", "article_cross_ref", "annex_cross_ref", "shall_clause", "annex_item"],
            },
          },
          required: ["articleId"],
        },
      },
    ],
    metadata: {
      categories: ["legal", "compliance", "regulation", "ai-governance"],
      icon_url: "https://your-lexius-instance.example.com/icon.png",
      privacy_policy_url: "https://lexius.ai/privacy",
      terms_url: "https://lexius.ai/terms",
      example_prompts: [
        "Classify my AI recruitment system under the EU AI Act",
        "What penalties does a provider face for high-risk non-compliance?",
        "What are the upcoming EU AI Act deadlines?",
        "Show me the verbatim text of Article 9",
        "What fines are extracted from Article 99?",
      ],
    },
  };
}

/* ------------------------------------------------------------------ */
/* Auth middleware — all routes below require API key                  */
/* ------------------------------------------------------------------ */
app.use(apiKeyAuth({ db }));

/* ------------------------------------------------------------------ */
/* REST API routes                                                    */
/* ------------------------------------------------------------------ */
app.use("/api/v1", provenanceMetadata(db), createApiRouter(container));
app.use("/api/v1", provenanceMetadata(db), swarmRoutes(container));

/* ------------------------------------------------------------------ */
/* MCP SSE transport                                                  */
/* ------------------------------------------------------------------ */
mountMcpSse(app, container);

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info({ port: PORT }, "legal-ai API server started");
});

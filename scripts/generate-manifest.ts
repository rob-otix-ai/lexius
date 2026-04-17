/**
 * Generate the Lexius integration manifest from live DB state.
 *
 * Usage:
 *   pnpm generate-manifest > integration-manifest.json
 *
 * Connects to the DB via @lexius/infra, loads dynamic enums via
 * @lexius/agent's loadAgentConfig, builds the manifest JSON, and
 * prints it to stdout.
 */
import { setup } from "@lexius/infra";
import { loadAgentConfig } from "@lexius/agent";

async function main() {
  const { container, pool } = setup();
  const config = await loadAgentConfig(container);

  const baseUrl = process.env.LEXIUS_API_URL;

  const manifest = {
    schema_version: "1",
    name: "Lexius Compliance",
    description:
      "AI regulatory compliance database with provenance-tracked obligations, penalties, deadlines, and verbatim regulation text for EU AI Act and DORA.",
    auth: {
      type: "api_key",
      header: "Authorization",
      prefix: "Bearer ",
    },
    base_url: baseUrl,
    mcp_sse_url: `${baseUrl}/mcp/sse`,
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
          properties: { articleId: { type: "string" } },
          required: ["articleId"],
        },
      },
      {
        name: "legalai_get_derivation_chain",
        description: "Retrieve the source articles an obligation derives from.",
        input_schema: {
          type: "object",
          properties: { obligationId: { type: "string" } },
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
              enum: [
                "fine_amount_eur",
                "turnover_percentage",
                "date",
                "article_cross_ref",
                "annex_cross_ref",
                "shall_clause",
                "annex_item",
              ],
            },
          },
          required: ["articleId"],
        },
      },
    ],
    metadata: {
      categories: ["legal", "compliance", "regulation", "ai-governance"],
      icon_url: "https://api.lexius.ai/icon.png",
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

  console.log(JSON.stringify(manifest, null, 2));
  await pool.end();
}

main().catch((err) => {
  console.error("Failed to generate manifest:", err);
  process.exit(1);
});

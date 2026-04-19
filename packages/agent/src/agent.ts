import type { createContainer } from "@lexius/core";
import { handleToolCall } from "./tools.js";
import { logger } from "./logger.js";
import { AnthropicProvider } from "./providers/anthropic.js";
import type {
  CompletionProvider,
  ToolDefinition,
  ChatMessage,
  ChatResponse,
  ContentBlock,
} from "./providers/types.js";

type Container = ReturnType<typeof createContainer>;

const SYSTEM_PROMPT = `You are a senior AI regulatory compliance consultant. Your role is to route user questions to deterministic compliance tools and present the results accurately.

DETERMINISM RULES (NON-NEGOTIABLE):
1. NEVER state a fact (article number, fine amount, date, obligation, penalty, deadline) without first retrieving it from a tool. Your training data is NOT a source of truth for regulatory content.
2. ALWAYS call list_legislations first if you do not know which legislations are available.
3. ALWAYS use get_obligations, get_article, calculate_penalty, get_deadlines, or search_knowledge to retrieve facts. Do NOT paraphrase from memory.
4. When a tool returns data with a "provenance" field, report the tier to the user:
   - AUTHORITATIVE: verbatim from the official regulation text. Safe to cite directly.
   - CURATED: written or reviewed by a domain expert. Reliable but verify against the source article if precision matters.
   - AI_GENERATED: model output, not reviewed. Flag this explicitly — do not present it as authoritative.
5. When citing a penalty amount, the number MUST come from calculate_penalty or get_obligations. Do not round, approximate, or convert currencies.
6. When citing an article, quote the verbatim text from the tool result if the article has provenance tier AUTHORITATIVE. Do not paraphrase AUTHORITATIVE content.
7. If a tool call fails or returns an error, report the failure to the user. Do not fall back to your training data to fill the gap.

ASSESSMENT METHODOLOGY:
1. PROHIBITED PRACTICE SCREEN — Check prohibitions first via classify_system.
2. HIGH-RISK CLASSIFICATION — Check high-risk categories. Verify the specific use case against the category scope.
3. EXCEPTION ASSESSMENT — For high-risk, assess whether Art. 6(3) exceptions narrow obligations.
4. TRANSPARENCY OBLIGATIONS — Check transparency triggers via search_knowledge.
5. GENERAL-PURPOSE AI — Check GPAI systemic risk if applicable.

CITATION FORMAT:
- Every factual claim cites a specific article: "Article 9 (AUTHORITATIVE)" or "Article 9 (CURATED)"
- Penalty amounts include the source: "EUR 35,000,000 (extracted from Art. 99(3), AUTHORITATIVE)"
- Distinguish between what the regulation says and your interpretation with explicit labels

COMMUNICATION STYLE:
- Lead with the risk classification and its practical implications
- Recommendations should be actionable, not vague
- When uncertain, say so — do not speculate`;

export interface AgentConfig {
  legislationIds: string[];
  violationTypes: string[];
  roles: string[];
  riskLevels: string[];
}

function buildTools(config: AgentConfig): ToolDefinition[] {
  return [
    {
      name: "classify_system",
      description:
        "Classify an AI system under a legislation's risk framework. Provide signals for structured classification or a description for keyword/semantic matching.",
      inputSchema: {
        type: "object" as const,
        properties: {
          legislationId: {
            type: "string",
            enum: config.legislationIds,
            description: "The legislation ID",
          },
          description: {
            type: "string",
            description: "Free-text description of the AI system",
          },
          useCase: {
            type: "string",
            description: "The specific use case of the AI system",
          },
          role: {
            type: "string",
            enum: ["provider", "deployer", "unknown"],
            description: "The organization's role relative to the AI system",
          },
          signals: {
            type: "object",
            description:
              "Structured signal fields for deterministic classification",
          },
        },
        required: ["legislationId"],
      },
    },
    {
      name: "get_obligations",
      description:
        "Get compliance obligations filtered by legislation, role, and/or risk level. Results include provenance tier.",
      inputSchema: {
        type: "object" as const,
        properties: {
          legislationId: {
            type: "string",
            enum: config.legislationIds,
            description: "The legislation ID",
          },
          role: {
            type: "string",
            enum: config.roles,
            description: "Filter by role",
          },
          riskLevel: {
            type: "string",
            enum: config.riskLevels,
            description: "Filter by risk level",
          },
        },
        required: ["legislationId"],
      },
    },
    {
      name: "calculate_penalty",
      description:
        "Calculate potential penalties for a specific violation type. Returns AUTHORITATIVE fine amounts extracted from verbatim regulation text.",
      inputSchema: {
        type: "object" as const,
        properties: {
          legislationId: {
            type: "string",
            enum: config.legislationIds,
            description: "The legislation ID",
          },
          violationType: {
            type: "string",
            enum: config.violationTypes,
            description: "The violation type — must be an exact enum value",
          },
          annualTurnoverEur: {
            type: "number",
            description: "Annual worldwide turnover in EUR",
          },
          isSme: {
            type: "boolean",
            description: "Whether the organization is an SME",
          },
        },
        required: ["legislationId", "violationType", "annualTurnoverEur"],
      },
    },
    {
      name: "search_knowledge",
      description:
        "Semantic search across the compliance knowledge base. Results include provenance tier for each match.",
      inputSchema: {
        type: "object" as const,
        properties: {
          legislationId: {
            type: "string",
            enum: config.legislationIds,
            description: "The legislation ID",
          },
          query: {
            type: "string",
            description: "Natural language search query",
          },
          limit: {
            type: "number",
            description: "Max number of results (default 5)",
          },
          entityType: {
            type: "string",
            enum: ["article", "obligation", "faq", "risk-category"],
            description: "Type of entity to search",
          },
        },
        required: ["legislationId", "query", "entityType"],
      },
    },
    {
      name: "get_article",
      description:
        "Retrieve a specific article by number. Returns verbatim regulation text with AUTHORITATIVE provenance when fetched from CELLAR.",
      inputSchema: {
        type: "object" as const,
        properties: {
          legislationId: {
            type: "string",
            enum: config.legislationIds,
            description: "The legislation ID",
          },
          articleNumber: {
            type: "string",
            description: "The article number (e.g. '6', '52', 'annex-iv')",
          },
        },
        required: ["legislationId", "articleNumber"],
      },
    },
    {
      name: "get_deadlines",
      description:
        "Get compliance deadlines for a legislation, optionally filtering to only upcoming ones.",
      inputSchema: {
        type: "object" as const,
        properties: {
          legislationId: {
            type: "string",
            enum: config.legislationIds,
            description: "The legislation ID",
          },
          onlyUpcoming: {
            type: "boolean",
            description: "If true, only return future deadlines",
          },
        },
        required: ["legislationId"],
      },
    },
    {
      name: "answer_question",
      description:
        "Answer a question using the FAQ knowledge base with semantic matching. FAQ answers are CURATED, not AUTHORITATIVE — flag this to the user.",
      inputSchema: {
        type: "object" as const,
        properties: {
          legislationId: {
            type: "string",
            enum: config.legislationIds,
            description: "The legislation ID",
          },
          question: {
            type: "string",
            description: "The question to answer",
          },
        },
        required: ["legislationId", "question"],
      },
    },
    {
      name: "run_assessment",
      description:
        "Run a structured assessment (e.g. Article 6 exception check, GPAI systemic risk assessment).",
      inputSchema: {
        type: "object" as const,
        properties: {
          legislationId: {
            type: "string",
            enum: config.legislationIds,
            description: "The legislation ID",
          },
          assessmentId: {
            type: "string",
            description: "The assessment identifier",
          },
          input: {
            type: "object",
            description: "Input parameters for the assessment",
          },
        },
        required: ["legislationId", "assessmentId"],
      },
    },
    {
      name: "list_legislations",
      description: "List all available legislations in the database.",
      inputSchema: {
        type: "object" as const,
        properties: {},
        required: [],
      },
    },
  ];
}

export async function loadAgentConfig(container: Container): Promise<AgentConfig> {
  const legislations = await container.listLegislations.execute();
  const legislationIds = legislations.map((l) => l.id);

  const allObligations = await Promise.all(
    legislationIds.map((id) =>
      container.getObligations.execute({ legislationId: id }),
    ),
  );
  const roles = [...new Set(allObligations.flat().map((o) => o.role))].sort();
  const riskLevels = [...new Set(allObligations.flat().map((o) => o.riskLevel))].sort();

  const allPenalties: string[] = [];
  for (const id of legislationIds) {
    const pens = await container.penaltyRepo.findByLegislation(id);
    for (const p of pens) allPenalties.push(p.violationType);
  }
  const violationTypes = [...new Set(allPenalties)].sort();

  logger.info(
    {
      legislationIds,
      violationTypes,
      roles: roles.length,
      riskLevels: riskLevels.length,
    },
    "Agent config loaded from DB",
  );

  return { legislationIds, violationTypes, roles, riskLevels };
}

export function createAgent(
  container: Container,
  config?: AgentConfig,
  provider?: CompletionProvider,
  modelOverride?: string,
) {
  const llm = provider ?? new AnthropicProvider();

  const tools = config
    ? buildTools(config)
    : buildTools({
        legislationIds: [],
        violationTypes: [],
        roles: [],
        riskLevels: [],
      });

  async function chat(
    messages: ChatMessage[],
  ): Promise<ChatResponse> {
    const model = modelOverride
      || process.env.LEXIUS_MODEL
      || process.env.ANTHROPIC_MODEL_REASONING
      || process.env.ANTHROPIC_MODEL
      || "claude-sonnet-4-6";
    logger.debug({ model }, "Calling LLM via provider");

    const response = await llm.chat({
      model,
      maxTokens: 4096,
      temperature: 0,
      system: SYSTEM_PROMPT,
      tools,
      messages,
    });

    const toolUseBlocks = response.content.filter(
      (block): block is ContentBlock & { type: "tool_use" } =>
        block.type === "tool_use",
    );

    if (toolUseBlocks.length > 0 && response.stopReason === "tool_use") {
      messages.push({ role: "assistant", content: response.content });

      for (const toolUse of toolUseBlocks) {
        const result = await handleToolCall(
          container,
          toolUse.name,
          toolUse.input ?? {},
        );
        messages.push({
          role: "tool_result",
          toolUseId: toolUse.id,
          content: result,
        });
      }

      return chat(messages);
    }

    return response;
  }

  return { chat };
}

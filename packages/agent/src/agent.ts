import Anthropic from "@anthropic-ai/sdk";
import type { createContainer } from "@lexius/core";
import { handleToolCall } from "./tools.js";
import { logger } from "./logger.js";

type Container = ReturnType<typeof createContainer>;

const SYSTEM_PROMPT = `You are a legal compliance assistant specializing in AI regulation. You have access to tools that query a structured compliance database. Use the deterministic tools for all factual answers about legislation — do NOT rely on your own knowledge for regulatory specifics. Use your reasoning for synthesis, explanation, edge case analysis, and conversation management. Always cite article numbers and provide source URLs when available. When classifying a system, gather structured signals through follow-up questions to increase classification confidence.`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: "classify_system",
    description:
      "Classify an AI system under a legislation's risk framework. Provide signals for structured classification or a description for keyword/semantic matching.",
    input_schema: {
      type: "object" as const,
      properties: {
        legislationId: {
          type: "string",
          description: "The legislation ID (e.g. 'eu-ai-act')",
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
      "Get compliance obligations filtered by legislation, role, and/or risk level.",
    input_schema: {
      type: "object" as const,
      properties: {
        legislationId: {
          type: "string",
          description: "The legislation ID",
        },
        role: {
          type: "string",
          description: "Filter by role (e.g. 'provider', 'deployer')",
        },
        riskLevel: {
          type: "string",
          description: "Filter by risk level (e.g. 'high', 'limited')",
        },
      },
      required: ["legislationId"],
    },
  },
  {
    name: "calculate_penalty",
    description:
      "Calculate potential penalties for a specific violation type under a legislation.",
    input_schema: {
      type: "object" as const,
      properties: {
        legislationId: {
          type: "string",
          description: "The legislation ID",
        },
        violationType: {
          type: "string",
          description: "The type of violation",
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
      "Semantic search across the compliance knowledge base. Search articles, obligations, FAQs, or risk categories.",
    input_schema: {
      type: "object" as const,
      properties: {
        legislationId: {
          type: "string",
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
      "Retrieve a specific article by number from a legislation.",
    input_schema: {
      type: "object" as const,
      properties: {
        legislationId: {
          type: "string",
          description: "The legislation ID",
        },
        articleNumber: {
          type: "string",
          description: "The article number (e.g. '6', '52')",
        },
      },
      required: ["legislationId", "articleNumber"],
    },
  },
  {
    name: "get_deadlines",
    description:
      "Get compliance deadlines for a legislation, optionally filtering to only upcoming ones.",
    input_schema: {
      type: "object" as const,
      properties: {
        legislationId: {
          type: "string",
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
      "Answer a question about a legislation using the FAQ knowledge base with semantic matching.",
    input_schema: {
      type: "object" as const,
      properties: {
        legislationId: {
          type: "string",
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
    input_schema: {
      type: "object" as const,
      properties: {
        legislationId: {
          type: "string",
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
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
];

export function createAgent(container: Container) {
  const client = new Anthropic();

  async function chat(
    messages: Anthropic.MessageParam[],
  ): Promise<Anthropic.Message> {
    logger.debug({ model: "claude-sonnet-4-6" }, "Calling Anthropic API");

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
    });

    // Process tool use blocks
    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ContentBlockParam & { type: "tool_use" } =>
        block.type === "tool_use",
    );

    if (toolUseBlocks.length > 0 && response.stop_reason === "tool_use") {
      // Append the assistant message with tool use
      messages.push({ role: "assistant", content: response.content });

      // Execute each tool call and collect results
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const toolUse of toolUseBlocks) {
        const result = await handleToolCall(
          container,
          toolUse.name,
          (toolUse.input as Record<string, unknown>) ?? {},
        );
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: result,
        });
      }

      // Append tool results and re-call
      messages.push({ role: "user", content: toolResults });
      return chat(messages);
    }

    return response;
  }

  return { chat };
}

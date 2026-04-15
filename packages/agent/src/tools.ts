import type { createContainer } from "@lexius/core";
import { logger } from "./logger.js";

type Container = ReturnType<typeof createContainer>;

function getString(
  input: Record<string, unknown>,
  key: string,
  defaultValue?: string,
): string {
  const val = input[key];
  if (typeof val === "string") return val;
  if (defaultValue !== undefined) return defaultValue;
  throw new Error(`Missing required string field: ${key}`);
}

function getNumber(input: Record<string, unknown>, key: string): number {
  const val = input[key];
  if (typeof val === "number") return val;
  throw new Error(`Missing required number field: ${key}`);
}

function getBoolean(
  input: Record<string, unknown>,
  key: string,
  defaultValue = false,
): boolean {
  const val = input[key];
  if (typeof val === "boolean") return val;
  return defaultValue;
}

function getOptionalString(
  input: Record<string, unknown>,
  key: string,
): string | undefined {
  const val = input[key];
  if (typeof val === "string") return val;
  return undefined;
}

function getOptionalNumber(
  input: Record<string, unknown>,
  key: string,
): number | undefined {
  const val = input[key];
  if (typeof val === "number") return val;
  return undefined;
}

function getOptionalObject(
  input: Record<string, unknown>,
  key: string,
): Record<string, unknown> | undefined {
  const val = input[key];
  if (val !== null && val !== undefined && typeof val === "object" && !Array.isArray(val)) {
    return val as Record<string, unknown>;
  }
  return undefined;
}

export async function handleToolCall(
  container: Container,
  toolName: string,
  toolInput: Record<string, unknown>,
): Promise<string> {
  try {
    logger.info({ tool: toolName }, "Executing tool");
    const result = await executeToolCall(container, toolName, toolInput);
    logger.info({ tool: toolName }, "Tool completed");
    return JSON.stringify(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ tool: toolName, err: error }, "Tool failed");
    return JSON.stringify({ error: message });
  }
}

async function executeToolCall(
  container: Container,
  toolName: string,
  toolInput: Record<string, unknown>,
): Promise<unknown> {
  switch (toolName) {
    case "classify_system":
      return container.classifySystem.execute({
        legislationId: getString(toolInput, "legislationId"),
        description: getOptionalString(toolInput, "description"),
        useCase: getOptionalString(toolInput, "useCase"),
        role: (getOptionalString(toolInput, "role") as "provider" | "deployer" | "unknown") ?? "unknown",
        signals: getOptionalObject(toolInput, "signals"),
      });

    case "get_obligations":
      return container.getObligations.execute({
        legislationId: getString(toolInput, "legislationId"),
        role: getOptionalString(toolInput, "role"),
        riskLevel: getOptionalString(toolInput, "riskLevel"),
      });

    case "calculate_penalty":
      return container.calculatePenalty.execute({
        legislationId: getString(toolInput, "legislationId"),
        violationType: getString(toolInput, "violationType"),
        annualTurnoverEur: getNumber(toolInput, "annualTurnoverEur"),
        isSme: getBoolean(toolInput, "isSme", false),
      });

    case "search_knowledge":
      return container.searchKnowledge.execute({
        legislationId: getString(toolInput, "legislationId"),
        query: getString(toolInput, "query"),
        limit: getOptionalNumber(toolInput, "limit") ?? 5,
        entityType: getString(toolInput, "entityType") as
          | "article"
          | "obligation"
          | "faq"
          | "risk-category",
      });

    case "get_article":
      return container.getArticle.execute(
        getString(toolInput, "legislationId"),
        getString(toolInput, "articleNumber"),
      );

    case "get_deadlines": {
      const result = await container.getDeadlines.execute(
        getString(toolInput, "legislationId"),
      );
      if (getBoolean(toolInput, "onlyUpcoming", false)) {
        return {
          deadlines: result.deadlines.filter((d) => !d.isPast),
          nextMilestone: result.nextMilestone,
        };
      }
      return result;
    }

    case "answer_question":
      return container.answerQuestion.execute(
        getString(toolInput, "legislationId"),
        getString(toolInput, "question"),
      );

    case "run_assessment":
      return container.runAssessment.execute(
        getString(toolInput, "legislationId"),
        getString(toolInput, "assessmentId"),
        getOptionalObject(toolInput, "input") ?? {},
      );

    case "list_legislations":
      return container.listLegislations.execute();

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

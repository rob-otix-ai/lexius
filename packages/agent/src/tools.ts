import type { createContainer } from "@legal-ai/core";

type Container = ReturnType<typeof createContainer>;

export async function handleToolCall(
  container: Container,
  toolName: string,
  toolInput: Record<string, unknown>,
): Promise<string> {
  try {
    const result = await executeToolCall(container, toolName, toolInput);
    return JSON.stringify(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
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
        legislationId: toolInput.legislationId as string,
        description: toolInput.description as string | undefined,
        useCase: toolInput.useCase as string | undefined,
        role: (toolInput.role as "provider" | "deployer" | "unknown") ?? "unknown",
        signals: toolInput.signals as Record<string, unknown> | undefined,
      });

    case "get_obligations":
      return container.getObligations.execute({
        legislationId: toolInput.legislationId as string,
        role: toolInput.role as string | undefined,
        riskLevel: toolInput.riskLevel as string | undefined,
      });

    case "calculate_penalty":
      return container.calculatePenalty.execute({
        legislationId: toolInput.legislationId as string,
        violationType: toolInput.violationType as string,
        annualTurnoverEur: toolInput.annualTurnoverEur as number,
        isSme: toolInput.isSme as boolean | undefined,
      });

    case "search_knowledge":
      return container.searchKnowledge.execute({
        legislationId: toolInput.legislationId as string,
        query: toolInput.query as string,
        limit: (toolInput.limit as number) ?? 5,
        entityType: toolInput.entityType as
          | "article"
          | "obligation"
          | "faq"
          | "risk-category",
      });

    case "get_article":
      return container.getArticle.execute(
        toolInput.legislationId as string,
        toolInput.articleNumber as string,
      );

    case "get_deadlines": {
      const result = await container.getDeadlines.execute(
        toolInput.legislationId as string,
      );
      if (toolInput.onlyUpcoming) {
        return {
          deadlines: result.deadlines.filter((d) => !d.isPast),
          nextMilestone: result.nextMilestone,
        };
      }
      return result;
    }

    case "answer_question":
      return container.answerQuestion.execute(
        toolInput.legislationId as string,
        toolInput.question as string,
      );

    case "run_assessment":
      return container.runAssessment.execute(
        toolInput.legislationId as string,
        toolInput.assessmentId as string,
        (toolInput.input as Record<string, unknown>) ?? {},
      );

    case "list_legislations":
      return container.listLegislations.execute();

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

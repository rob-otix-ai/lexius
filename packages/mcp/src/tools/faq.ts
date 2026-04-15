import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

type Container = ReturnType<typeof import("@legal-ai/core").createContainer>;

export function registerFaqTool(
  server: McpServer,
  container: Container,
): void {
  server.tool(
    "legalai_answer_question",
    "Answer a question about a legislation using semantic search over the FAQ knowledge base.",
    {
      legislationId: z.string().describe("Legislation identifier"),
      question: z.string().describe("The question to answer"),
    },
    async (args) => {
      const result = await container.answerQuestion.execute(
        args.legislationId,
        args.question,
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}

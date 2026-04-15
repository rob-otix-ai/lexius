import type { Command } from "commander";
import { getContainer } from "../setup.js";
import { formatJson, formatTable } from "../formatters.js";

export function registerAssessCommand(program: Command): void {
  program
    .command("assess <assessment-id>")
    .description("Run a compliance assessment")
    .option("-l, --legislation <id>", "Legislation ID", "eu-ai-act")
    .option("-i, --input <json>", "Assessment input as JSON string", "{}")
    .option("-f, --format <format>", "Output format (json or table)", "json")
    .action(async (assessmentId: string, options) => {
      const { container, cleanup } = await getContainer();

      try {
        let input: Record<string, unknown>;
        try {
          input = JSON.parse(options.input) as Record<string, unknown>;
        } catch {
          console.error("Error: --input must be valid JSON");
          process.exit(1);
        }

        const result = container.runAssessment.execute(
          options.legislation,
          assessmentId,
          input,
        );

        if (options.format === "table") {
          formatTable(
            [
              {
                assessmentId: result.assessmentId,
                reasoning: result.reasoning,
                articles: result.relevantArticles.join(", "),
              },
            ],
            ["assessmentId", "reasoning", "articles"],
          );
        } else {
          console.log(formatJson(result));
        }
      } finally {
        await cleanup();
      }
    });
}

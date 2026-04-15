import type { Command } from "commander";
import { getContainer } from "../setup.js";
import { formatJson, formatTable } from "../formatters.js";

export function registerArticleCommand(program: Command): void {
  program
    .command("article <number>")
    .description("Look up a specific article by number")
    .option("-l, --legislation <id>", "Legislation ID", "eu-ai-act")
    .option("-f, --format <format>", "Output format (json or table)", "json")
    .action(async (number: string, options) => {
      const { container, cleanup } = await getContainer();

      try {
        const result = await container.getArticle.execute(
          options.legislation,
          number,
        );

        if (!result) {
          console.error(`Article ${number} not found.`);
          process.exit(1);
        }

        if (options.format === "table") {
          formatTable(
            [
              {
                number: result.number,
                title: result.title,
                summary: result.summary,
              },
            ],
            ["number", "title", "summary"],
          );
        } else {
          console.log(formatJson(result));
        }
      } finally {
        await cleanup();
      }
    });
}

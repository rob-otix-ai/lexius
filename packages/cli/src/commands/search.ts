import type { Command } from "commander";
import { getContainer } from "../setup.js";
import { formatJson, formatTable } from "../formatters.js";

export function registerSearchCommand(program: Command): void {
  program
    .command("search <query>")
    .description("Semantic search across legislation knowledge base")
    .option("-l, --legislation <id>", "Legislation ID", "eu-ai-act")
    .option(
      "-t, --type <type>",
      "Entity type (article, obligation, faq, risk-category)",
      "article",
    )
    .option("-n, --limit <number>", "Maximum number of results", "5")
    .option("-f, --format <format>", "Output format (json or table)", "json")
    .action(async (query: string, options) => {
      const { container, cleanup } = await getContainer();

      try {
        const limit = parseInt(options.limit, 10);
        if (isNaN(limit) || limit < 1) {
          console.error("Error: --limit must be a positive integer");
          process.exit(1);
        }

        const result = await container.searchKnowledge.execute({
          legislationId: options.legislation,
          query,
          limit,
          entityType: options.type as
            | "article"
            | "obligation"
            | "faq"
            | "risk-category",
        });

        if (options.format === "table") {
          formatTable(
            result.map((r, i) => ({
              rank: String(i + 1),
              similarity: r.similarity.toFixed(4),
              item: JSON.stringify(r.item),
            })),
            ["rank", "similarity", "item"],
          );
        } else {
          console.log(formatJson(result));
        }
      } finally {
        await cleanup();
      }
    });
}

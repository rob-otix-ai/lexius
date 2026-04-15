import type { Command } from "commander";
import { getContainer } from "../setup.js";
import { formatJson, formatTable } from "../formatters.js";

export function registerObligationsCommand(program: Command): void {
  program
    .command("obligations")
    .description("List obligations filtered by criteria")
    .option("-l, --legislation <id>", "Legislation ID", "eu-ai-act")
    .option("-r, --role <role>", "Filter by role")
    .option("-k, --risk <level>", "Filter by risk level")
    .option("-c, --category <category>", "Filter by category")
    .option("-f, --format <format>", "Output format (json or table)", "json")
    .action(async (options) => {
      const { container, cleanup } = await getContainer();

      try {
        const result = await container.getObligations.execute({
          legislationId: options.legislation,
          role: options.role,
          riskLevel: options.risk,
          category: options.category,
        });

        if (options.format === "table") {
          formatTable(
            result.map((o) => ({
              role: o.role,
              riskLevel: o.riskLevel,
              obligation: o.obligation,
              article: o.article,
              category: o.category,
            })),
            ["role", "riskLevel", "obligation", "article", "category"],
          );
        } else {
          console.log(formatJson(result));
        }
      } finally {
        await cleanup();
      }
    });
}

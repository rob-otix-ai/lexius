import type { Command } from "commander";
import { getContainer } from "../setup.js";
import { formatJson, formatTable } from "../formatters.js";

export function registerDeadlinesCommand(program: Command): void {
  program
    .command("deadlines")
    .description("List compliance deadlines for a legislation")
    .option("-l, --legislation <id>", "Legislation ID", "eu-ai-act")
    .option("-u, --upcoming", "Show only upcoming deadlines")
    .option("-f, --format <format>", "Output format (json or table)", "json")
    .action(async (options) => {
      const { container, cleanup } = await getContainer();

      try {
        const result = await container.getDeadlines.execute(
          options.legislation,
        );

        let items = result.deadlines;
        if (options.upcoming) {
          items = items.filter((d) => !d.isPast);
        }

        if (options.format === "table") {
          formatTable(
            items.map((d) => ({
              date: d.date.toISOString().split("T")[0],
              event: d.event,
              daysRemaining: d.isPast ? "PAST" : String(d.daysRemaining),
              description: d.description,
            })),
            ["date", "event", "daysRemaining", "description"],
          );
        } else {
          console.log(formatJson(items));
        }
      } finally {
        await cleanup();
      }
    });
}

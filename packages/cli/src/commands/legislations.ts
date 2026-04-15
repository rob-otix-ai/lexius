import type { Command } from "commander";
import { getContainer } from "../setup.js";
import { formatJson, formatTable } from "../formatters.js";

export function registerLegislationsCommand(program: Command): void {
  program
    .command("legislations")
    .description("List all available legislations")
    .option("-f, --format <format>", "Output format (json or table)", "json")
    .action(async (options) => {
      const { container, cleanup } = await getContainer();

      try {
        const result = await container.listLegislations.execute();

        if (options.format === "table") {
          formatTable(
            result.map((l) => ({
              id: l.id,
              name: l.name,
              jurisdiction: l.jurisdiction,
              effectiveDate: l.effectiveDate.toISOString().split("T")[0],
              version: l.version,
            })),
            ["id", "name", "jurisdiction", "effectiveDate", "version"],
          );
        } else {
          console.log(formatJson(result));
        }
      } finally {
        await cleanup();
      }
    });
}

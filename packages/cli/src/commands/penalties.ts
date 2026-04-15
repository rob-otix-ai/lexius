import type { Command } from "commander";
import { getContainer } from "../setup.js";
import { formatJson, formatTable } from "../formatters.js";

export function registerPenaltyCommand(program: Command): void {
  program
    .command("penalty")
    .description("Calculate a penalty for a violation")
    .option("-l, --legislation <id>", "Legislation ID", "eu-ai-act")
    .requiredOption("-v, --violation <type>", "Violation type")
    .requiredOption("-t, --turnover <amount>", "Annual turnover in EUR", parseFloat)
    .option("--sme", "Apply SME rules")
    .option("-f, --format <format>", "Output format (json or table)", "json")
    .action(async (options) => {
      const { container, cleanup } = await getContainer();

      try {
        const result = await container.calculatePenalty.execute({
          legislationId: options.legislation,
          violationType: options.violation,
          annualTurnoverEur: options.turnover,
          isSme: options.sme ?? false,
        });

        if (options.format === "table") {
          formatTable(
            [
              {
                tier: result.tierName,
                maxFine: result.maxFineEur.toLocaleString(),
                calculatedFine: result.calculatedFine.toLocaleString(),
                turnoverPct: `${result.globalTurnoverPercentage}%`,
                smeApplied: result.smeApplied ? "Yes" : "No",
              },
            ],
            ["tier", "maxFine", "calculatedFine", "turnoverPct", "smeApplied"],
          );
        } else {
          console.log(formatJson(result));
        }
      } finally {
        await cleanup();
      }
    });
}

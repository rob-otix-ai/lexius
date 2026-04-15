import type { Command } from "commander";
import { getContainer } from "../setup.js";
import { formatJson, formatTable } from "../formatters.js";
import { logger } from "../logger.js";

export function registerClassifyCommand(program: Command): void {
  program
    .command("classify")
    .description("Classify an AI system under a legislation framework")
    .option("-d, --description <description>", "Description of the AI system")
    .option("-l, --legislation <id>", "Legislation ID", "eu-ai-act")
    .option("-r, --role <role>", "Role (provider, deployer, unknown)", "unknown")
    .option("-s, --signals <json>", "Signals as JSON string")
    .option("-f, --format <format>", "Output format (json or table)", "json")
    .action(async (options) => {
      const { container, cleanup } = await getContainer();

      try {
        logger.debug({ description: options.description, legislation: options.legislation }, "Running classification");

        const signals = options.signals
          ? (JSON.parse(options.signals) as Record<string, unknown>)
          : undefined;

        const result = await container.classifySystem.execute({
          legislationId: options.legislation,
          description: options.description,
          role: options.role,
          signals,
        });

        if (options.format === "table") {
          formatTable(
            [
              {
                classification: result.riskClassification,
                confidence: result.confidence,
                basis: result.basis,
                role: result.roleDetermination,
                category: result.matchedCategory?.name ?? "N/A",
              },
            ],
            ["classification", "confidence", "basis", "role", "category"],
          );
        } else {
          console.log(formatJson(result));
        }
      } finally {
        await cleanup();
      }
    });
}

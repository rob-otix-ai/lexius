import type { Command } from "commander";
import { registerClassifyCommand } from "./classify.js";
import { registerDeadlinesCommand } from "./deadlines.js";
import { registerObligationsCommand } from "./obligations.js";
import { registerPenaltyCommand } from "./penalties.js";
import { registerArticleCommand } from "./articles.js";
import { registerSearchCommand } from "./search.js";
import { registerAssessCommand } from "./assess.js";
import { registerLegislationsCommand } from "./legislations.js";

export function registerCommands(program: Command): void {
  registerClassifyCommand(program);
  registerDeadlinesCommand(program);
  registerObligationsCommand(program);
  registerPenaltyCommand(program);
  registerArticleCommand(program);
  registerSearchCommand(program);
  registerAssessCommand(program);
  registerLegislationsCommand(program);
}

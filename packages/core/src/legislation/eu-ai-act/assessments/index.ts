import type { AssessmentDefinition, AssessmentOutput } from "../../../domain/value-objects/assessment.js";
import { art6ExceptionDefinition, runArt6Exception } from "./art6-exception.js";
import { gpaiSystemicRiskDefinition, runGpaiSystemicRisk } from "./gpai-systemic-risk.js";

export const assessmentDefinitions: AssessmentDefinition[] = [
  art6ExceptionDefinition,
  gpaiSystemicRiskDefinition,
];

export function runAssessment(id: string, input: Record<string, unknown>): AssessmentOutput {
  switch (id) {
    case "art6-exception":
      return runArt6Exception(input);
    case "gpai-systemic-risk":
      return runGpaiSystemicRisk(input);
    default:
      throw new Error(`Unknown assessment: ${id}`);
  }
}

import type { ClassifyOutput } from "./value-objects/classify.js";
import type { PenaltyOutput } from "./value-objects/penalty.js";
import type { Penalty } from "./entities/penalty.js";
import type { RiskCategory } from "./entities/risk-category.js";
import type { AssessmentDefinition, AssessmentOutput } from "./value-objects/assessment.js";

export interface SignalField {
  type: "boolean" | "enum" | "string";
  options?: string[];
  question: string;
  dependsOn?: Record<string, unknown>;
}

export interface SignalSchema {
  [key: string]: SignalField;
}

export interface LegislationPlugin {
  id: string;
  name: string;
  version: string;
  classifyBySignals(signals: Record<string, unknown>): ClassifyOutput | null;
  classifyByKeywords(text: string, categories: RiskCategory[]): ClassifyOutput | null;
  getSignalSchema(): SignalSchema;
  getAssessments(): AssessmentDefinition[];
  runAssessment(id: string, input: Record<string, unknown>): AssessmentOutput;
  calculatePenalty(tier: Penalty, turnover: number, isSme: boolean): PenaltyOutput;
}

export interface LegislationPluginRegistry {
  register(plugin: LegislationPlugin): void;
  get(legislationId: string): LegislationPlugin;
  list(): LegislationPlugin[];
}

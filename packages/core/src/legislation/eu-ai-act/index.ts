import type { LegislationPlugin, SignalSchema } from "../../domain/plugin.js";
import type { ClassifyOutput } from "../../domain/value-objects/classify.js";
import type { AssessmentDefinition, AssessmentOutput } from "../../domain/value-objects/assessment.js";
import type { PenaltyOutput } from "../../domain/value-objects/penalty.js";
import type { RiskCategory } from "../../domain/entities/risk-category.js";
import type { Penalty } from "../../domain/entities/penalty.js";
import { signalSchema, classifyBySignals } from "./signals.js";
import { classifyByKeywords } from "./keywords.js";
import { assessmentDefinitions, runAssessment } from "./assessments/index.js";
import { calculatePenalty } from "./penalties.js";

export class EuAiActPlugin implements LegislationPlugin {
  readonly id = "eu-ai-act";
  readonly name = "EU AI Act (Regulation 2024/1689)";
  readonly version = "1.0.0";

  classifyBySignals(signals: Record<string, unknown>): ClassifyOutput | null {
    return classifyBySignals(signals);
  }

  classifyByKeywords(text: string, categories: RiskCategory[]): ClassifyOutput | null {
    return classifyByKeywords(text, categories);
  }

  getSignalSchema(): SignalSchema {
    return signalSchema;
  }

  getAssessments(): AssessmentDefinition[] {
    return assessmentDefinitions;
  }

  runAssessment(id: string, input: Record<string, unknown>): AssessmentOutput {
    return runAssessment(id, input);
  }

  calculatePenalty(tier: Penalty, turnover: number, isSme: boolean): PenaltyOutput {
    return calculatePenalty(tier, turnover, isSme);
  }
}

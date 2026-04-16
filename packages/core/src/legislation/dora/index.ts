import type { LegislationPlugin, SignalSchema } from "../../domain/plugin.js";
import type { ClassifyOutput } from "../../domain/value-objects/classify.js";
import type { AssessmentDefinition, AssessmentOutput } from "../../domain/value-objects/assessment.js";
import type { Penalty } from "../../domain/entities/penalty.js";
import type { PenaltyOutput } from "../../domain/value-objects/penalty.js";
import type { RiskCategory } from "../../domain/entities/risk-category.js";
import { signalSchema, classifyBySignals } from "./signals.js";
import { classifyByKeywords } from "./keywords.js";
import { calculatePenalty } from "./penalties.js";
import { assessments, runAssessment } from "./assessments/index.js";

export class DoraPlugin implements LegislationPlugin {
  id = "dora";
  name = "Digital Operational Resilience Act (Regulation 2022/2554)";
  version = "1.0.0";

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
    return assessments;
  }

  runAssessment(id: string, input: Record<string, unknown>): AssessmentOutput {
    return runAssessment(id, input);
  }

  calculatePenalty(tier: Penalty, turnover: number, isSme: boolean): PenaltyOutput {
    return calculatePenalty(tier, turnover, isSme);
  }
}

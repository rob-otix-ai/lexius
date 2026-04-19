import type { LegislationPlugin, SignalSchema } from "../../domain/plugin.js";
import type { ClassifyOutput } from "../../domain/value-objects/classify.js";
import type { AssessmentDefinition, AssessmentOutput } from "../../domain/value-objects/assessment.js";
import type { Penalty } from "../../domain/entities/penalty.js";
import type { PenaltyOutput } from "../../domain/value-objects/penalty.js";
import type { RiskCategory } from "../../domain/entities/risk-category.js";

export class GenericPlugin implements LegislationPlugin {
  id: string;
  name: string;
  version = "1.0.0";

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }

  classifyBySignals(_signals: Record<string, unknown>): ClassifyOutput | null {
    return null;
  }

  classifyByKeywords(text: string, categories: RiskCategory[]): ClassifyOutput | null {
    const lower = text.toLowerCase();
    for (const cat of categories) {
      const keywords = cat.keywords ?? [];
      const matched = keywords.filter((k) => lower.includes(k.toLowerCase()));
      if (matched.length > 0) {
        return {
          riskClassification: cat.name,
          confidence: matched.length >= 3 ? "high" : matched.length >= 2 ? "medium" : "low",
          matchedCategory: { name: cat.name, level: cat.level },
          relevantArticles: cat.relevantArticles ?? [],
          roleDetermination: "Determined from description context",
          obligationsSummary: `Obligations under ${this.name} apply based on keyword match.`,
          matchedSignals: matched,
          missingSignals: [],
          nextQuestions: [],
          basis: "text",
        };
      }
    }

    return {
      riskClassification: "general",
      confidence: "low",
      matchedCategory: null,
      relevantArticles: [],
      roleDetermination: "Could not determine specific classification from description",
      obligationsSummary: `Review ${this.name} for applicable obligations.`,
      matchedSignals: [],
      missingSignals: [],
      nextQuestions: [
        "What specific activities does your system perform?",
        "Does your system process personal data of EU residents?",
      ],
      basis: "default",
    };
  }

  getSignalSchema(): SignalSchema {
    return {};
  }

  getAssessments(): AssessmentDefinition[] {
    return [];
  }

  runAssessment(_id: string, _input: Record<string, unknown>): AssessmentOutput {
    throw new Error(`No assessments available for ${this.name}`);
  }

  calculatePenalty(tier: Penalty, turnover: number, isSme: boolean): PenaltyOutput {
    const turnoverBasedFine = (tier.globalTurnoverPercentage / 100) * turnover;
    const calculatedFine = isSme
      ? Math.min(tier.maxFineEur, turnoverBasedFine)
      : Math.max(tier.maxFineEur, turnoverBasedFine);

    const basis = isSme ? "lower" : "higher";
    const explanation = `${basis.charAt(0).toUpperCase() + basis.slice(1)} of €${tier.maxFineEur.toLocaleString()} or ${tier.globalTurnoverPercentage}% of turnover (€${turnoverBasedFine.toLocaleString()}).`;

    return {
      tierName: tier.name,
      maxFineEur: tier.maxFineEur,
      calculatedFine,
      globalTurnoverPercentage: tier.globalTurnoverPercentage,
      explanation,
      smeApplied: isSme,
    };
  }
}

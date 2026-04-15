import type { LegislationPluginRegistry } from "../domain/plugin.js";
import type { ClassifyOutput } from "../domain/value-objects/classify.js";
import type { AuditInput, ComplianceReport, ReportConfidence } from "../domain/value-objects/audit.js";
import type { ClassifySystem } from "./classify-system.js";
import type { GetObligations } from "./get-obligations.js";
import type { CalculatePenalty } from "./calculate-penalty.js";
import type { RunAssessment } from "./run-assessment.js";
import type { GetDeadlines } from "./get-deadlines.js";
import type { GetArticle } from "./get-article.js";
import type { SearchKnowledge } from "./search-knowledge.js";
import type { Article } from "../domain/entities/article.js";

const recommendationsByRisk: Record<string, string[]> = {
  unacceptable: [
    "This system is prohibited. Do not deploy.",
    "Consult legal counsel for narrow exceptions.",
    "If deployed, initiate immediate withdrawal.",
  ],
  high: [
    "Establish a risk management system.",
    "Implement data governance practices.",
    "Prepare technical documentation per the regulation's requirements.",
    "Ensure human oversight mechanisms.",
    "Register the system as required.",
    "Schedule conformity assessment before the applicable deadline.",
  ],
  limited: [
    "Implement transparency obligations.",
    "Ensure users know they are interacting with an AI system.",
    "If generating synthetic content, implement labelling.",
  ],
  minimal: [
    "No mandatory obligations beyond literacy requirements.",
    "Consider voluntary codes of conduct.",
    "Monitor for regulatory updates.",
  ],
};

export class GenerateAuditReport {
  constructor(
    private readonly classifySystem: ClassifySystem,
    private readonly getObligations: GetObligations,
    private readonly calculatePenalty: CalculatePenalty,
    private readonly runAssessment: RunAssessment,
    private readonly getDeadlines: GetDeadlines,
    private readonly getArticle: GetArticle,
    private readonly searchKnowledge: SearchKnowledge,
    private readonly pluginRegistry: LegislationPluginRegistry,
  ) {}

  async execute(input: AuditInput): Promise<ComplianceReport> {
    const options = {
      includeDocumentation: true,
      includeDeadlines: true,
      includePenalties: true,
      includeRecommendations: true,
      ...input.options,
    };

    // 1. Classify
    const classification = await this.classifySystem.execute({
      legislationId: input.legislationId,
      description: input.systemDescription,
      role: input.role,
      signals: input.signals,
    });

    // 2. Determine risk level for obligation lookup
    const riskLevel = this.mapRiskLevel(classification.riskClassification);

    // 3. Get obligations
    const obligations = await this.getObligations.execute({
      legislationId: input.legislationId,
      role: classification.roleDetermination || input.role,
      riskLevel,
    });

    // 4. Run all available assessments from the plugin
    const assessments = await this.runAvailableAssessments(input);

    // 5. Calculate penalty exposure
    let penaltyExposure: ComplianceReport["penaltyExposure"] = null;
    if (options.includePenalties && input.annualTurnoverEur !== undefined) {
      penaltyExposure = await this.calculatePenaltyExposure(input, classification);
    }

    // 6. Get documentation checklist (if high-risk)
    let documentationChecklist: ComplianceReport["documentationChecklist"] = null;
    if (options.includeDocumentation && riskLevel === "high-risk") {
      documentationChecklist = await this.getDocumentationChecklist(input.legislationId);
    }

    // 7. Get deadlines
    let deadlines: ComplianceReport["deadlines"] = [];
    if (options.includeDeadlines) {
      const result = await this.getDeadlines.execute(input.legislationId);
      deadlines = result.deadlines.map((d) => ({
        date: d.date.toISOString(),
        event: d.event,
        daysRemaining: d.daysRemaining,
        isPast: d.isPast,
      }));
    }

    // 8. Search relevant articles for citations
    const citations = await this.getCitations(input);

    // 9. Generate recommendations
    const recommendations = options.includeRecommendations
      ? this.getRecommendations(classification.riskClassification)
      : [];

    // 10. Calculate confidence
    const confidence = this.calculateConfidence(input);

    // 11. Get legislation name
    const plugin = this.pluginRegistry.get(input.legislationId);

    return {
      metadata: {
        generatedAt: new Date().toISOString(),
        legislationId: input.legislationId,
        legislationName: plugin.name,
        reportVersion: "1.0.0",
      },
      systemDescription: input.systemDescription,
      classification: {
        riskLevel: classification.riskClassification,
        confidence: classification.confidence,
        basis: classification.basis,
        matchedCategory: classification.matchedCategory?.name ?? null,
        matchedSignals: classification.matchedSignals,
        missingSignals: classification.missingSignals,
      },
      obligations: obligations.map((o) => ({
        obligation: o.obligation,
        article: o.article,
        deadline: o.deadline?.toISOString() ?? null,
        category: o.category,
      })),
      assessments,
      penaltyExposure,
      documentationChecklist,
      deadlines,
      citations,
      recommendations,
      confidence,
    };
  }

  private mapRiskLevel(riskClassification: string): string {
    switch (riskClassification) {
      case "unacceptable":
        return "prohibited";
      case "high":
        return "high-risk";
      case "limited":
        return "limited";
      case "minimal":
        return "minimal";
      default:
        return "minimal";
    }
  }

  private async runAvailableAssessments(
    input: AuditInput,
  ): Promise<ComplianceReport["assessments"]> {
    const assessments: ComplianceReport["assessments"] = [];
    const plugin = this.pluginRegistry.get(input.legislationId);
    const available = plugin.getAssessments();

    for (const definition of available) {
      try {
        const result = this.runAssessment.execute(
          input.legislationId,
          definition.id,
          input.signals ?? {},
        );
        assessments.push({
          id: result.assessmentId,
          name: definition.name,
          result: result.result,
          reasoning: result.reasoning,
        });
      } catch {
        // Assessment may fail if required signals are missing — skip gracefully
      }
    }

    return assessments;
  }

  private async calculatePenaltyExposure(
    input: AuditInput,
    classification: ClassifyOutput,
  ): Promise<ComplianceReport["penaltyExposure"]> {
    const violationType =
      classification.riskClassification === "unacceptable"
        ? "prohibited"
        : "high_risk";

    try {
      const result = await this.calculatePenalty.execute({
        legislationId: input.legislationId,
        violationType,
        annualTurnoverEur: input.annualTurnoverEur!,
        isSme: input.isSme,
      });

      return {
        highestTier: result.tierName,
        maxFine: result.calculatedFine,
        explanation: result.explanation,
      };
    } catch {
      return null;
    }
  }

  private async getDocumentationChecklist(
    legislationId: string,
  ): Promise<ComplianceReport["documentationChecklist"]> {
    const checklist: NonNullable<ComplianceReport["documentationChecklist"]> = [];

    // Look for documentation items (numbered doc-1 through doc-20)
    for (let i = 1; i <= 20; i++) {
      try {
        const article = await this.getArticle.execute(legislationId, `doc-${i}`);
        if (article) {
          checklist.push({
            item: i,
            title: article.title,
            description: article.summary,
          });
        }
      } catch {
        break;
      }
    }

    // Fallback: try numbered format specific to the legislation's convention
    if (checklist.length === 0) {
      for (let i = 1; i <= 20; i++) {
        try {
          const prefixes = ["doc-", "checklist-"];
          for (const prefix of prefixes) {
            const article = await this.getArticle.execute(legislationId, `${prefix}${i}`);
            if (article) {
              checklist.push({
                item: i,
                title: article.title,
                description: article.summary,
              });
              break;
            }
          }
        } catch {
          break;
        }
      }
    }

    return checklist.length > 0 ? checklist : null;
  }

  private async getCitations(
    input: AuditInput,
  ): Promise<ComplianceReport["citations"]> {
    try {
      const results = await this.searchKnowledge.execute({
        legislationId: input.legislationId,
        query: input.systemDescription,
        entityType: "article",
        limit: 5,
      });

      return results.map((r) => {
        const article = r.item as Article;
        return {
          article: article.number,
          title: article.title,
          summary: article.summary,
          url: article.sourceUrl ?? "",
        };
      });
    } catch {
      return [];
    }
  }

  private getRecommendations(riskLevel: string): string[] {
    return recommendationsByRisk[riskLevel] ?? [
      "Provide more information for a complete assessment.",
    ];
  }

  private calculateConfidence(input: AuditInput): ReportConfidence {
    const plugin = this.pluginRegistry.get(input.legislationId);
    const schema = plugin.getSignalSchema();
    const totalSignals = Object.keys(schema).length;
    const providedSignals = input.signals ? Object.keys(input.signals).length : 0;
    const completeness = totalSignals > 0 ? providedSignals / totalSignals : 0;

    let overall: "high" | "medium" | "low";
    if (completeness >= 0.7) overall = "high";
    else if (completeness >= 0.4) overall = "medium";
    else overall = "low";

    return {
      overall,
      signalCompleteness: Math.round(completeness * 100) / 100,
      reasoning:
        completeness >= 0.7
          ? "Most structured signals provided. Classification is reliable."
          : completeness >= 0.4
            ? "Some signals provided. Classification may change with additional information."
            : "Few or no signals provided. Classification is based on text analysis and may be unreliable.",
    };
  }
}

import type { LegislationPluginRegistry } from "../domain/plugin.js";
import type { RiskCategoryRepository, ObligationRepository } from "../domain/ports/repositories.js";
import type { EmbeddingService } from "../domain/ports/embedding-service.js";
import type { ClassifyInput, ClassifyOutput } from "../domain/value-objects/classify.js";

export class ClassifySystem {
  constructor(
    private readonly pluginRegistry: LegislationPluginRegistry,
    private readonly riskCategoryRepo: RiskCategoryRepository,
    private readonly obligationRepo: ObligationRepository,
    private readonly embeddingService: EmbeddingService,
  ) {}

  async execute(input: ClassifyInput): Promise<ClassifyOutput> {
    const plugin = this.pluginRegistry.get(input.legislationId);

    // Step 1: Try signal-based classification
    if (input.signals) {
      const signalResult = plugin.classifyBySignals(input.signals);
      if (signalResult) {
        return signalResult;
      }
    }

    // Step 2: Load risk categories
    const categories = await this.riskCategoryRepo.findByLegislation(input.legislationId);

    // Step 3: Try keyword-based classification
    if (input.description) {
      const keywordResult = plugin.classifyByKeywords(input.description, categories);
      if (keywordResult) {
        return keywordResult;
      }
    }

    // Step 4: Try semantic classification
    if (input.description) {
      const embedding = await this.embeddingService.embed(input.description);
      const semanticResults = await this.riskCategoryRepo.searchSemantic(
        input.legislationId,
        embedding,
        1,
      );

      if (semanticResults.length > 0) {
        const topMatch = semanticResults[0];
        return {
          riskClassification: topMatch.item.name,
          confidence: topMatch.similarity > 0.8 ? "high" : topMatch.similarity > 0.6 ? "medium" : "low",
          matchedCategory: { name: topMatch.item.name, level: topMatch.item.level },
          relevantArticles: topMatch.item.relevantArticles,
          roleDetermination: input.role,
          obligationsSummary: `Obligations apply for ${input.role} at risk level ${topMatch.item.level}`,
          matchedSignals: [],
          missingSignals: [],
          nextQuestions: [],
          basis: "semantic",
        };
      }
    }

    // Step 5: Default result
    return {
      riskClassification: "insufficient_information",
      confidence: "low",
      matchedCategory: null,
      relevantArticles: [],
      roleDetermination: input.role,
      obligationsSummary: "Unable to determine obligations without more information",
      matchedSignals: [],
      missingSignals: [],
      nextQuestions: [
        "What is the primary purpose of your AI system?",
        "In which domain will the system operate?",
        "Does the system interact with natural persons?",
      ],
      basis: "default",
    };
  }
}

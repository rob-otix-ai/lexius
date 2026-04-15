import type { EmbeddingService } from "../domain/ports/embedding-service.js";
import type {
  ArticleRepository,
  ObligationRepository,
  FAQRepository,
  RiskCategoryRepository,
} from "../domain/ports/repositories.js";
import type { SemanticSearchInput, ScoredResult } from "../domain/value-objects/search.js";

export class SearchKnowledge {
  constructor(
    private readonly embeddingService: EmbeddingService,
    private readonly articleRepo: ArticleRepository,
    private readonly obligationRepo: ObligationRepository,
    private readonly faqRepo: FAQRepository,
    private readonly riskCategoryRepo: RiskCategoryRepository,
  ) {}

  async execute(input: SemanticSearchInput): Promise<ScoredResult<unknown>[]> {
    const embedding = await this.embeddingService.embed(input.query);

    switch (input.entityType) {
      case "article":
        return this.articleRepo.searchSemantic(input.legislationId, embedding, input.limit);
      case "obligation":
        return this.obligationRepo.searchSemantic(input.legislationId, embedding, input.limit);
      case "faq":
        return this.faqRepo.searchSemantic(input.legislationId, embedding, input.limit);
      case "risk-category":
        return this.riskCategoryRepo.searchSemantic(input.legislationId, embedding, input.limit);
    }
  }
}

import type { FAQRepository } from "../domain/ports/repositories.js";
import type { EmbeddingService } from "../domain/ports/embedding-service.js";
import type { FAQ } from "../domain/entities/faq.js";
import type { ScoredResult } from "../domain/value-objects/search.js";

export interface AnswerQuestionResult {
  found: boolean;
  answer: ScoredResult<FAQ> | null;
}

export class AnswerQuestion {
  constructor(
    private readonly faqRepo: FAQRepository,
    private readonly embeddingService: EmbeddingService,
    private readonly similarityThreshold: number = 0.5,
  ) {}

  async execute(legislationId: string, question: string): Promise<AnswerQuestionResult> {
    const embedding = await this.embeddingService.embed(question);
    const results = await this.faqRepo.searchSemantic(legislationId, embedding, 1);

    if (results.length > 0 && results[0].similarity > this.similarityThreshold) {
      return { found: true, answer: results[0] };
    }

    return { found: false, answer: null };
  }
}

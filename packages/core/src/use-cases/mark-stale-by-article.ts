import type { ObligationRepository } from "../domain/ports/index.js";

export interface MarkStaleByArticleInput {
  articleId: string;
  staleSince: Date;
}

export class MarkStaleByArticle {
  constructor(private readonly obligations: ObligationRepository) {}

  async execute(input: MarkStaleByArticleInput): Promise<number> {
    return this.obligations.markStaleByArticle(input.articleId, input.staleSince);
  }
}

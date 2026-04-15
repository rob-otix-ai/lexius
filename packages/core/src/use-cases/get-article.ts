import type { ArticleRepository } from "../domain/ports/repositories.js";
import type { Article } from "../domain/entities/article.js";

export class GetArticle {
  constructor(private readonly articleRepo: ArticleRepository) {}

  async execute(legislationId: string, number: string): Promise<Article | null> {
    return this.articleRepo.findByNumber(legislationId, number);
  }
}

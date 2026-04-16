import type { ArticleExtract } from "../domain/entities/article-extract.js";
import type { ArticleExtractRepository } from "../domain/ports/article-extract.repository.js";

export class GetArticleExtracts {
  constructor(private readonly extracts: ArticleExtractRepository) {}

  async execute(
    articleId: string,
    extractType?: ArticleExtract["extractType"],
  ): Promise<ArticleExtract[]> {
    if (extractType) {
      return this.extracts.findByArticleAndType(articleId, extractType);
    }
    return this.extracts.findByArticleId(articleId);
  }
}

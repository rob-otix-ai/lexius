import type { ArticleExtract } from "../entities/article-extract.js";

export interface ArticleExtractRepository {
  findByArticleId(articleId: string): Promise<ArticleExtract[]>;
  findByArticleAndType(
    articleId: string,
    type: ArticleExtract["extractType"],
  ): Promise<ArticleExtract[]>;
}

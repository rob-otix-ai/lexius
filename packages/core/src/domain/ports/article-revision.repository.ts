import type { ArticleRevision } from "../entities/article-revision.js";

export interface ArticleRevisionRepository {
  findByArticleId(articleId: string): Promise<ArticleRevision[]>;
}

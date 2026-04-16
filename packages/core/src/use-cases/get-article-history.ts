import type { ArticleRepository } from "../domain/ports/repositories.js";
import type { ArticleRevisionRepository } from "../domain/ports/article-revision.repository.js";

export interface ArticleHistoryEntry {
  sourceHash: string;
  title: string;
  fullText: string;
  fetchedAt: Date;
  supersededAt: Date | null;
}

export class GetArticleHistory {
  constructor(
    private readonly articles: ArticleRepository,
    private readonly revisions: ArticleRevisionRepository,
  ) {}

  async execute(articleId: string): Promise<ArticleHistoryEntry[]> {
    const current = await this.articles.findById(articleId);
    if (!current) {
      throw new Error(`Article not found: ${articleId}`);
    }

    const priors = await this.revisions.findByArticleId(articleId);

    const currentHash =
      current.provenance.tier === "AUTHORITATIVE"
        ? current.provenance.sourceHash
        : "";
    const currentFetchedAt =
      current.provenance.tier === "AUTHORITATIVE"
        ? current.provenance.fetchedAt
        : new Date(0);

    const history: ArticleHistoryEntry[] = [
      {
        sourceHash: currentHash,
        title: current.title,
        fullText: current.fullText ?? "",
        fetchedAt: currentFetchedAt,
        supersededAt: null,
      },
      ...priors.map((r) => ({
        sourceHash: r.sourceHash,
        title: r.title,
        fullText: r.fullText,
        fetchedAt: r.fetchedAt,
        supersededAt: r.supersededAt,
      })),
    ];

    // Current row first, then prior revisions newest-first
    // (revisions repo already orders by supersededAt desc).
    return history;
  }
}

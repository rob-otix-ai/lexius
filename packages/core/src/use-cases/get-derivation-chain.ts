import type {
  ObligationRepository,
  ArticleRepository,
} from "../domain/ports/repositories.js";
import type { Article } from "../domain/entities/article.js";

export interface DerivationChain {
  obligationId: string;
  sourceArticles: Article[];
}

export class GetDerivationChain {
  constructor(
    private readonly obligations: ObligationRepository,
    private readonly articles: ArticleRepository,
  ) {}

  async execute(obligationId: string): Promise<DerivationChain> {
    const obligation = await this.obligations.findById(obligationId);
    if (!obligation) {
      throw new Error(`Obligation not found: ${obligationId}`);
    }

    const sourceArticles: Article[] = [];
    for (const articleId of obligation.derivedFrom) {
      const a = await this.articles.findById(articleId);
      if (a) sourceArticles.push(a);
    }

    return { obligationId, sourceArticles };
  }
}

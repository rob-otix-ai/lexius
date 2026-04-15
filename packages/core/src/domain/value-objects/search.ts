export interface SemanticSearchInput {
  legislationId: string;
  query: string;
  limit: number;
  entityType: "article" | "obligation" | "faq" | "risk-category";
}

export interface ScoredResult<T> {
  item: T;
  similarity: number;
}

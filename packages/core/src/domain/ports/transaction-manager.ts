// Transactional scope for curator write use cases. The row update, audit
// insert, and any re-embed must share one transaction. The use case gets an
// opaque `tx` handle from the manager and uses it to construct repositories
// bound to that transaction — same surface as the default repositories.

export interface TxScope {
  obligations: import("./repositories.js").ObligationRepository;
  audit: import("./curator-edit-repository.js").CuratorEditRepository;
  articles: import("./repositories.js").ArticleRepository;
}

export interface TransactionManager {
  transactional<T>(fn: (scope: TxScope) => Promise<T>): Promise<T>;
}

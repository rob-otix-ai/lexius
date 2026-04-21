import type { Database } from "@lexius/db";
import type { TransactionManager, TxScope } from "@lexius/core";
import { DrizzleObligationRepository, DrizzleArticleRepository } from "./repositories.js";
import { DrizzleCuratorEditRepository } from "./curator-edit-repository.js";

export class DrizzleTransactionManager implements TransactionManager {
  constructor(private readonly db: Database) {}

  async transactional<T>(fn: (scope: TxScope) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      const scope: TxScope = {
        obligations: new DrizzleObligationRepository(tx as unknown as Database),
        audit: new DrizzleCuratorEditRepository(tx as unknown as Database),
        articles: new DrizzleArticleRepository(tx as unknown as Database),
      };
      return fn(scope);
    });
  }
}

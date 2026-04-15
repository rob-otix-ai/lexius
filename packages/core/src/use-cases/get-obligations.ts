import type { ObligationRepository } from "../domain/ports/repositories.js";
import type { ObligationFilter } from "../domain/value-objects/obligation-filter.js";
import type { Obligation } from "../domain/entities/obligation.js";

export class GetObligations {
  constructor(private readonly obligationRepo: ObligationRepository) {}

  async execute(filter: ObligationFilter): Promise<Obligation[]> {
    const obligations = await this.obligationRepo.findByFilter(filter);

    return obligations.sort((a, b) => {
      const categoryCompare = a.category.localeCompare(b.category);
      if (categoryCompare !== 0) return categoryCompare;
      return a.article.localeCompare(b.article);
    });
  }
}

import type { LegislationRepository } from "../domain/ports/repositories.js";
import type { Legislation } from "../domain/entities/legislation.js";

export class ListLegislations {
  constructor(private readonly legislationRepo: LegislationRepository) {}

  async execute(): Promise<Legislation[]> {
    return this.legislationRepo.findAll();
  }
}

import type { LegislationPluginRegistry } from "../domain/plugin.js";
import type { PenaltyRepository } from "../domain/ports/repositories.js";
import type { PenaltyInput, PenaltyOutput } from "../domain/value-objects/penalty.js";

export class CalculatePenalty {
  constructor(
    private readonly pluginRegistry: LegislationPluginRegistry,
    private readonly penaltyRepo: PenaltyRepository,
  ) {}

  async execute(input: PenaltyInput): Promise<PenaltyOutput> {
    const plugin = this.pluginRegistry.get(input.legislationId);
    const tier = await this.penaltyRepo.findByViolationType(input.legislationId, input.violationType);

    if (!tier) {
      throw new Error(`No penalty tier found for violation type: ${input.violationType}`);
    }

    return plugin.calculatePenalty(tier, input.annualTurnoverEur, input.isSme ?? false);
  }
}

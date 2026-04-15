import type { Penalty } from "../../domain/entities/penalty.js";
import type { PenaltyOutput } from "../../domain/value-objects/penalty.js";

export function calculatePenalty(tier: Penalty, turnover: number, isSme: boolean): PenaltyOutput {
  const turnoverBasedFine = (tier.globalTurnoverPercentage / 100) * turnover;
  let calculatedFine: number;

  if (isSme) {
    // Art. 99(6): SMEs/startups pay the lower of the two amounts
    calculatedFine = Math.min(tier.maxFineEur, turnoverBasedFine);
  } else {
    // Standard: the higher of the two amounts applies
    calculatedFine = Math.max(tier.maxFineEur, turnoverBasedFine);
  }

  return {
    tierName: tier.name,
    maxFineEur: tier.maxFineEur,
    calculatedFine,
    globalTurnoverPercentage: tier.globalTurnoverPercentage,
    explanation: isSme
      ? `SME provision (Art. 99(6)): lower of €${tier.maxFineEur.toLocaleString()} or ${tier.globalTurnoverPercentage}% of turnover (€${turnoverBasedFine.toLocaleString()}).`
      : `Higher of €${tier.maxFineEur.toLocaleString()} or ${tier.globalTurnoverPercentage}% of turnover (€${turnoverBasedFine.toLocaleString()}).`,
    smeApplied: isSme,
  };
}

import type { Penalty } from "../../domain/entities/penalty.js";
import type { PenaltyOutput } from "../../domain/value-objects/penalty.js";

export function calculatePenalty(tier: Penalty, turnover: number, isSme: boolean): PenaltyOutput {
  const turnoverBasedFine = (tier.globalTurnoverPercentage / 100) * turnover;
  let calculatedFine = Math.max(tier.maxFineEur, turnoverBasedFine);

  let smeApplied = false;
  if (isSme) {
    // Per Art. 99(6): SMEs pay the lower of the two amounts
    calculatedFine = Math.min(calculatedFine, turnoverBasedFine);
    smeApplied = true;
  }

  const explanation = isSme
    ? `SME rule applied (Art. 99(6)): fine is the lower of the fixed maximum (EUR ${tier.maxFineEur.toLocaleString()}) and ${tier.globalTurnoverPercentage}% of global turnover (EUR ${turnoverBasedFine.toLocaleString()}). Calculated fine: EUR ${calculatedFine.toLocaleString()}.`
    : `Standard calculation: the higher of the fixed maximum (EUR ${tier.maxFineEur.toLocaleString()}) and ${tier.globalTurnoverPercentage}% of global turnover (EUR ${turnoverBasedFine.toLocaleString()}). Calculated fine: EUR ${calculatedFine.toLocaleString()}.`;

  return {
    tierName: tier.name,
    maxFineEur: tier.maxFineEur,
    calculatedFine,
    globalTurnoverPercentage: tier.globalTurnoverPercentage,
    explanation,
    smeApplied,
  };
}

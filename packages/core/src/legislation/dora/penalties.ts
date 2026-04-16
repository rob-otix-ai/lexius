import type { Penalty } from "../../domain/entities/penalty.js";
import type { PenaltyOutput } from "../../domain/value-objects/penalty.js";

export function calculatePenalty(tier: Penalty, turnover: number, isSme: boolean): PenaltyOutput {
  const turnoverBasedFine = (tier.globalTurnoverPercentage / 100) * turnover;
  let calculatedFine: number;
  let explanation: string;

  // CTPP-specific: daily penalty payments up to 1% of average daily turnover, max 6 months
  if (tier.violationType === "ctpp-non-compliance") {
    const dailyTurnover = turnover / 365;
    const maxDailyPenalty = dailyTurnover * 0.01;
    const maxTotalPenalty = maxDailyPenalty * 180; // 6 months
    calculatedFine = Math.min(Math.max(tier.maxFineEur, turnoverBasedFine), maxTotalPenalty);
    explanation = `CTPP periodic penalty payments under Art. 35: up to 1% of average daily worldwide turnover (€${maxDailyPenalty.toLocaleString()}/day), capped at 6 months (€${maxTotalPenalty.toLocaleString()} total).`;
  } else if (isSme) {
    calculatedFine = Math.min(tier.maxFineEur, turnoverBasedFine);
    explanation = `Proportionality provision (Art. 51): lower of €${tier.maxFineEur.toLocaleString()} or ${tier.globalTurnoverPercentage}% of turnover (€${turnoverBasedFine.toLocaleString()}).`;
  } else {
    calculatedFine = Math.max(tier.maxFineEur, turnoverBasedFine);
    explanation = `Higher of €${tier.maxFineEur.toLocaleString()} or ${tier.globalTurnoverPercentage}% of turnover (€${turnoverBasedFine.toLocaleString()}). Note: Member State transposition may vary.`;
  }

  return {
    tierName: tier.name,
    maxFineEur: tier.maxFineEur,
    calculatedFine,
    globalTurnoverPercentage: tier.globalTurnoverPercentage,
    explanation,
    smeApplied: isSme && tier.violationType !== "ctpp-non-compliance",
  };
}

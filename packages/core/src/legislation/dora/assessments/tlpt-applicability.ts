import type { AssessmentOutput } from "../../../domain/value-objects/assessment.js";

export function runTlptApplicability(input: Record<string, unknown>): AssessmentOutput {
  const entityType = input.entity_type as string | undefined;
  const isSystemic = input.is_systemically_important === true;
  const paymentVolume = typeof input.annual_payment_volume_eur === "number" ? input.annual_payment_volume_eur : 0;
  const emoneyOutstanding = typeof input.outstanding_emoney_eur === "number" ? input.outstanding_emoney_eur : 0;
  const marketShare = typeof input.market_share_percentage === "number" ? input.market_share_percentage : 0;
  const lastTlptDate = input.last_tlpt_date as string | undefined;

  let required = false;
  const reasons: string[] = [];

  if (isSystemic) {
    required = true;
    reasons.push("entity is systemically important (G-SII or O-SII)");
  }
  if (entityType === "payment-institution" && paymentVolume > 150_000_000_000) {
    required = true;
    reasons.push("payment institution with >€150bn annual payment volume");
  }
  if (entityType === "payment-institution" && emoneyOutstanding > 40_000_000_000) {
    required = true;
    reasons.push("e-money institution with >€40bn outstanding");
  }
  if ((entityType === "csd" || entityType === "ccp" || entityType === "trading-venue") && marketShare > 5) {
    required = true;
    reasons.push(`${entityType} with >5% EU market share`);
  }

  let nextTlptDate: string | null = null;
  if (required && lastTlptDate) {
    const last = new Date(lastTlptDate);
    const next = new Date(last);
    next.setFullYear(next.getFullYear() + 3);
    nextTlptDate = next.toISOString().split("T")[0];
  }

  return {
    assessmentId: "tlpt-applicability",
    result: {
      tlpt_required: required,
      next_tlpt_date: nextTlptDate,
      methodology: "TIBER-EU or equivalent (per RTS on threat-led penetration testing)",
    },
    reasoning: required
      ? `Threat-led penetration testing is required because ${reasons.join(", ")}. Testing cycle is every 3 years.`
      : "Threat-led penetration testing is not required based on the provided thresholds. Standard resilience testing under Art. 24–25 still applies.",
    relevantArticles: ["Article 26", "Article 27"],
  };
}

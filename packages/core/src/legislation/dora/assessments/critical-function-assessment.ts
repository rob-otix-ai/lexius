import type { AssessmentOutput } from "../../../domain/value-objects/assessment.js";

export function runCriticalFunctionAssessment(input: Record<string, unknown>): AssessmentOutput {
  const supportsPayments = input.supports_payment_processing === true;
  const supportsSettlement = input.supports_settlement === true;
  const supportsCustomerData = input.supports_customer_data === true;
  const tolerableDowntime = typeof input.tolerable_downtime_minutes === "number" ? input.tolerable_downtime_minutes : Number.MAX_SAFE_INTEGER;
  const criticalityRating = input.criticality_rating as string | undefined;

  let isCriticalFunction = false;
  const reasons: string[] = [];

  if (supportsPayments) {
    isCriticalFunction = true;
    reasons.push("supports payment processing");
  }
  if (supportsSettlement) {
    isCriticalFunction = true;
    reasons.push("supports settlement");
  }
  if (supportsCustomerData) {
    isCriticalFunction = true;
    reasons.push("processes customer data at scale");
  }
  if (tolerableDowntime < 60) {
    isCriticalFunction = true;
    reasons.push(`low tolerable downtime (<60 min)`);
  }
  if (criticalityRating === "high" || criticalityRating === "critical") {
    isCriticalFunction = true;
    reasons.push(`explicitly rated ${criticalityRating}`);
  }

  return {
    assessmentId: "critical-function-assessment",
    result: {
      is_critical_function: isCriticalFunction,
      contractual_requirements_apply: isCriticalFunction,
      register_inclusion_required: isCriticalFunction,
      testing_scope_includes: isCriticalFunction,
    },
    reasoning: isCriticalFunction
      ? `Classified as a Critical or Important Function because it ${reasons.join(", ")}.`
      : "Not classified as a Critical or Important Function. Standard ICT third-party controls apply but enhanced requirements under Art. 30 do not.",
    relevantArticles: ["Article 28", "Article 30"],
  };
}

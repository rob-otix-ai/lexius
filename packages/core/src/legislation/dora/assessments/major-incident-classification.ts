import type { AssessmentOutput } from "../../../domain/value-objects/assessment.js";

export function runMajorIncidentClassification(input: Record<string, unknown>): AssessmentOutput {
  const clientsAffected = typeof input.clients_affected === "number" ? input.clients_affected : 0;
  const dataLossScale = input.data_loss_scale as string | undefined; // "none", "partial", "critical"
  const durationMinutes = typeof input.duration_minutes === "number" ? input.duration_minutes : 0;
  const economicImpact = typeof input.economic_impact_eur === "number" ? input.economic_impact_eur : 0;
  const geographicalSpread = input.geographical_spread as string | undefined; // "single-ms", "multi-ms", "eu-wide"
  const criticalityAffected = input.criticality_affected === true;

  let isMajor = false;
  const reasons: string[] = [];

  if (clientsAffected > 10000 && durationMinutes > 60) {
    isMajor = true;
    reasons.push(`>10,000 clients affected for >60 minutes`);
  }
  if (dataLossScale === "critical") {
    isMajor = true;
    reasons.push("critical data loss");
  }
  if (economicImpact > 2_000_000) {
    isMajor = true;
    reasons.push(`economic impact >€2M`);
  }
  if (criticalityAffected && durationMinutes > 30) {
    isMajor = true;
    reasons.push("critical or important function affected for >30 minutes");
  }
  if (geographicalSpread === "multi-ms" || geographicalSpread === "eu-wide") {
    isMajor = true;
    reasons.push(`cross-border impact (${geographicalSpread})`);
  }

  return {
    assessmentId: "major-incident-classification",
    result: {
      is_major_incident: isMajor,
      reporting_required: isMajor,
      initial_report_deadline_hours: isMajor ? 4 : null,
      intermediate_report_required: isMajor,
      final_report_deadline_days: isMajor ? 30 : null,
    },
    reasoning: isMajor
      ? `Classified as a major ICT-related incident because: ${reasons.join("; ")}. Reporting obligations under Art. 19 apply.`
      : "Not classified as a major ICT-related incident. Internal logging under Art. 17 still applies.",
    relevantArticles: ["Article 18", "Article 19", "Article 20"],
  };
}

import type { AssessmentDefinition, AssessmentOutput } from "../../../domain/value-objects/assessment.js";
import { runCriticalFunctionAssessment } from "./critical-function-assessment.js";
import { runTlptApplicability } from "./tlpt-applicability.js";
import { runMajorIncidentClassification } from "./major-incident-classification.js";

export const assessments: AssessmentDefinition[] = [
  {
    id: "critical-function-assessment",
    name: "Critical or Important Function Assessment",
    description: "Determines whether an ICT service supports a critical or important function, triggering enhanced obligations under Art. 28 and Art. 30.",
    inputSchema: {
      supports_payment_processing: "boolean",
      supports_settlement: "boolean",
      supports_customer_data: "boolean",
      tolerable_downtime_minutes: "number",
      criticality_rating: "enum:low|medium|high|critical",
    },
  },
  {
    id: "tlpt-applicability",
    name: "Threat-Led Penetration Testing Applicability",
    description: "Determines whether threat-led penetration testing is required under Art. 26-27.",
    inputSchema: {
      entity_type: "string",
      is_systemically_important: "boolean",
      annual_payment_volume_eur: "number",
      outstanding_emoney_eur: "number",
      market_share_percentage: "number",
      last_tlpt_date: "string",
    },
  },
  {
    id: "major-incident-classification",
    name: "Major Incident Classification",
    description: "Determines whether an ICT incident qualifies as a major incident requiring regulatory reporting under Art. 19.",
    inputSchema: {
      clients_affected: "number",
      data_loss_scale: "enum:none|partial|critical",
      duration_minutes: "number",
      economic_impact_eur: "number",
      geographical_spread: "enum:single-ms|multi-ms|eu-wide",
      criticality_affected: "boolean",
    },
  },
];

export function runAssessment(id: string, input: Record<string, unknown>): AssessmentOutput {
  switch (id) {
    case "critical-function-assessment":
      return runCriticalFunctionAssessment(input);
    case "tlpt-applicability":
      return runTlptApplicability(input);
    case "major-incident-classification":
      return runMajorIncidentClassification(input);
    default:
      throw new Error(`Unknown assessment id: ${id}`);
  }
}

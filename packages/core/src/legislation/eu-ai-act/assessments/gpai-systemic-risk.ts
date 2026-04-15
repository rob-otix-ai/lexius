import type { AssessmentDefinition, AssessmentOutput } from "../../../domain/value-objects/assessment.js";

export const gpaiSystemicRiskDefinition: AssessmentDefinition = {
  id: "gpai-systemic-risk",
  name: "GPAI Systemic Risk Assessment",
  description: "Determines whether a general-purpose AI model is classified as having systemic risk based on compute thresholds or Commission designation.",
  inputSchema: {
    type: "object",
    properties: {
      training_flops: { type: "number", description: "Total training compute in floating-point operations (FLOPs)" },
      commission_designated: { type: "boolean", description: "Has the European Commission designated this model as having systemic risk?" },
      model_name: { type: "string", description: "Optional model name for reference" },
    },
    required: ["training_flops", "commission_designated"],
  },
};

const SYSTEMIC_RISK_THRESHOLD = 1e25;

export function runGpaiSystemicRisk(input: Record<string, unknown>): AssessmentOutput {
  const trainingFlops = input.training_flops as number;
  const commissionDesignated = input.commission_designated as boolean;
  const modelName = (input.model_name as string) || "unnamed model";

  const crossesThreshold = trainingFlops >= SYSTEMIC_RISK_THRESHOLD;
  const isSystemic = crossesThreshold || commissionDesignated;

  const baselineObligations = [
    "Maintain up-to-date technical documentation (Article 53(1)(a))",
    "Provide information and documentation to downstream providers (Article 53(1)(b))",
    "Establish a copyright policy compliant with Directive (EU) 2019/790 (Article 53(1)(c))",
    "Publish a sufficiently detailed summary of training content (Article 53(1)(d))",
  ];

  const systemicObligations = [
    "Perform model evaluation including adversarial testing (Article 55(1)(a))",
    "Assess and mitigate systemic risks (Article 55(1)(b))",
    "Track, document, and report serious incidents (Article 55(1)(c))",
    "Ensure adequate cybersecurity protections (Article 55(1)(d))",
  ];

  if (isSystemic) {
    const reason = crossesThreshold
      ? `Training compute (${trainingFlops.toExponential(2)} FLOPs) meets or exceeds the 10^25 FLOPs threshold.`
      : `The European Commission has designated "${modelName}" as having systemic risk.`;

    return {
      assessmentId: "gpai-systemic-risk",
      result: {
        crosses_threshold: crossesThreshold,
        threshold: SYSTEMIC_RISK_THRESHOLD,
        systemic: true,
        baseline_obligations: baselineObligations,
        systemic_obligations: systemicObligations,
        notification_duty: "Provider must notify the Commission without undue delay when the model meets the threshold criteria.",
      },
      reasoning: `The GPAI model "${modelName}" IS classified as having systemic risk. ${reason} Both baseline (Article 53) and systemic risk (Article 55) obligations apply.`,
      relevantArticles: ["Article 51", "Article 52", "Article 53", "Article 55"],
    };
  }

  return {
    assessmentId: "gpai-systemic-risk",
    result: {
      crosses_threshold: false,
      threshold: SYSTEMIC_RISK_THRESHOLD,
      systemic: false,
      baseline_obligations: baselineObligations,
      systemic_obligations: [],
      notification_duty: "No notification duty. Provider should monitor for future Commission designations.",
    },
    reasoning: `The GPAI model "${modelName}" is NOT classified as having systemic risk. Training compute (${trainingFlops.toExponential(2)} FLOPs) is below the 10^25 FLOPs threshold, and no Commission designation exists. Only baseline obligations (Article 53) apply.`,
    relevantArticles: ["Article 51", "Article 52", "Article 53"],
  };
}

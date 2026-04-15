import type { AssessmentDefinition, AssessmentOutput } from "../../../domain/value-objects/assessment.js";

export const art6ExceptionDefinition: AssessmentDefinition = {
  id: "art6-exception",
  name: "Article 6(3) Exception Assessment",
  description: "Determines whether a high-risk AI system qualifies for the Article 6(3) exception, which allows certain Annex III systems to avoid high-risk classification.",
  inputSchema: {
    type: "object",
    properties: {
      narrow_procedural_task: { type: "boolean", description: "Does the system perform a narrow procedural task?" },
      improves_prior_human_activity: { type: "boolean", description: "Does the system improve the result of a previously completed human activity?" },
      detects_patterns_without_replacing_review: { type: "boolean", description: "Does the system detect decision-making patterns without replacing human review?" },
      preparatory_task: { type: "boolean", description: "Is the system intended only to perform a preparatory task to an assessment?" },
      performs_profiling: { type: "boolean", description: "Does the system perform profiling of natural persons?" },
      documented_assessment: { type: "boolean", description: "Has the provider documented the assessment that the system is not high-risk?" },
    },
    required: ["narrow_procedural_task", "improves_prior_human_activity", "detects_patterns_without_replacing_review", "preparatory_task", "performs_profiling", "documented_assessment"],
  },
};

export function runArt6Exception(input: Record<string, unknown>): AssessmentOutput {
  const booleanFields = [
    "performs_profiling",
    "documented_assessment",
    "narrow_procedural_task",
    "improves_prior_human_activity",
    "detects_patterns_without_replacing_review",
    "preparatory_task",
  ] as const;

  for (const field of booleanFields) {
    if (typeof input[field] !== "boolean") {
      throw new Error(`${field} must be a boolean`);
    }
  }

  const performsProfiling = input.performs_profiling as boolean;
  const documentedAssessment = input.documented_assessment as boolean;
  const narrowProceduralTask = input.narrow_procedural_task as boolean;
  const improvesPriorHumanActivity = input.improves_prior_human_activity as boolean;
  const detectsPatternsWithoutReplacingReview = input.detects_patterns_without_replacing_review as boolean;
  const preparatoryTask = input.preparatory_task as boolean;

  const conditionsEvaluated = {
    narrow_procedural_task: narrowProceduralTask,
    improves_prior_human_activity: improvesPriorHumanActivity,
    detects_patterns_without_replacing_review: detectsPatternsWithoutReplacingReview,
    preparatory_task: preparatoryTask,
  };

  // Hard block: profiling prevents exception
  if (performsProfiling) {
    return {
      assessmentId: "art6-exception",
      result: {
        exception_available: false,
        profiling_blocks: true,
        conditions_evaluated: conditionsEvaluated,
        documentation_reminder: "N/A - exception blocked by profiling",
      },
      reasoning: "The Article 6(3) exception is NOT available because the system performs profiling of natural persons. Per Article 6(3), AI systems performing profiling cannot benefit from this exception regardless of other conditions.",
      relevantArticles: ["Article 6(3)", "Article 6(2)", "Annex III"],
    };
  }

  const anyConditionMet = narrowProceduralTask || improvesPriorHumanActivity || detectsPatternsWithoutReplacingReview || preparatoryTask;

  if (anyConditionMet && documentedAssessment) {
    return {
      assessmentId: "art6-exception",
      result: {
        exception_available: true,
        profiling_blocks: false,
        conditions_evaluated: conditionsEvaluated,
        documentation_reminder: "Provider must maintain the documented assessment and make it available to the market surveillance authority upon request.",
      },
      reasoning: "The Article 6(3) exception IS available. At least one qualifying condition is met and the provider has documented the assessment. The system may be exempted from high-risk classification.",
      relevantArticles: ["Article 6(3)", "Article 6(2)", "Annex III"],
    };
  }

  const missingParts: string[] = [];
  if (!anyConditionMet) {
    missingParts.push("No qualifying condition (narrow procedural task, improvement of prior human activity, pattern detection without replacing review, or preparatory task) is met.");
  }
  if (!documentedAssessment) {
    missingParts.push("The provider has not documented the assessment.");
  }

  return {
    assessmentId: "art6-exception",
    result: {
      exception_available: false,
      profiling_blocks: false,
      conditions_evaluated: conditionsEvaluated,
      documentation_reminder: documentedAssessment ? "Documentation exists but conditions not met." : "Provider must document the assessment for the exception to apply.",
    },
    reasoning: `The Article 6(3) exception is NOT available. ${missingParts.join(" ")}`,
    relevantArticles: ["Article 6(3)", "Article 6(2)", "Annex III"],
  };
}

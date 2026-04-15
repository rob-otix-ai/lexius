import type { LegislationPluginRegistry } from "../domain/plugin.js";
import type { AssessmentOutput } from "../domain/value-objects/assessment.js";

export class RunAssessment {
  constructor(private readonly pluginRegistry: LegislationPluginRegistry) {}

  execute(legislationId: string, assessmentId: string, input: Record<string, unknown>): AssessmentOutput {
    const plugin = this.pluginRegistry.get(legislationId);

    const assessments = plugin.getAssessments();
    const assessment = assessments.find((a) => a.id === assessmentId);
    if (!assessment) {
      throw new Error(`Assessment "${assessmentId}" not found for legislation "${legislationId}"`);
    }

    return plugin.runAssessment(assessmentId, input);
  }
}

export interface AssessmentDefinition {
  id: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface AssessmentOutput {
  assessmentId: string;
  result: Record<string, unknown>;
  reasoning: string;
  relevantArticles: string[];
}

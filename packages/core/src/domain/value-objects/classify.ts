export interface ClassifyInput {
  legislationId: string;
  description?: string;
  useCase?: string;
  role: "provider" | "deployer" | "unknown";
  signals?: Record<string, unknown>;
}

export interface ClassifyOutput {
  riskClassification: string;
  confidence: "high" | "medium" | "low";
  matchedCategory: { name: string; level: number } | null;
  relevantArticles: string[];
  roleDetermination: string;
  obligationsSummary: string;
  matchedSignals: string[];
  missingSignals: string[];
  nextQuestions: string[];
  basis: "signals" | "text" | "semantic" | "default";
}

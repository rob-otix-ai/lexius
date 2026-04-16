export interface AuditInput {
  legislationId: string;
  systemDescription: string;
  role: "provider" | "deployer" | "unknown";
  signals?: Record<string, unknown>;
  annualTurnoverEur?: number;
  isSme?: boolean;
  options?: AuditOptions;
}

export interface AuditOptions {
  includeDocumentation?: boolean;
  includeDeadlines?: boolean;
  includePenalties?: boolean;
  includeRecommendations?: boolean;
}

export interface AuditSource {
  article: string;
  url: string;
  relevance: string;
}

export interface ComplianceReport {
  metadata: {
    generatedAt: string;
    legislationId: string;
    legislationName: string;
    reportVersion: string;
  };
  systemDescription: string;
  classification: {
    riskLevel: string;
    confidence: string;
    basis: string;
    matchedCategory: string | null;
    matchedSignals: string[];
    missingSignals: string[];
    sources?: AuditSource[];
  };
  obligations: Array<{
    obligation: string;
    article: string;
    deadline: string | null;
    category: string;
    provenanceTier: "AUTHORITATIVE" | "CURATED" | "AI_GENERATED";
  }>;
  assessments: Array<{
    id: string;
    name: string;
    result: Record<string, unknown>;
    reasoning: string;
  }>;
  penaltyExposure: {
    highestTier: string;
    maxFine: number;
    explanation: string;
  } | null;
  documentationChecklist: Array<{
    item: number;
    title: string;
    description: string;
  }> | null;
  deadlines: Array<{
    date: string;
    event: string;
    daysRemaining: number;
    isPast: boolean;
  }>;
  citations: Array<{
    article: string;
    title: string;
    summary: string;
    url: string;
  }>;
  recommendations: string[];
  confidence: ReportConfidence;
  relianceByTier: {
    AUTHORITATIVE: number;
    CURATED: number;
    AI_GENERATED: number;
  };
}

export interface EnhancedComplianceReport extends ComplianceReport {
  enhancement: {
    summary: string;
    recommendations: string[];
    riskAreas: string[];
    reasoning: Record<string, string>;
    gapAnalysis: string[];
  };
}

export interface ReportConfidence {
  overall: "high" | "medium" | "low";
  signalCompleteness: number;
  reasoning: string;
}

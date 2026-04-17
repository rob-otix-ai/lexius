import type { ProvenanceTier } from "@lexius/core";

export type FindingType = "obligation" | "penalty" | "deadline" | "cross_ref" | "gap" | "risk";

export interface ObligationFinding {
  type: "obligation";
  text: string;
  subjectHint: string;
  articleRef: string;
  shallClauseId: number;
  matchedCuratedId?: string;
  confidence: number;
}

export interface PenaltyFinding {
  type: "penalty";
  amountEur: number;
  turnoverPercentage: number;
  paragraphRef: string;
  extractId: number;
}

export interface DeadlineFinding {
  type: "deadline";
  date: string;
  dateLabel?: string;
  paragraphRef: string;
  extractId: number;
}

export interface CrossRefFinding {
  type: "cross_ref";
  sourceArticleId: string;
  targetArticleId: string;
  context: string;
}

export interface GapFinding {
  type: "gap";
  shallClauseText: string;
  shallClauseId: number;
  articleRef: string;
  reason: string;
}

export interface RiskFinding {
  type: "risk";
  description: string;
  articleRef: string;
  severity: "high" | "medium" | "low";
}

export type SwarmFinding =
  | ObligationFinding
  | PenaltyFinding
  | DeadlineFinding
  | CrossRefFinding
  | GapFinding
  | RiskFinding;

export interface WorkspaceEntry {
  id: number;
  sessionId: string;
  agentId: string;
  articleId: string;
  findingType: FindingType;
  finding: SwarmFinding;
  provenanceTier: ProvenanceTier;
  sourceExtractId: number | null;
  createdAt: Date;
}

export interface SwarmSession {
  sessionId: string;
  legislationId: string;
  concurrency: number;
  createdAt: Date;
}

export interface SwarmResult {
  sessionId: string;
  totalArticles: number;
  totalFindings: number;
  findingsByType: Record<FindingType, number>;
  gapCount: number;
  durationMs: number;
}

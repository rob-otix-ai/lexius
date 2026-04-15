import type { ComplianceReport } from "../value-objects/audit.js";

export interface ReportEnhancement {
  summary: string;
  recommendations: string[];
  riskAreas: string[];
  reasoning: Record<string, string>;
  gapAnalysis: string[];
}

export interface EnhancementService {
  enhance(report: ComplianceReport, systemDescription: string): Promise<ReportEnhancement>;
}

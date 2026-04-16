import type { Provenance } from "../value-objects/provenance.js";

export interface RiskCategory {
  id: string;
  legislationId: string;
  name: string;
  level: number;
  description: string;
  keywords: string[];
  examples: string[];
  relevantArticles: string[];
  provenance: Provenance;
}
